import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import BottomBubble from '../components/BottomBubble';
import { supabase } from '../lib/supabase';

type UserRow = {
  id: string;
  username: string | null;
  nickname: string | null;
  avatar_path: string | null;
  fid?: string;
};

type Section = { key: string; title: string; data: UserRow[] };

export default function Friends() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<UserRow[]>([]);
  const [friends, setFriends] = useState<UserRow[]>([]);

  const q = query.trim().toLowerCase().replace(/^@/, '');

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const me = u.user?.id;
    if (!me) return;

    const { data: rows } = await supabase
      .from('friendships')
      .select('id, requester, addressee, status')
      .or('requester.eq.' + me + ',addressee.eq.' + me);

    const list = rows ?? [];
    const otherIds = list.map((r) => (r.requester === me ? r.addressee : r.requester));
    if (otherIds.length === 0) {
      setIncoming([]);
      setFriends([]);
      return;
    }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_path')
      .in('id', otherIds);

    const byId = new Map((profs ?? []).map((p) => [p.id as string, p as UserRow]));
    const inc: UserRow[] = [];
    const fr: UserRow[] = [];
    for (const r of list) {
      const otherId = r.requester === me ? r.addressee : r.requester;
      const p = byId.get(otherId);
      if (!p) continue;
      if (r.status === 'accepted') fr.push({ ...p, fid: r.id });
      else if (r.addressee === me) inc.push({ ...p, fid: r.id });
    }
    setIncoming(inc);
    setFriends(fr);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!q) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('search_users', { q });
      setSearching(false);
      if (err) {
        setError(err.message);
        setResults([]);
      } else {
        setError(null);
        setResults((data ?? []) as UserRow[]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const accept = async (fid: string) => {
    const { error: err } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', fid);
    if (err) Alert.alert('Ошибка', err.message);
    load();
  };

  const decline = async (fid: string) => {
    const { error: err } = await supabase.from('friendships').delete().eq('id', fid);
    if (err) Alert.alert('Ошибка', err.message);
    load();
  };

  const sections: Section[] = [];
  if (q) {
    sections.push({ key: 'search', title: '', data: results });
  } else {
    if (incoming.length > 0) {
      sections.push({ key: 'incoming', title: 'Заявки в друзья: ' + incoming.length, data: incoming });
    }
    if (friends.length > 0) {
      sections.push({ key: 'friends', title: 'Друзья: ' + friends.length, data: friends });
    }
  }

  const emptyText = q
    ? searching
      ? 'Ищем…'
      : error
        ? 'Ошибка поиска: ' + error
        : 'Никого не нашли'
    : 'Пока никого нет. Введите ник в поиске, чтобы найти человека';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Друзья</Text>
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по @нику"
          placeholderTextColor="#8a8f98"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : <View style={{ height: 14 }} />
        }
        renderItem={({ item, section }) => {
          const name = item.username ?? item.nickname ?? 'Без имени';
          const isIncoming = section.key === 'incoming';
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/user/${item.id}`)}
            >
              <Avatar name={name} path={item.avatar_path} size={52} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {item.nickname ? (
                  <Text style={styles.sub} numberOfLines={1}>
                    @{item.nickname}
                  </Text>
                ) : null}
              </View>
              {isIncoming && item.fid ? (
                <View style={styles.actions}>
                  <Pressable style={styles.accept} onPress={() => accept(item.fid!)} hitSlop={6}>
                    <Text style={styles.acceptText}>Принять</Text>
                  </Pressable>
                  <Pressable style={styles.decline} onPress={() => decline(item.fid!)} hitSlop={6}>
                    <Text style={styles.declineText}>✕</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <BottomBubble active="friends" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f9' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#111' },


  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 17, color: '#111', paddingVertical: 0 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a8f98',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  empty: { textAlign: 'center', color: '#8a8f98', marginTop: 40, paddingHorizontal: 24 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  cardPressed: { backgroundColor: '#eef1f6' },
  info: { flex: 1, marginLeft: 14 },
  name: { fontSize: 17, fontWeight: '700', color: '#111' },
  sub: { fontSize: 15, color: '#5f6368', marginTop: 3 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accept: { backgroundColor: '#2563eb', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  acceptText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  decline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2f4f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: { color: '#6b7280', fontSize: 14 },
});