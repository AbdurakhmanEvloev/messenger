import { useFocusEffect, useRouter } from 'expo-router';
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
      <View style={styles.searchBox}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по @нику"
          placeholderTextColor="#9aa0a6"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
        }
        renderItem={({ item, section }) => {
          const name = item.username ?? item.nickname ?? 'Без имени';
          const isIncoming = section.key === 'incoming';
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/user/${item.id}`)}
            >
              <Avatar name={name} path={item.avatar_path} size={46} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {item.nickname ? <Text style={styles.nick}>@{item.nickname}</Text> : null}
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
  container: { flex: 1, backgroundColor: '#fff' },
  searchBox: { paddingHorizontal: 16, paddingVertical: 10 },
  search: {
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a8f98',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  empty: { textAlign: 'center', color: '#8a8f98', marginTop: 40, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { backgroundColor: '#f2f4f7' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 76 },
  info: { flex: 1, marginLeft: 14 },
  name: { fontSize: 17, fontWeight: '500', color: '#111' },
  nick: { fontSize: 14, color: '#8a8f98', marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accept: { backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  acceptText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  decline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: { color: '#6b7280', fontSize: 14 },
});