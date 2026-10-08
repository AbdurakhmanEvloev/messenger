// src/app/index.tsx — вход и регистрация
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
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

// Имя и фамилия: только буквы, без точек, запятых, цифр и других символов
const NAME_CHARS = /[^A-Za-zА-Яа-яЁё]/g;
const NAME_RE = /^[A-Za-zА-Яа-яЁё]{2,30}$/;
// Ник: латиница, цифры и _
const NICK_CHARS = /[^A-Za-z0-9_]/g;
const NICK_RE = /^[A-Za-z0-9_]{3,20}$/;

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Строка внутри серого блока: слева подпись, справа поле
function Row({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        {children}
      </View>
      {!last && <View style={styles.rowLine} />}
    </>
  );
}

export default function Index() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const lastNameRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
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
    const cleanFirst = capitalize(firstName.trim());
    const cleanLast = capitalize(lastName.trim());
    const cleanNick = nickname.trim();

    if (mode === 'signup') {
      if (!NAME_RE.test(cleanFirst))
        return setError('Имя: только буквы, от 2 до 30 символов. Точки, запятые и другие символы нельзя');
      if (!NAME_RE.test(cleanLast))
        return setError('Фамилия: только буквы, от 2 до 30 символов. Точки, запятые и другие символы нельзя');
      if (!NICK_RE.test(cleanNick))
        return setError('Ник: от 3 до 20 символов, только латинские буквы, цифры и _');
    }

    if (!isEmail(cleanEmail)) return setError('Введите правильный адрес почты');
    if (password.length < 6) return setError('Пароль должен быть не короче 6 символов');
    if (mode === 'signup' && password !== password2) return setError('Пароли не совпадают');

    setLoading(true);
    try {
      const fullName = `${cleanFirst} ${cleanLast}`;

      const { data, error: err } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
          : await supabase.auth.signUp({
              email: cleanEmail,
              password,
              // Имя и ник сохраняем вместе с аккаунтом, чтобы они не потерялись,
              // даже если сначала нужно подтвердить почту
              options: {
                data: {
                  first_name: cleanFirst,
                  last_name: cleanLast,
                  username: fullName,
                  nickname: cleanNick,
                },
              },
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
        // Сразу записываем имя и ник в профиль (вместо почты по умолчанию)
        if (mode === 'signup' && data.user) {
          const { error: pErr } = await supabase
            .from('profiles')
            .upsert({ id: data.user.id, username: fullName, nickname: cleanNick });
          if (pErr) console.log('[SIGNUP] профиль:', pErr.message);
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

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>💬</Text>
        </View>
        <Text style={styles.appName}>Мессенджер</Text>
        <Text style={styles.subtitle}>
          {isSignup ? 'Создайте аккаунт за минуту' : 'Войдите, чтобы продолжить'}
        </Text>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, !isSignup && styles.tabActive]} onPress={() => switchMode('login')}>
            <Text style={[styles.tabText, !isSignup && styles.tabTextActive]}>Вход</Text>
          </Pressable>
          <Pressable style={[styles.tab, isSignup && styles.tabActive]} onPress={() => switchMode('signup')}>
            <Text style={[styles.tabText, isSignup && styles.tabTextActive]}>Регистрация</Text>
          </Pressable>
        </View>

        {isSignup && (
          <>
            <View style={styles.card}>
              <Row label="Имя">
                <TextInput
                  style={styles.input}
                  
                  placeholderTextColor="#9aa0a6"
                  value={firstName}
                  onChangeText={(t) => setFirstName(t.replace(NAME_CHARS, ''))}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={30}
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </Row>
              <Row label="Фамилия">
                <TextInput
                  ref={lastNameRef}
                  style={styles.input}
                 
                  placeholderTextColor="#9aa0a6"
                  value={lastName}
                  onChangeText={(t) => setLastName(t.replace(NAME_CHARS, ''))}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={30}
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => nicknameRef.current?.focus()}
                />
              </Row>
              <Row label="Ник" last>
                <TextInput
                  ref={nicknameRef}
                  style={styles.input}
                  placeholder="anna_ivanova"
                  placeholderTextColor="#9aa0a6"
                  value={nickname}
                  onChangeText={(t) => setNickname(t.replace(NICK_CHARS, ''))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </Row>
            </View>
            <Text style={styles.hint}>
              Имя и фамилия — только буквы. Ник — латиница, цифры и «_».
            </Text>
          </>
        )}

        <View style={styles.card}>
          <Row label="Почта">
            <TextInput
              ref={emailRef}
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
          </Row>
          <Row label="Пароль" last={!isSignup}>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Не короче 6 символов"
              placeholderTextColor="#9aa0a6"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isSignup ? 'newPassword' : 'password'}
              returnKeyType={isSignup ? 'next' : 'go'}
              onSubmitEditing={() => (isSignup ? password2Ref.current?.focus() : submit())}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Text style={styles.eyeText}>{showPassword ? 'Скрыть' : 'Показать'}</Text>
            </Pressable>
          </Row>
          {isSignup && (
            <Row label="Повтор" last>
              <TextInput
                ref={password2Ref}
                style={styles.input}
                placeholder="Пароль ещё раз"
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
            </Row>
          )}
        </View>

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
            <Text style={styles.buttonText}>{isSignup ? 'Создать аккаунт' : 'Войти'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => switchMode(isSignup ? 'login' : 'signup')} hitSlop={8}>
          <Text style={styles.link}>
            {isSignup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  splash: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 40 },

  logo: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoIcon: { fontSize: 38 },
  appName: { fontSize: 26, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#8a8f98', textAlign: 'center', marginTop: 4, marginBottom: 24 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f2f4f7',
    borderRadius: 22,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, height: 38, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontSize: 15, color: '#8a8f98', fontWeight: '600' },
  tabTextActive: { color: '#111', fontWeight: '700' },

  // Серый блок со строками, как меню в профиле
  card: { backgroundColor: '#f2f4f7', borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  rowLabel: { width: 96, fontSize: 16, color: '#111', fontWeight: '500' },
  rowLine: { height: StyleSheet.hairlineWidth, backgroundColor: '#d9dde3', marginLeft: 16 },
  input: { flex: 1, fontSize: 16, color: '#111', paddingVertical: 14 },
  eyeText: { color: '#2563eb', fontSize: 14, fontWeight: '600', marginLeft: 10 },
  hint: { fontSize: 13, color: '#8a8f98', marginTop: -8, marginBottom: 16, marginHorizontal: 6 },

  errorBox: { backgroundColor: '#fdecec', borderRadius: 14, padding: 14, marginBottom: 16 },
  errorText: { color: '#b42318', fontSize: 14, lineHeight: 20 },
  infoBox: { backgroundColor: '#e8f1ff', borderRadius: 14, padding: 14, marginBottom: 16 },
  infoText: { color: '#1d4ed8', fontSize: 14, lineHeight: 20 },

  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 18, fontSize: 15, fontWeight: '500' },
});
