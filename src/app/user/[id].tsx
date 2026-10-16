// src/app/user/[id].tsx — профиль другого пользователя

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import BottomBubble from '../../components/BottomBubble';
import { supabase } from '../../lib/supabase';

type Profile = {
  username: string | null;
  nickname: string | null;
  avatar_path: string | null;
  bio: string | null;
  created_at: string | null;
  birthday: string | null;
};

type Friendship = { id: string; requester: string; status: string };

const REPORT_REASONS = ['Спам', 'Оскорбления', 'Мошенничество', 'Неприемлемый контент', 'Другое'];

function formatBirthday(s: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [fr, setFr] = useState<Friendship | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadFriendship = useCallback(
    async (meId: string) => {
      const { data } = await supabase
        .from('friendships')
        .select('id, requester, status')
        .or(
          'and(requester.eq.' + meId + ',addressee.eq.' + id + '),and(requester.eq.' + id + ',addressee.eq.' + meId + ')',
        )
        .maybeSingle();
      setFr((data as Friendship) ?? null);
    },
    [id],
  );

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const meId = u.user?.id ?? null;
      setMe(meId);

      const { data } = await supabase
        .from('profiles')
        .select('username, nickname, avatar_path, bio, created_at, birthday')
        .eq('id', id)
        .single();
      setProfile((data as Profile) ?? null);

      if (meId) {
        await loadFriendship(meId);
        const { data: b } = await supabase
          .from('blocks')
          .select('blocked')
          .eq('blocker', meId)
          .eq('blocked', id)
          .maybeSingle();
        setBlocked(!!b);
      }
      setLoading(false);
    })();
  }, [id, loadFriendship]);

  const name = profile?.username ?? profile?.nickname ?? 'Без имени';

  const rel: 'none' | 'sent' | 'received' | 'friends' = !fr
    ? 'none'
    : fr.status === 'accepted'
      ? 'friends'
      : fr.requester === me
        ? 'sent'
        : 'received';

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (busy || !me) return;
    setBusy(true);
    const { error } = await fn();
    if (error) Alert.alert('Ошибка', error.message);
    await loadFriendship(me);
    setBusy(false);
  };

  const onFriend = () => {
    if (!me) return;
    if (rel === 'none') {
      run(() => supabase.from('friendships').insert({ requester: me, addressee: id }));
    } else if (rel === 'received' && fr) {
      run(() => supabase.from('friendships').update({ status: 'accepted' }).eq('id', fr.id));
    } else if (rel === 'sent' && fr) {
      run(() => supabase.from('friendships').delete().eq('id', fr.id));
    } else if (rel === 'friends' && fr) {
      Alert.alert('Удалить из друзей?', name, [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => run(() => supabase.from('friendships').delete().eq('id', fr.id)),
        },
      ]);
    }
  };

  const writeMessage = async () => {
    if (busy) return;
    if (blocked) {
      Alert.alert('Человек заблокирован', 'Разблокируйте его, чтобы писать сообщения');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('start_chat', { other: id });
    setBusy(false);
    if (error) return Alert.alert('Ошибка', error.message);
    router.push(`/chat/${data}?name=${encodeURIComponent(name)}`);
  };

  const toggleBlock = () => {
    if (!me) return;
    if (blocked) {
      run(async () => {
        const r = await supabase.from('blocks').delete().eq('blocker', me).eq('blocked', id);
        if (!r.error) setBlocked(false);
        return r;
      });
      return;
    }
    Alert.alert('Заблокировать?', name + ' не сможет быть у вас в друзьях', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Заблокировать',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const r = await supabase.from('blocks').insert({ blocker: me, blocked: id });
            if (!r.error) {
              setBlocked(true);
              if (fr) await supabase.from('friendships').delete().eq('id', fr.id);
            }
            return r;
          }),
      },
    ]);
  };

  const clearChat = () => {
    Alert.alert('Очистить чат?', 'Все сообщения будут удалены у вас и у собеседника', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Очистить',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('clear_chat', { other: id });
          Alert.alert(error ? 'Ошибка' : 'Готово', error ? error.message : 'Чат очищен');
        },
      },
    ]);
  };

  const sendReport = async (reason: string) => {
    setReportOpen(false);
    if (!me) return;
    const { error } = await supabase.from('reports').insert({ reporter: me, reported: id, reason });
    Alert.alert(error ? 'Ошибка' : 'Спасибо', error ? error.message : 'Жалоба отправлена');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const friendLabel =
    rel === 'none'
      ? 'Добавить в друзья'
      : rel === 'sent'
        ? 'Заявка отправлена'
        : rel === 'received'
          ? 'Принять заявку'
          : 'В друзьях';
  // синяя кнопка — когда есть действие «добавить/принять», иначе белая
  const friendBlue = rel === 'none' || rel === 'received';

  const birthdayText = formatBirthday(profile?.birthday ?? null);
  const registered = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Профиль</Text>
        </View>

        {/* карточка с данными */}
        <View style={styles.card}>
          <Avatar name={name} path={profile?.avatar_path ?? null} size={92} />
          <Text style={styles.name}>{name}</Text>
          {profile?.nickname ? <Text style={styles.nick}>@{profile.nickname}</Text> : null}
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {birthdayText ? <Text style={styles.meta}>День рождения: {birthdayText}</Text> : null}
          {registered ? <Text style={styles.meta}>Дата регистрации: {registered}</Text> : null}
        </View>

        {/* кнопки-таблетки */}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnLight, pressed && styles.pressed]}
            onPress={writeMessage}
            disabled={busy}
          >
            <Text style={styles.btnLightText}>Написать</Text>
          </Pressable>
          {!blocked ? (
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                friendBlue ? styles.btnBlue : styles.btnLight,
                pressed && styles.pressed,
              ]}
              onPress={onFriend}
              disabled={busy}
            >
              <Text style={friendBlue ? styles.btnBlueText : styles.btnLightText} numberOfLines={1}>
                {friendLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* меню */}
        <View style={styles.menu}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
            onPress={clearChat}
          >
            <Text style={styles.menuText}>Очистить чат</Text>
          </Pressable>
          <View style={styles.menuLine} />
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
            onPress={toggleBlock}
          >
            <Text style={styles.menuDanger}>{blocked ? 'Разблокировать' : 'Заблокировать'}</Text>
          </Pressable>
          <View style={styles.menuLine} />
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
            onPress={() => setReportOpen(true)}
          >
            <Text style={styles.menuDanger}>Пожаловаться</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomBubble active="profile" />

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Причина жалобы</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r} style={styles.sheetRow} onPress={() => sendReport(r)}>
                <Text style={styles.sheetText}>{r}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetRow} onPress={() => setReportOpen(false)}>
              <Text style={styles.sheetCancel}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f9' },
  center: { flex: 1, backgroundColor: '#f2f4f9', alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 28, lineHeight: 30, color: '#111', marginTop: -2 },
  title: { fontSize: 32, fontWeight: '800', color: '#111' },

  card: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 14 },
  nick: { fontSize: 15, color: '#5f6368', marginTop: 2 },
  bio: { fontSize: 16, color: '#111', marginTop: 12, lineHeight: 22 },
  meta: { fontSize: 14, color: '#5f6368', marginTop: 8 },

  buttons: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnLight: { backgroundColor: '#fff' },
  btnLightText: { color: '#111', fontSize: 15, fontWeight: '700' },
  btnBlue: { backgroundColor: '#2563eb' },
  btnBlueText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  menu: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  menuRow: { paddingVertical: 17, paddingHorizontal: 18 },
  menuPressed: { backgroundColor: '#eef1f6' },
  menuLine: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 18 },
  menuText: { fontSize: 16, color: '#111' },
  menuDanger: { fontSize: 16, color: '#dc2626' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 8 },
  sheetRow: { paddingVertical: 14 },
  sheetText: { fontSize: 16, color: '#111' },
  sheetCancel: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
});
