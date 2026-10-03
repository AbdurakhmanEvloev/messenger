import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Msg = { id: string; text: string; sender_id: string };

export default function Chat() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const list = useRef<FlatList<Msg>>(null);

  const add = (m: Msg) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ''));

    supabase
      .from('messages')
      .select('id, text, sender_id')
      .eq('chat_id', id)
      .order('created_at')
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel('chat-' + id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload) => add(payload.new as Msg)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    const { data } = await supabase
      .from('messages')
      .insert({ chat_id: id, text: t })
      .select('id, text, sender_id')
      .single();
    if (data) add(data);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: name ?? 'Чат' }} />
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={{ color: mine ? 'white' : 'black', fontSize: 16 }}>{item.text}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Сообщение" value={text} onChangeText={setText} />
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