// src/app/index.tsx — вход и регистрация (полный файл)
// Дизайн как в остальном приложении: белый фон, поля с линией снизу, синий акцент #2563eb
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const NAME_RE = /^[A-Za-zА-Яа-яЁё]+( [A-Za-zА-Яа-яЁё]+)*$/;
const NICK_RE = /^[a-z0-9_]{3,20}$/;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const digits = (t: string) => t.replace(/[^0-9]/g, '');

// Проверяем дату рождения. Возвращает «ГГГГ-ММ-ДД» или null, если дата неверная
function buildBirthday(bd: string, bm: string, by: string): string | null {
  const d = Number(bd);
  const m = Number(bm);
  const y = Number(by);
  const dt = new Date(y, m - 1, d);
  const valid =
    by.length === 4 &&
    y >= 1900 &&
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d &&
    dt <= new Date();
  if (!valid) return null;
  return by + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export default function Index() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [bd, setBd] = useState('');
  const [bm, setBm] = useState('');
  const [by, setBy] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const password2Ref = useRef<TextInput>(null);
  const bdRef = useRef<TextInput>(null);
  const bmRef = useRef<TextInput>(null);
  const byRef = useRef<TextInput>(null);

  // Если дата рождения не успела сохраниться при регистрации (например, ждали подтверждения почты),
  // сохраняем её при первом входе
  const saveBirthdayFromMeta = async (user: any) => {
    const b = user?.user_metadata?.birthday;
    if (!b) return;
    const { data: p } = await supabase.from('profiles').select('birthday').eq('id', user.id).single();
    if (p && !p.birthday) {
      await supabase.from('profiles').update({ birthday: b }).eq('id', user.id);
    }
  };

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
    if (mode === 'signup') {
      const cleanName = name.trim();
      if (!cleanName) return setError('Введите имя');
      if (cleanName.length > 25) return setError('Имя не длиннее 25 символов');
      if (!NAME_RE.test(cleanName)) return setError('Имя: только буквы и пробелы, без точек и других символов');
      if (!NICK_RE.test(nickname)) return setError('Ник: 3–20 символов, латинские буквы, цифры и _');
    }
    if (!isEmail(cleanEmail)) return setError('Введите правильный адрес почты');
    if (password.length < 6) return setError('Пароль должен быть не короче 6 символов');

    let birthday: string | null = null;
    if (mode === 'signup') {
      if (password !== password2) return setError('Пароли не совпадают');
      birthday = buildBirthday(bd, bm, by);
      if (!birthday) return setError('Проверьте дату рождения: день, месяц и год (например 05 / 03 / 1998)');
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data: free, error: nickErr } = await supabase.rpc('nickname_available', { p_nick: nickname });
        if (nickErr) {
          setError('Не удалось проверить ник. Попробуйте ещё раз');
          return;
        }
        if (!free) {
          setError('Этот ник уже занят');
          return;
        }
      }
      const creds = { email: cleanEmail, password };
      const { data, error: err } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword(creds)
          : await supabase.auth.signUp({
            ...creds,
            options: { data: { name: name.trim(), nickname, bio: bio.trim() || null } },
          });

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
        if (mode === 'signup' && data.user && birthday) {
          await supabase.from('profiles').update({ birthday }).eq('id', data.user.id);
        } else if (mode === 'login') {
          await saveBirthdayFromMeta(data.user);
        }
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
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

        <View style={styles.field}>
          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Имя</Text>
              <TextInput
                style={styles.input}
                placeholder="Как вас зовут"
                placeholderTextColor="#9aa0a6"
                value={name}
                onChangeText={(v) => setName(v.replace(/[^A-Za-zА-Яа-яЁё ]/g, '').replace(/ {2,}/g, ' '))}
                maxLength={25}
              />

              <Text style={styles.label}>Ник</Text>
              <TextInput
                style={styles.input}
                placeholder="например, abdurakhman_1"
                placeholderTextColor="#9aa0a6"
                value={nickname}
                onChangeText={(v) => setNickname(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}
          <Text style={styles.label}>Почта</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#b0b5bc"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Пароль</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="Не короче 6 символов"
              placeholderTextColor="#b0b5bc"
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
        </View>

        {mode === 'signup' && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Повторите пароль</Text>
              <TextInput
                ref={password2Ref}
                style={styles.input}
                placeholder="Ещё раз"
                placeholderTextColor="#b0b5bc"
                value={password2}
                onChangeText={setPassword2}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => bdRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>День рождения</Text>
              <View style={styles.dateRow}>
                <TextInput
                  ref={bdRef}
                  style={[styles.input, styles.dateSmall]}
                  value={bd}
                  onChangeText={(t) => {
                    const v = digits(t);
                    setBd(v);
                    if (v.length === 2) bmRef.current?.focus();
                  }}
                  placeholder="ДД"
                  placeholderTextColor="#b0b5bc"
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TextInput
                  ref={bmRef}
                  style={[styles.input, styles.dateSmall]}
                  value={bm}
                  onChangeText={(t) => {
                    const v = digits(t);
                    setBm(v);
                    if (v.length === 2) byRef.current?.focus();
                  }}
                  placeholder="ММ"
                  placeholderTextColor="#b0b5bc"
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TextInput
                  ref={byRef}
                  style={[styles.input, styles.dateYear]}
                  value={by}
                  onChangeText={(t) => setBy(digits(t))}
                  placeholder="ГГГГ"
                  placeholderTextColor="#b0b5bc"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <Text style={styles.hint}>Потом можно изменить в профиле</Text>
            </View>
          </>
        )}

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>О себе (необязательно)</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Пара слов о себе"
              placeholderTextColor="#9aa0a6"
              value={bio}
              onChangeText={setBio}
              maxLength={150}
              multiline
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
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },
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
  appName: { fontSize: 28, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#8a8f98', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  // Переключатель «Вход / Регистрация» как строка поиска в чатах
  tabs: { flexDirection: 'row', backgroundColor: '#f2f4f7', borderRadius: 24, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 15, color: '#8a8f98', fontWeight: '500' },
  tabTextActive: { color: '#111', fontWeight: '600' },
  // Поля — как в «Изменить профиль»: подпись сверху и линия снизу
  field: { marginBottom: 22 },
  label: { fontSize: 13, color: '#8a8f98', marginBottom: 2 },
  input: {
    fontSize: 17,
    color: '#111',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cfd4da',
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 90 },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  dateRow: { flexDirection: 'row', gap: 16 },
  dateSmall: { width: 56, textAlign: 'center' },
  dateYear: { width: 90, textAlign: 'center' },
  hint: { fontSize: 12, color: '#8a8f98', marginTop: 6 },
  errorBox: { backgroundColor: '#fdecec', borderRadius: 14, padding: 12, marginBottom: 16 },
  errorText: { color: '#b42318', fontSize: 14 },
  infoBox: { backgroundColor: '#e8f1ff', borderRadius: 14, padding: 12, marginBottom: 16 },
  infoText: { color: '#1d4ed8', fontSize: 14 },
  button: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 24, alignItems: 'center', marginTop: 4 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 18, fontSize: 15 },
});