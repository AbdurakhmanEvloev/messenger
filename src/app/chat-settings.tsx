// src/app/chat-settings.tsx — настройки чатов: фон чата
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { clearWallpaper, getWallpaper, saveWallpaper } from '../lib/wallpaper';

export default function ChatSettings() {
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getWallpaper().then(setWallpaper);
  }, []);

  const pick = async () => {
    if (busy) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setBusy(true);
      const uri = await saveWallpaper(result.assets[0].uri);
      setWallpaper(uri);
    } catch (e: any) {
      Alert.alert('Не удалось поставить фон', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    await clearWallpaper();
    setWallpaper(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Настройки чатов' }} />

      <Text allowFontScaling={false} style={styles.label}>
        Фон чата
      </Text>

      <View style={styles.preview}>
        {wallpaper ? (
          <Image source={{ uri: wallpaper }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}

        <View style={[styles.bubble, styles.bubbleTheirs]}>
          <View style={styles.quote}>
            <Text allowFontScaling={false} style={styles.quoteName}>
              А Е
            </Text>
            <Text allowFontScaling={false} style={styles.quoteText}>
              Доброе утро! 👋
            </Text>
          </View>
          <View style={styles.textRow}>
            <Text allowFontScaling={false} style={styles.msgText}>
              Знаешь, который час?
            </Text>
            <Text allowFontScaling={false} style={styles.time}>
              20:15
            </Text>
          </View>
        </View>

        <View style={[styles.bubble, styles.bubbleMine]}>
          <View style={styles.textRow}>
            <Text allowFontScaling={false} style={styles.msgText}>
              В Токио утро 😎
            </Text>
            <Text allowFontScaling={false} style={styles.time}>
              20:30
            </Text>
            <Image source={require('../../assets/icons/tick_all.png')} style={styles.tick} />
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnFilled, (pressed || busy) && { opacity: 0.8 }]}
        onPress={pick}
        disabled={busy}
      >
        <Text allowFontScaling={false} style={styles.btnFilledText}>
          Выбрать из галереи
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnLight, pressed && { opacity: 0.8 }]}
        onPress={reset}
        disabled={busy}
      >
        <Text allowFontScaling={false} style={styles.btnLightText}>
          Сбросить фон
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, color: '#8a8f98', marginTop: 4, marginBottom: 8 },

  preview: {
    width: '100%',
    aspectRatio: 1.7,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#f7f4f5',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  bubble: { maxWidth: '84%', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#477fe8', borderBottomRightRadius: 4 },

  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#4a9fb5',
    backgroundColor: '#e8f1f4',
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  quoteName: { fontSize: 11, fontWeight: '700', color: '#4a9fb5' },
  quoteText: { fontSize: 12, color: '#272727', marginTop: 1 },

  textRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' },
  msgText: { fontSize: 13, color: '#111010' },
  time: { fontSize: 10, color: '#ffffff', marginBottom: 1 },
  tick: { width: 15, height: 11, tintColor: '#477fe8', marginBottom: 2 },

  btn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnFilled: { backgroundColor: '#3f7be8' },
  btnFilledText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnLight: { backgroundColor: '#e9f0fd' },
  btnLightText: { color: '#3f7be8', fontSize: 14, fontWeight: '700' },
});