import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { clearChatBg, getChatBg, setChatBg } from '../lib/chat-bg';

export default function ChatSettings() {
  const [bg, setBg] = useState<string | null>(null);

  useEffect(() => {
    getChatBg().then(setBg);
  }, []);

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = await setChatBg(result.assets[0].uri);
      setBg(uri);
    } catch (e: any) {
      Alert.alert('Не удалось выбрать фон', String(e?.message ?? e));
    }
  };

  const reset = async () => {
    await clearChatBg();
    setBg(null);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Настройки чатов' }} />

      <Text style={styles.label}>Фон чата</Text>
      <View style={styles.preview}>
        {bg ? (
          <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={styles.previewEmpty}>Белый фон</Text>
        )}
      </View>

      <Pressable style={styles.btn} onPress={pick}>
        <Text style={styles.btnText}>Выбрать из галереи</Text>
      </Pressable>

      {bg && (
        <Pressable style={[styles.btn, styles.btnLight]} onPress={reset}>
          <Text style={[styles.btnText, { color: '#2f80ed' }]}>Сбросить фон</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  label: { fontSize: 15, color: '#8a8f98', marginBottom: 8 },
  preview: {
    height: 220,
    borderRadius: 16,
    backgroundColor: '#f1f3f4',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewEmpty: { color: '#8a8f98' },
  btn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnLight: { backgroundColor: '#eaf2fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});