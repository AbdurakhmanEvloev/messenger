// src/app/profile.tsx — мой профиль

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<string | null>(null);
  const [joined, setJoined] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

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
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>Профиль</Text>
        </View>

        {/* карточка с данными */}
        <View style={styles.card}>
          <Avatar name={name} path={avatarPath} size={92} />
          <Text style={styles.name}>{name}</Text>
          {nickname ? <Text style={styles.nick}>@{nickname}</Text> : null}
          {bio ? <Text style={styles.bio}>{bio}</Text> : null}
          {birthdayText ? <Text style={styles.meta}>День рождения: {birthdayText}</Text> : null}
          {joined ? <Text style={styles.meta}>Дата регистрации: {joined}</Text> : null}
        </View>

        {/* кнопки-таблетки */}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnLight, pressed && styles.pressed]}
            onPress={share}
          >
            <Text style={styles.btnLightText}>Поделиться</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnBlue, pressed && styles.pressed]}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.btnBlueText}>Изменить профиль</Text>
          </Pressable>
        </View>

        {/* меню */}
        <View style={styles.menu}>
          <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]} onPress={logout}>
            <Text style={styles.menuText}>Выйти из аккаунта</Text>
          </Pressable>
          <View style={styles.menuLine} />
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
            onPress={deleteAccount}
          >
            <Text style={styles.menuDanger}>Удалить аккаунт</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomBubble active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f9' },

  header: { paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 32, fontWeight: '800', color: '#111' },

  card: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 14 },
  nick: { fontSize: 15, color: '#5f6368', marginTop: 2 },
  bio: { fontSize: 16, color: '#111', marginTop: 12, lineHeight: 22 },
  meta: { fontSize: 14, color: '#5f6368', marginTop: 8 },

  buttons: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLight: { backgroundColor: '#fff' },
  btnLightText: { color: '#111', fontSize: 15, fontWeight: '700' },
  btnBlue: { backgroundColor: '#2563eb' },
  btnBlueText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  menu: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  menuRow: { paddingVertical: 17, paddingHorizontal: 18 },
  menuPressed: { backgroundColor: '#eef1f6' },
  menuLine: { height: StyleSheet.hairlineWidth, backgroundColor: '#e3e6ea', marginLeft: 18 },
  menuText: { fontSize: 16, color: '#111' },
  menuDanger: { fontSize: 16, color: '#dc2626' },
});