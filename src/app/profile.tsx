import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from('profiles').select('username').eq('id', data.user.id).single();
      if (p) setUsername(p.username ?? '');
    })();
  }, []);

  const save = async () => {
    const { error } = await supabase
      .from('profiles').update({ username: username.trim() }).eq('id', userId);
    Alert.alert(error ? 'Ошибка' : 'Сохранено', error?.message ?? 'Имя обновлено');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ваше имя</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />
      <Pressable style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Сохранить</Text>
      </Pressable>
      <Pressable onPress={logout}>
        <Text style={styles.logout}>Выйти из аккаунта</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  label: { fontSize: 14, color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  logout: { color: '#dc2626', textAlign: 'center', marginTop: 24, fontSize: 16 },
});