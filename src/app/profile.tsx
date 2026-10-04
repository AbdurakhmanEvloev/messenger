// src/app/profile.tsx — профиль: аватарка, имя, о себе, выход (полный файл)
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [userId, setUserId] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from('profiles')
        .select('username, avatar_path, bio')
        .eq('id', data.user.id)
        .single();
      if (p) {
        setUsername(p.username ?? '');
        setAvatarPath(p.avatar_path ?? null);
        setBio(p.bio ?? '');
      }
    })();
  }, []);

  const save = async () => {
    const name = username.trim();
    if (!name) {
      Alert.alert('Введите имя', 'Имя не может быть пустым');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ username: name, bio: bio.trim() })
      .eq('id', userId);
    Alert.alert(error ? 'Ошибка' : 'Сохранено', error?.message ?? 'Профиль обновлён');
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
      console.log('[AVATAR] размер, байт:', bytes.length);
      if (bytes.length < 500) throw new Error('Файл фото пустой');

      // Папка = id пользователя: так требует правило безопасности бакета avatars
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, bytes.buffer, { contentType: mime });
      console.log('[AVATAR] загрузка, ошибка:', upErr?.message ?? 'нет');
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', userId);
      if (updErr) throw updErr;

      // Старую аватарку удаляем, чтобы не копились лишние файлы
      const old = avatarPath;
      setAvatarPath(path);
      if (old) await supabase.storage.from('avatars').remove([old]);
    } catch (e: any) {
      console.log('[AVATAR] ОШИБКА:', e);
      Alert.alert('Не удалось сменить фото', String(e?.message ?? e));
    } finally {
      setUploading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.avatarBox} onPress={changeAvatar} disabled={uploading}>
        <Avatar name={username || '?'} path={avatarPath} size={120} />
        {uploading && (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </Pressable>
      <Pressable onPress={changeAvatar} disabled={uploading}>
        <Text style={styles.changePhoto}>{avatarPath ? 'Изменить фото' : 'Добавить фото'}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Ваше имя</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Как вас называть"
          placeholderTextColor="#9aa0a6"
          maxLength={40}
        />

        <Text style={styles.label}>О себе (чем занимаетесь)</Text>
        <TextInput
          style={[styles.input, styles.bio]}
          value={bio}
          onChangeText={setBio}
          placeholder="Например: студент, делаю мессенджер"
          placeholderTextColor="#9aa0a6"
          multiline
          maxLength={200}
        />
        <Text style={styles.counter}>{bio.length}/200</Text>

        <Pressable style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>Сохранить</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutBox} onPress={logout}>
        <Text style={styles.logout}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f7' },
  container: { padding: 24, alignItems: 'stretch' },
  avatarBox: { alignSelf: 'center', marginTop: 8 },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { color: '#2563eb', fontSize: 16, textAlign: 'center', marginTop: 12, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9dde3',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#111',
  },
  bio: { minHeight: 100, textAlignVertical: 'top', marginBottom: 4 },
  counter: { textAlign: 'right', color: '#9aa0a6', fontSize: 12, marginBottom: 16 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 20 },
  logout: { color: '#dc2626', textAlign: 'center', fontSize: 16 },
});