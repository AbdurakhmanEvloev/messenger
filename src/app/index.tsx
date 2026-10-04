// src/app/index.tsx — вход и регистрация (полный файл)
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

// Переводим ошибки Supabase на понятный русский
function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверная почта или пароль';
  if (m.includes('email not confirmed')) return 'Почта не подтверждена. Откройте письмо и перейдите по ссылке';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Эта почта уже зарегистрирована. Нажмите «Вход» и войдите';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Слишком много попыток. Подождите минуту и попробуйте снова';
  if (m.includes('network') || m.includes('fetch')) return 'Нет соединения с интернетом';
  if (m.includes('password') && m.includes('at least')) return 'Пароль должен быть не короче 6 символов';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Проверьте адрес почты';
  return message;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function Index() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const password2Ref = useRef<TextInput>(null);

  // Если человек уже входил раньше, сразу открываем чаты
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/chats');
      else setChecking(false);
    });
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword2('');
  };

  const submit = async () => {
    if (loading) return;
    setError(null);
    setInfo(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) return setError('Введите правильный адрес почты');
    if (password.length < 6) return setError('Пароль должен быть не короче 6 символов');
    if (mode === 'signup' && password !== password2) return setError('Пароли не совпадают');

    setLoading(true);
    try {
      const creds = { email: cleanEmail, password };
      const { data, error: err } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword(creds)
          : await supabase.auth.signUp(creds);

      if (err) {
        setError(friendlyError(err.message));
        return;
      }

      // Supabase при включённом подтверждении почты не выдаёт ошибку для уже занятой почты,
      // но возвращает пользователя без «identities»
      if (mode === 'signup' && data.user && data.user.identities && data.user.identities.length === 0) {
        setError('Эта почта уже зарегистрирована. Нажмите «Вход» и войдите');
        return;
      }

      if (data.session) {
        router.replace('/chats');
      } else {
        // Включено подтверждение почты
        setMode('login');
        setPassword('');
        setPassword2('');
        setInfo(`Мы отправили письмо на ${cleanEmail}. Подтвердите почту по ссылке и войдите.`);
      }
    } catch (e: any) {
      setError(friendlyError(String(e?.message ?? e)));
    } finally {
      setLoading(false);
    }
  };

  // Пока проверяем, входил ли человек раньше, показываем пустой экран, чтобы форма не мигала
  if (checking) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>💬</Text>
        </View>
        <Text style={styles.appName}>Мессенджер</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Войдите, чтобы продолжить' : 'Создайте аккаунт за минуту'}
        </Text>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => switchMode('login')}>
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Вход</Text>
          </Pressable>
          <Pressable style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => switchMode('signup')}>
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Регистрация</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Почта</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor="#9aa0a6"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Text style={styles.label}>Пароль</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="Не короче 6 символов"
            placeholderTextColor="#9aa0a6"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            returnKeyType={mode === 'login' ? 'go' : 'next'}
            onSubmitEditing={() => (mode === 'login' ? submit() : password2Ref.current?.focus())}
          />
          <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Text style={styles.eyeText}>{showPassword ? 'Скрыть' : 'Показать'}</Text>
          </Pressable>
        </View>

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Повторите пароль</Text>
            <TextInput
              ref={password2Ref}
              style={styles.input}
              placeholder="Ещё раз"
              placeholderTextColor="#9aa0a6"
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {info && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{info}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')} hitSlop={8}>
          <Text style={styles.link}>
            {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  splash: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoIcon: { fontSize: 40 },
  appName: { fontSize: 28, fontWeight: '700', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  tabs: { flexDirection: 'row', backgroundColor: '#f1f3f4', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#111', fontWeight: '600' },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9dde3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
    marginBottom: 14,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 90 },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 14, justifyContent: 'center' },
  eyeText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  errorBox: { backgroundColor: '#fdecec', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: '#b42318', fontSize: 14 },
  infoBox: { backgroundColor: '#e8f1ff', borderRadius: 10, padding: 12, marginBottom: 14 },
  infoText: { color: '#1d4ed8', fontSize: 14 },
  button: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 18, fontSize: 15 },
});