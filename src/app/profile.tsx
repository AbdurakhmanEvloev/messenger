// src/app/profile.tsx — мой профиль
import { useFocusEffect, useRouter } from 'expo-router';
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

// Строка внутри серого блока: слева подпись, справа значение
function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {!last && <View style={styles.line} />}
    </>
  );
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

  // Обновляем данные каждый раз, когда возвращаемся на экран (например, после редактирования)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;

        setJoined(
          new Date(user.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        );

        const { data: p } = await supabase
          .from('profiles')
          .select('username, avatar_path, bio, nickname, birthday')
          .eq('id', user.id)
          .maybeSingle();

        // Имя и ник, введённые при регистрации, лежат в данных аккаунта
        const meta = (user.user_metadata ?? {}) as Record<string, any>;
        const metaName = typeof meta.username === 'string' ? meta.username.trim() : '';
        const metaNick = typeof meta.nickname === 'string' ? meta.nickname.trim() : '';

        let uname: string = p?.username ?? '';
        let nick: string = p?.nickname ?? '';

        // Если в профиле пусто или стоит почта, подставляем имя и ник из регистрации
        const nameIsDefault = !uname || uname.includes('@') || uname === user.email;
        const patch: { id: string; username?: string; nickname?: string } = { id: user.id };

        if (nameIsDefault && metaName) {
          uname = metaName;
          patch.username = metaName;
        }
        if (!nick && metaNick) {
          nick = metaNick;
          patch.nickname = metaNick;
        }
        if (patch.username || patch.nickname) {
          const { error } = await supabase.from('profiles').upsert(patch);
          if (error) console.log('[PROFILE] не удалось обновить профиль:', error.message);
        }

        setUsername(uname);
        setNickname(nick);
        setAvatarPath(p?.avatar_path ?? null);
        setBio(p?.bio ?? '');
        setBirthday(p?.birthday ?? null);
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Шапка: аватар, имя, ник */}
        <View style={styles.header}>
          <Avatar name={name} path={avatarPath} size={96} />
          <Text style={styles.name}>{name}</Text>
          {nickname ? <Text style={styles.nick}>@{nickname}</Text> : null}
          {bio ? <Text style={styles.bio}>{bio}</Text> : null}
        </View>

        {/* Кнопки */}
        <View style={styles.buttons}>
          <Pressable style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.7 }]} onPress={share}>
            <Text style={styles.btnOutlineText}>Поделиться</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnFilled, pressed && { opacity: 0.75 }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.btnFilledText}>Изменить профиль</Text>
          </Pressable>
        </View>

        {/* Информация */}
        {(birthdayText || joined) && (
          <View style={styles.card}>
            {birthdayText ? (
              <InfoRow label="День рождения" value={birthdayText} last={!joined} />
            ) : null}
            {joined ? <InfoRow label="Регистрация" value={joined} last /> : null}
          </View>
        )}

        {/* Меню */}
        <View style={styles.card}>
          <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]} onPress={logout}>
            <Text style={styles.menuText}>Выйти из аккаунта</Text>
          </Pressable>
          <View style={styles.line} />
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
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
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingBottom: 120 },

  header: { alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '800', color: '#111', marginTop: 14, textAlign: 'center' },
  nick: { fontSize: 15, color: '#8a8f98', marginTop: 2 },
  bio: { fontSize: 15, color: '#333', marginTop: 12, lineHeight: 21, textAlign: 'center' },

  buttons: { flexDirection: 'row', gap: 10, marginTop: 22, marginBottom: 20 },
  btnOutline: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#cfd4da',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: '#111', fontSize: 15, fontWeight: '700' },
  btnFilled: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFilledText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Серые блоки со строками
  card: { backgroundColor: '#f2f4f7', borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: '#d9dde3', marginLeft: 16 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  infoLabel: { fontSize: 16, color: '#111', fontWeight: '500' },
  infoValue: { fontSize: 16, color: '#8a8f98', marginLeft: 16, flexShrink: 1 },

  menuRow: { paddingVertical: 15, paddingHorizontal: 16 },
  menuRowPressed: { backgroundColor: '#e8ebef' },
  menuText: { fontSize: 16, color: '#111' },
  menuDanger: { fontSize: 16, color: '#dc2626' },
});
