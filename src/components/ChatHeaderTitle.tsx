// src/components/ChatHeaderTitle.tsx — аватарка и имя собеседника в шапке чата
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';

export default function ChatHeaderTitle({ chatId, name }: { chatId: string; name: string }) {
  const router = useRouter();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('chat_members')
        .select('profiles(avatar_path)')
        .eq('chat_id', chatId)
        .neq('user_id', u.user?.id ?? '')
        .limit(1)
        .single();
      setAvatarPath((data as any)?.profiles?.avatar_path ?? null);
    })();
  }, [chatId]);

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/user/${chatId}`)}>
      <Avatar name={name} path={avatarPath} size={36} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 240 },
  name: { fontSize: 17, fontWeight: '600', color: '#111', flexShrink: 1 },
});