// src/app/user/[id].tsx — профиль собеседника
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import { supabase } from '../../lib/supabase';

type Peer = { username: string | null; avatar_path: string | null; bio: string | null };

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('username, avatar_path, bio')
        .eq('id', String(id))
        .single();
      if (err) setError(err.message);
      else setPeer(data as Peer);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (error || !peer) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? 'Профиль не найден'}</Text>
      </View>
    );
  }

  const name = peer.username || 'Без имени';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Avatar name={name} path={peer.avatar_path} size={120} />
      <Text style={styles.name}>{name}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>О себе</Text>
        <Text style={peer.bio ? styles.bio : styles.muted}>
          {peer.bio || 'Пока ничего не рассказал о себе'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f7' },
  container: { padding: 24, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f4f7', padding: 24 },
  name: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 14, marginBottom: 24 },
  card: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  bio: { fontSize: 16, color: '#111' },
  muted: { fontSize: 16, color: '#8a8f98' },
});