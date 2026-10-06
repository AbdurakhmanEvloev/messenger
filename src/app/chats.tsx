// src/app/chats.tsx — список чатов (поиск + три точки в шапке)
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMyId(u.user.id);
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
  useFocusEffect(
    useCallback(() => {
      load();
      const channel = supabase
        .channel('chat-list')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [load])
  );

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

      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#111' }}>Чаты</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Поиск"
        placeholderTextColor="#8a8f98"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={shown}
        keyExtractor={(item) => item.chat_id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  container: { flex: 1, backgroundColor: '#fff' },
  search: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#f2f4f7',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { backgroundColor: '#f2f4f7' },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  name: { flex: 1, fontSize: 17, fontWeight: '600', color: '#111', marginRight: 8 },
  time: { fontSize: 13, color: '#8a8f98' },
  timeUnread: { color: '#2563eb', fontWeight: '600' },
  preview: { flex: 1, fontSize: 15, color: '#8a8f98', marginRight: 8 },
  previewUnread: { color: '#333' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 84 },
  emptyBox: { alignItems: 'center', marginTop: 90, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 6 },
  emptyText: { fontSize: 15, color: '#8a8f98', textAlign: 'center' },
  });