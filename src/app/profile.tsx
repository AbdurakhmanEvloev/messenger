// src/app/profile.tsx — мой профиль в стиле X
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import BottomBubble from '../components/BottomBubble';
import { supabase } from '../lib/supabase';

function formatBirthday(s: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function Profile() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<string | null>(null);
  const [joined, setJoined] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  // Обновляем данные каждый раз, когда возвращаемся на экран (например, после редактирования)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        setJoined(
          new Date(data.user.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        );
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
          setBirthday(p.birthday ?? null);
        }
      })();
    }, []),
  );

  const share = async () => {
    const who = nickname ? '@' + nickname : username;
    try {
      await Share.share({ message: 'Я в мессенджере: ' + who });
    } catch {}
  };

  // Выход с подтверждением
  const logout = () => {
    Alert.alert('Выйти из аккаунта?', 'Чтобы снова войти, понадобится почта и пароль', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/');
        },
      },
    ]);
  };

  // Удаление аккаунта: два подтверждения
  const deleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт?',
      'Профиль, ваши сообщения и список друзей будут удалены навсегда. Отменить это нельзя.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Вы уверены?', 'Это последнее подтверждение. Аккаунт будет удалён сразу.', [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить навсегда',
                style: 'destructive',
                onPress: async () => {
                  if (avatarPath) {
                    await supabase.storage.from('avatars').remove([avatarPath]);
                  }
                  const { error } = await supabase.rpc('delete_my_account');
                  if (error) {
                    Alert.alert('Не удалось удалить аккаунт', error.message);
                    return;
                  }
                  await supabase.auth.signOut();
                  router.replace('/');
                },
              },
            ]),
        },
      ],
    );
  };

  const name = username || 'Без имени';
  const birthdayText = formatBirthday(birthday);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Avatar name={name} path={avatarPath} size={92} />

        <Text style={styles.name}>{name}</Text>
        {nickname ? <Text style={styles.nick}>@{nickname}</Text> : null}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
        {birthdayText ? <Text style={styles.joined}>День рождения: {birthdayText}</Text> : null}
        {joined ? <Text style={styles.joined}>Дата регистрации: {joined}</Text> : null}

        <View style={styles.buttons}>
          <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]} onPress={share}>
            <Text style={styles.btnText}>Поделиться</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.btnText}>Изменить профиль</Text>
          </Pressable>
        </View>

        <View style={styles.menu}>
          <Pressable style={styles.menuRow} onPress={logout}>
            <Text style={styles.menuText}>Выйти из аккаунта</Text>
          </Pressable>
          <View style={styles.menuLine} />
          <Pressable style={styles.menuRow} onPress={deleteAccount}>
            <Text style={styles.menuDanger}>Удалить аккаунт</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomBubble active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 120 },
  name: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 14 },
  nick: { fontSize: 15, color: '#8a8f98', marginTop: 1 },
  bio: { fontSize: 16, color: '#111', marginTop: 12, lineHeight: 22 },
  joined: { fontSize: 14, color: '#8a8f98', marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#cfd4da',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#111', fontSize: 15, fontWeight: '700' },
  menu: { backgroundColor: '#f2f4f7', borderRadius: 14, marginTop: 32 },
  menuRow: { paddingVertical: 15, paddingHorizontal: 16 },
  menuLine: { height: StyleSheet.hairlineWidth, backgroundColor: '#d9dde3', marginLeft: 16 },
  menuText: { fontSize: 16, color: '#111' },
  menuDanger: { fontSize: 16, color: '#dc2626' },
});