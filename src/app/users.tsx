// src/app/users.tsx — выбор собеседника для нового чата (полный файл)
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

type UserRow = { id: string; username: string | null; avatar_path: string | null };

export default function Users() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_path')
        .neq('id', u.user?.id ?? '');
      setUsers((data ?? []) as UserRow[]);
    })();
  }, []);

  const open = async (id: string, name: string) => {
    const { data, error } = await supabase.rpc('start_chat', { other: id });
    if (error) return Alert.alert('Ошибка', error.message);
    router.replace(`/chat/${data}?name=${encodeURIComponent(name)}`);
  };

  // Поиск по имени: пока ничего не введено, показываем всех
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.username ?? '').toLowerCase().includes(q));
  }, [users, query]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени"
          placeholderTextColor="#9aa0a6"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.trim() ? 'Никого не нашли' : 'Других пользователей пока нет'}
          </Text>
        }
        renderItem={({ item }) => {
          const name = item.username ?? 'Без имени';
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => open(item.id, name)}
            >
              <Avatar name={name} path={item.avatar_path} size={46} />
              <Text style={styles.name}>{name}</Text>
            </Pressable>
          );
        }}
      />
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
  empty: { textAlign: 'center', color: '#8a8f98', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { backgroundColor: '#f2f4f7' },
  name: { fontSize: 17, fontWeight: '500', color: '#111', marginLeft: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 76 },
});