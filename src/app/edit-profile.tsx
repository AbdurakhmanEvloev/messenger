// src/app/edit-profile.tsx — страница «Изменить профиль»
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

export default function EditProfile() {
  const router = useRouter();
  const [username, setUsername] = useState('');
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
        setUsername(p.username ?? '');
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
    const name = username.trim();
    if (!name) {
      Alert.alert('Введите имя', 'Имя не может быть пустым');
      return;
    }
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

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Изменить профиль',
          headerRight: () => (
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              {saving ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={styles.headerSave}>Сохранить</Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.avatarBox} onPress={changeAvatar} disabled={uploading}>
          <Avatar name={username || '?'} path={avatarPath} size={92} />
          <View style={styles.avatarOverlay}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Image source={require('../../assets/icons/camera.png')} style={styles.cameraIcon} />
            )}
          </View>
        </Pressable>

        <View style={styles.field}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Как вас называть"
            placeholderTextColor="#b0b5bc"
            maxLength={40}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ник</Text>
          <View style={styles.nickRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, styles.nickInput]}
              value={nickname}
              onChangeText={(t) => setNickname(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
              placeholder="nickname"
              placeholderTextColor="#b0b5bc"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
          </View>
          <Text style={styles.hint}>От 3 до 20 символов: латинские буквы, цифры и _</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>День рождения</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateSmall]}
              value={bd}
              onChangeText={(t) => setBd(digits(t))}
              placeholder="ДД"
              placeholderTextColor="#b0b5bc"
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dateSmall]}
              value={bm}
              onChangeText={(t) => setBm(digits(t))}
              placeholder="ММ"
              placeholderTextColor="#b0b5bc"
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dateYear]}
              value={by}
              onChangeText={(t) => setBy(digits(t))}
              placeholder="ГГГГ"
              placeholderTextColor="#b0b5bc"
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <Text style={styles.hint}>Оставьте пустым, если не хотите показывать</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>О себе</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Расскажите о себе"
            placeholderTextColor="#b0b5bc"
            maxLength={200}
            multiline
          />
          <Text style={styles.counter}>{bio.length}/200</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 60 },
  headerSave: { fontSize: 16, fontWeight: '700', color: '#111' },
  avatarBox: { width: 92, height: 92, marginBottom: 20 },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 46,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: { width: 28, height: 28, tintColor: '#fff' },
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
  nickRow: { flexDirection: 'row', alignItems: 'center' },
  at: { fontSize: 17, color: '#8a8f98', marginRight: 2 },
  nickInput: { flex: 1 },
  dateRow: { flexDirection: 'row', gap: 16 },
  dateSmall: { width: 56, textAlign: 'center' },
  dateYear: { width: 90, textAlign: 'center' },
  bioInput: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#8a8f98', marginTop: 6 },
  counter: { fontSize: 12, color: '#8a8f98', textAlign: 'right', marginTop: 6 },
});