import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Users() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', u.user?.id ?? '');
      setUsers(data ?? []);
    })();
  }, []);

  const open = async (id: string, name: string) => {
    const { data, error } = await supabase.rpc('start_chat', { other: id });
    if (error) return Alert.alert('Ошибка', error.message);
    router.replace(`/chat/${data}?name=${encodeURIComponent(name)}`);
  };

  return (
    <FlatList
      data={users}
      keyExtractor={(i) => i.id}
      ListEmptyComponent={<Text style={styles.empty}>Других пользователей пока нет</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => open(item.id, item.username ?? 'Без имени')}>
          <Text style={styles.name}>{item.username ?? 'Без имени'}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16 },
});