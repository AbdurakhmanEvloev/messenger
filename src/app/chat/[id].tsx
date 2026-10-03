import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Msg = { id: string; text: string; mine: boolean };

export default function Chat() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    { id: '1', text: 'Привет!', mine: false },
  ]);

  const send = () => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { id: String(Date.now()), text: text.trim(), mine: true }]);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: name ?? 'Чат' }} />
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text style={{ color: item.mine ? 'white' : 'black', fontSize: 16 }}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Сообщение"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  inputRow: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
});