// src/app/users.tsx — поиск собеседника по нику (полный файл)
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

type UserRow = { id: string; username: string | null; nickname: string | null; avatar_path: string | null };

export default function Users() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase().replace(/^@/, '');

  // Ищем через 0,3 секунды после последнего нажатия клавиши
  useEffect(() => {
    if (!q) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('search_users', { q });
      if (!active) return;
      if (err) console.log('[SEARCH] ошибка:', err.message);
      setError(err ? err.message : null);
      setResults(err ? [] : ((data ?? []) as UserRow[]));
      setSearching(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const open = async (id: string, name: string) => {
    const { data, error: err } = await supabase.rpc('start_chat', { other: id });
    if (err) return Alert.alert('Ошибка', err.message);
    router.replace(`/chat/${data}?name=${encodeURIComponent(name)}`);
  };

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

      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {!q
              ? 'Введите ник, чтобы найти человека'
              : searching
              ? 'Ищем…'
              : error
              ? `Ошибка поиска: ${error}`
              : 'Никого не нашли'}
          </Text>
        }
        renderItem={({ item }) => {
          const name = item.username ?? item.nickname ?? 'Без имени';
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => open(item.id, name)}
            >
              <Avatar name={name} path={item.avatar_path} size={46} />
              <View style={{ marginLeft: 14 }}>
                <Text style={styles.name}>{name}</Text>
                {item.nickname ? <Text style={styles.nick}>@{item.nickname}</Text> : null}
              </View>
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
  empty: { textAlign: 'center', color: '#8a8f98', marginTop: 40, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { backgroundColor: '#f2f4f7' },
  name: { fontSize: 17, fontWeight: '500', color: '#111' },
  nick: { fontSize: 14, color: '#8a8f98', marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 76 },
});