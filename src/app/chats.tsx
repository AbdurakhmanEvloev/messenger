import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

const CHATS = [
  { id: '1', name: 'Анна', last: 'Привет! Как дела?', time: '12:40' },
  { id: '2', name: 'Рабочая группа', last: 'Встреча в 15:00', time: '11:05' },
  { id: '3', name: 'Мама', last: 'Не забудь позвонить', time: 'Вчера' },
];

export default function Chats() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <FlatList
        data={CHATS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/chat/${item.id}?name=${item.name}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.last}>{item.last}</Text>
            </View>
            <Text style={styles.time}>{item.time}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 20, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600' },
  last: { color: '#666', marginTop: 2 },
  time: { color: '#999', fontSize: 12 },
});