// src/app/edit-profile.tsx — страница «Изменить профиль»
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

// Имя и фамилия: только буквы, без точек, запятых, цифр и других символов
const NAME_CHARS = /[^A-Za-zА-Яа-яЁё]/g;
const NAME_RE = /^[A-Za-zА-Яа-яЁё]{2,30}$/;

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
      {!last && <View style={styles.line} />}
    </>
  );
}

export default function EditProfile() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [bd, setBd] = useState('');
  const [bm, setBm] = useState('');
  const [by, setBy] = useState('');
  const [userId, setUserId] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from('profiles')
        .select('username, avatar_path, bio, nickname, birthday')
        .eq('id', data.user.id)
        .single();
      if (p) {
        // В базе имя и фамилия лежат вместе: «Имя Фамилия»
        const full = String(p.username ?? '').trim();
        const space = full.indexOf(' ');
        if (space === -1) {
          setFirstName(full);
          setLastName('');
        } else {
          setFirstName(full.slice(0, space));
          setLastName(full.slice(space + 1).trim());
        }
        setAvatarPath(p.avatar_path ?? null);
        setBio(p.bio ?? '');
        setNickname(p.nickname ?? '');
        if (p.birthday) {
          const [y, m, d] = String(p.birthday).split('-');
          setBy(y);
          setBm(m);
          setBd(d);
        }
      }
    })();
  }, []);

  const save = async () => {
    if (saving) return;

    const first = capitalize(firstName.trim());
    const last = capitalize(lastName.trim());
    if (!NAME_RE.test(first)) {
      Alert.alert('Неверное имя', 'Имя: только буквы, от 2 до 30 символов. Точки, запятые и другие символы нельзя');
      return;
    }
    if (last && !NAME_RE.test(last)) {
      Alert.alert('Неверная фамилия', 'Фамилия: только буквы, от 2 до 30 символов. Точки, запятые и другие символы нельзя');
      return;
    }
    const name = last ? first + ' ' + last : first;

    const nick = nickname.trim().toLowerCase();
    if (nick && !/^[a-z0-9_]{3,20}$/.test(nick)) {
      Alert.alert('Неверный ник', 'Ник: от 3 до 20 символов, только латинские буквы, цифры и _');
      return;
    }

    let birthday: string | null = null;
    if (bd || bm || by) {
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
      if (!valid) {
        Alert.alert('Неверная дата', 'Проверьте день рождения: день, месяц и год (например 05 / 03 / 1998)');
        return;
      }
      birthday = by + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: name, bio: bio.trim(), nickname: nick || null, birthday })
      .eq('id', userId);
    setSaving(false);

    if (error?.code === '23505') {
      Alert.alert('Ник занят', 'Такой ник уже используется. Выберите другой');
      return;
    }
    if (error) {
      Alert.alert('Ошибка', error.message);
      return;
    }
    router.back();
  };

  // Выбрать фото, обрезать до квадрата и загрузить как аватарку
  const changeAvatar = async () => {
    if (!userId || uploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : 'jpg';

      const base64 = await new File(asset.uri).base64();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (bytes.length < 500) throw new Error('Файл фото пустой');

      // Папка = id пользователя: так требует правило безопасности бакета avatars
      const path = userId + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, bytes.buffer, { contentType: mime });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
      if (updErr) throw updErr;

      const old = avatarPath;
      setAvatarPath(path);
      if (old) await supabase.storage.from('avatars').remove([old]);
    } catch (e: any) {
      Alert.alert('Не удалось сменить фото', String(e?.message ?? e));
    } finally {
      setUploading(false);
    }
  };

  const digits = (t: string) => t.replace(/[^0-9]/g, '');
  const shownName = (firstName + ' ' + lastName).trim() || '?';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Изменить профиль',
          headerRight: () => (
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              {saving ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.headerSave}>Сохранить</Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Аватар */}
        <View style={styles.avatarWrap}>
          <Pressable style={styles.avatarBox} onPress={changeAvatar} disabled={uploading}>
            <Avatar name={shownName} path={avatarPath} size={96} />
            <View style={styles.avatarOverlay}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Image source={require('../../assets/icons/camera.png')} style={styles.cameraIcon} />
              )}
            </View>
          </Pressable>
          <Pressable onPress={changeAvatar} disabled={uploading} hitSlop={8}>
            <Text style={styles.changePhoto}>Изменить фото</Text>
          </Pressable>
        </View>

        {/* Имя, фамилия, ник */}
        <View style={styles.card}>
          <Row label="Имя">
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={(t) => setFirstName(t.replace(NAME_CHARS, ''))}
              placeholder="Анна"
              placeholderTextColor="#9aa0a6"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
          </Row>
          <Row label="Фамилия">
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={(t) => setLastName(t.replace(NAME_CHARS, ''))}
              placeholder="Иванова"
              placeholderTextColor="#9aa0a6"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
          </Row>
          <Row label="Ник" last>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, styles.nickInput]}
              value={nickname}
              onChangeText={(t) => setNickname(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
              placeholder="nickname"
              placeholderTextColor="#9aa0a6"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
          </Row>
        </View>
        <Text style={styles.hint}>
          Имя и фамилия — только буквы. Ник: от 3 до 20 символов, латиница, цифры и «_».
        </Text>

        {/* День рождения */}
        <View style={styles.card}>
          <Row label="Дата рождения" last>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateSmall]}
                value={bd}
                onChangeText={(t) => setBd(digits(t))}
                placeholder="ДД"
                placeholderTextColor="#9aa0a6"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dateDot}>/</Text>
              <TextInput
                style={[styles.input, styles.dateSmall]}
                value={bm}
                onChangeText={(t) => setBm(digits(t))}
                placeholder="ММ"
                placeholderTextColor="#9aa0a6"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dateDot}>/</Text>
              <TextInput
                style={[styles.input, styles.dateYear]}
                value={by}
                onChangeText={(t) => setBy(digits(t))}
                placeholder="ГГГГ"
                placeholderTextColor="#9aa0a6"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </Row>
        </View>
        <Text style={styles.hint}>Оставьте пустым, если не хотите показывать</Text>

        {/* О себе */}
        <View style={styles.card}>
          <View style={styles.bioBox}>
            <Text style={styles.bioLabel}>О себе</Text>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Расскажите о себе"
              placeholderTextColor="#9aa0a6"
              maxLength={200}
              multiline
            />
            <Text style={styles.counter}>{bio.length}/200</Text>
          </View>
        </View>

        {/* Кнопка сохранить */}
        <Pressable
          style={({ pressed }) => [styles.button, (pressed || saving) && styles.buttonPressed]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Сохранить</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 60 },
  headerSave: { fontSize: 16, fontWeight: '700', color: '#2563eb' },

  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatarBox: { width: 96, height: 96 },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: { width: 28, height: 28, tintColor: '#fff' },
  changePhoto: { color: '#2563eb', fontSize: 15, fontWeight: '600', marginTop: 12 },

  // Серые блоки со строками, как в профиле и при регистрации
  card: { backgroundColor: '#f2f4f7', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  rowLabel: { width: 112, fontSize: 16, color: '#111', fontWeight: '500' },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: '#d9dde3', marginLeft: 16 },
  input: { flex: 1, fontSize: 16, color: '#111', paddingVertical: 14 },
  at: { fontSize: 16, color: '#8a8f98', marginRight: 2 },
  nickInput: { flex: 1 },
  hint: { fontSize: 13, color: '#8a8f98', marginBottom: 18, marginHorizontal: 6 },

  dateRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dateSmall: { flex: 0, width: 40, textAlign: 'center' },
  dateYear: { flex: 0, width: 64, textAlign: 'center' },
  dateDot: { color: '#9aa0a6', fontSize: 16, marginHorizontal: 4 },

  bioBox: { paddingHorizontal: 16, paddingVertical: 12 },
  bioLabel: { fontSize: 13, color: '#8a8f98', marginBottom: 4 },
  bioInput: { fontSize: 16, color: '#111', minHeight: 70, textAlignVertical: 'top', paddingVertical: 4 },
  counter: { fontSize: 12, color: '#8a8f98', textAlign: 'right', marginTop: 4 },

  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
