// src/components/Avatar.tsx — круглая аватарка: фото или цветной круг с буквой
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#4f46e5'];

// Цвет зависит от имени, поэтому у каждого человека он свой и не меняется
export function avatarColor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return COLORS[sum % COLORS.length];
}

// Запоминаем уже полученные ссылки, чтобы не просить их у Supabase снова и снова
const urlCache = new Map<string, { url: string; expires: number }>();

async function getAvatarUrl(path: string) {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  if (!data) return null;
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

type Props = {
  name: string;
  path?: string | null;
  size?: number;
};

export default function Avatar({ name, path, size = 48 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) {
      getAvatarUrl(path).then((u) => {
        if (active) setUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>
          {(name[0] ?? '?').toUpperCase()}
        </Text>
      )}
    </View>
  );
}