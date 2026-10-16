// src/app/chats.tsx — список чатов (поиск + три точки в шапке)
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import BottomBubble from '../components/BottomBubble';
import { supabase } from '../lib/supabase';

type ChatRow = {
  chat_id: string;
  username: string;
  last_text: string | null;
  last_audio_path: string | null;
  last_image_path: string | null;
  last_sender_id: string | null;
  last_at: string;
  unread_count: number;
  avatar_path: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Сегодня: 14:05, вчера: «Вчера», раньше: 03.10
function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (t >= startToday - 86400000) return 'Вчера';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function previewText(c: ChatRow) {
  if (c.last_image_path) return '📷 Фото';
  if (c.last_audio_path) return '🎤 Голосовое';
  if (c.last_text) return c.last_text;
  return 'Нет сообщений';
}

export default function Chats() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const reqId = useRef(0); // номер последнего запроса
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) return;
    setMyId(user.id);
    const { data, error: err } = await supabase.rpc('get_chat_list');
    if (err) {
      console.log('[CHATS] ошибка:', err.message);
      setError(err.message);
    } else {
      setError(null);
      setChats((data ?? []) as ChatRow[]);
    }
    setLoaded(true);
  }, []);

  // Когда экран открыт: загружаем список и следим за новыми сообщениями

  const scheduleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;

      load();

      (async () => {
        // старый канал мог ещё не закрыться: ждём
        const old = supabase.getChannels().filter((c) => c.topic === 'realtime:chat-list');
        await Promise.all(old.map((c) => supabase.removeChannel(c)));
        if (!active) return;

        channel = supabase
          .channel('chat-list')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleLoad)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, scheduleLoad)
          .subscribe();
      })();

      return () => {
        active = false;
        if (timer.current) clearTimeout(timer.current);
        if (channel) supabase.removeChannel(channel);
      };
    }, [load, scheduleLoad])
  );

  // Удалить файлы (голосовые и фото) из хранилища
  const removeFiles = async (files: { audio_path: string | null; image_path: string | null }[]) => {
    const voice = files.map((f) => f.audio_path).filter(Boolean) as string[];
    const photos = files.map((f) => f.image_path).filter(Boolean) as string[];
    if (voice.length) await supabase.storage.from('voice').remove(voice);
    if (photos.length) await supabase.storage.from('photos').remove(photos);
  };

  // action: 'clear' очищает чат, 'delete' удаляет чат целиком
  const runChatAction = async (chatId: string, action: 'clear' | 'delete') => {
    const { data: files } = await supabase
      .from('messages')
      .select('audio_path, image_path')
      .eq('chat_id', chatId);

    const { error: err } = await supabase.rpc(action === 'clear' ? 'clear_chat' : 'delete_chat', {
      p_chat_id: chatId,
    });
    if (err) {
      Alert.alert(action === 'clear' ? 'Не удалось очистить чат' : 'Не удалось удалить чат', err.message);
      return;
    }
    await removeFiles(files ?? []);
    load();
  };

  // Меню по долгому нажатию на чат
  const openChatMenu = (item: ChatRow) => {
    const title = item.username || 'Без имени';
    Alert.alert(title, undefined, [
      {
        text: 'Очистить чат',
        onPress: () =>
          Alert.alert('Очистить чат?', 'Все сообщения исчезнут у вас и у собеседника.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Очистить', style: 'destructive', onPress: () => runChatAction(item.chat_id, 'clear') },
          ]),
      },
      {
        text: 'Удалить чат',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Удалить чат?', 'Чат и вся переписка исчезнут у вас и у собеседника.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить', style: 'destructive', onPress: () => runChatAction(item.chat_id, 'delete') },
          ]),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Поиск: по имени собеседника и по тексту последнего сообщения
  const q = query.trim().toLowerCase();
  const shown = q
    ? chats.filter(
      (c) =>
        (c.username ?? '').toLowerCase().includes(q) ||
        (c.last_text ?? '').toLowerCase().includes(q)
    )
    : chats;

  const renderItem = ({ item }: { item: ChatRow }) => {
    const name = item.username || 'Без имени';
    const unread = Number(item.unread_count) || 0;
    const hasMessage = !!(item.last_text || item.last_audio_path || item.last_image_path);
    const mine = hasMessage && item.last_sender_id === myId;

    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push(`/chat/${item.chat_id}?name=${encodeURIComponent(name)}`)}
        onLongPress={() => openChatMenu(item)}
        delayLongPress={350}
      >
        <Avatar name={name} path={item.avatar_path} size={54} />

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {hasMessage && (
              <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{formatTime(item.last_at)}</Text>
            )}
          </View>

          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {(mine ? 'Вы: ' : '') + previewText(item)}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ paddingTop: insets.top + 22, paddingHorizontal: 16, paddingBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#111' }}>Чаты</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={22} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск"
          placeholderTextColor="#8a8f98"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        overScrollMode="always"
        data={shown}
        bounces
        alwaysBounceVertical
        keyExtractor={(item) => item.chat_id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"

        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>{q ? '🔍' : '💬'}</Text>
              <Text style={styles.emptyTitle}>
                {error ? 'Не удалось загрузить чаты' : q ? 'Ничего не найдено' : 'Чатов пока нет'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? error
                  : q
                    ? 'Попробуйте другое имя или слово.'
                    : 'Нажмите на синюю кнопку внизу, чтобы начать переписку.'}
              </Text>
            </View>
          ) : null
        }
      />
      <BottomBubble active="chats" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 34,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111', paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#fff',
  },


  rowPressed: { backgroundColor: '#eef1f5', transform: [{ scale: 1.01 }] },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  name: { flex: 1, fontSize: 17, fontWeight: '600', color: '#111', marginRight: 8 },
  time: { fontSize: 14, color: '#2f3132' },
  timeUnread: { color: '#2a8bf2', fontWeight: '600' },
  preview: { flex: 1, fontSize: 15, color: '#2f3132', marginRight: 8 },
  previewUnread: { color: '#333' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#2a8bf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  emptyBox: { alignItems: 'center', marginTop: 90, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 6 },
  emptyText: { fontSize: 15, color: '#8a8f98', textAlign: 'center' },
});