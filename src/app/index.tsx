import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Index() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Если человек уже входил раньше, сразу открываем чаты
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/chats');
    });
  }, []);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Проверьте данные', 'Нужен email и пароль от 6 символов');
      return;
    }
    setLoading(true);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp(creds);
    setLoading(false);

    if (error) {
      Alert.alert('Ошибка', error.message);
      return;
    }
    if (data.session) {
      router.replace('/chats');
    } else {
      Alert.alert('Почти готово', 'Подтвердите email по ссылке из письма');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === 'login' ? 'Вход' : 'Регистрация'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль (от 6 символов)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</Text>
        )}
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.link}>
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 16, fontSize: 15 },
});