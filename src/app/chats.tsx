import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Chats() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase
          .from('chat_members')
          .select('chat_id, profiles(username)')
          .neq('user_id', u.user.id);
        setChats(data ?? []);
      })();
    }, [])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.chat_id}
        ListEmptyComponent={<Text style={styles.empty}>Чатов пока нет. Нажмите «Новый».</Text>}
        renderItem={({ item }) => {
          const name = item.profiles?.username ?? 'Без имени';
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/chat/${item.chat_id}?name=${encodeURIComponent(name)}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{name}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 20, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600' },
});