import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

function parseParams(s: string) {
  const out: Record<string, string> = {};
  s.split('&').forEach((p) => {
    if (!p) return;
    const [k, v = ''] = p.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return out;
}

// Сюда приходит человек по ссылке из письма
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    (async () => {
      try {
        const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
        const hash = url.includes('#') ? url.split('#')[1] : '';
        const q = parseParams(query);
        const h = parseParams(hash);

        if (q.error || h.error) throw new Error('link');

        if (q.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(q.code);
          if (error) throw error;
        } else if (h.access_token && h.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: h.access_token,
            refresh_token: h.refresh_token,
          });
          if (error) throw error;
        } else {
          throw new Error('no tokens');
        }
        router.replace('/chats');
      } catch {
        setFailed(true);
      }
    })();
  }, [url]);

  if (failed) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Ссылка не сработала</Text>
        <Text style={styles.text}>Возможно, она устарела или уже использована. Попробуйте войти с почтой и паролем.</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Перейти ко входу</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <ActivityIndicator color="#2563eb" size="large" />
      <Text style={[styles.text, { marginTop: 14 }]}>Подтверждаем почту…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8 },
  text: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});