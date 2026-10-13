// src/app/settings.tsx — настройки
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BottomBubble from '../components/BottomBubble';

export default function Settings() {
  const router = useRouter();

  const soon = () => Alert.alert('Скоро', 'Этот раздел появится позже');

  const items = [
    { title: 'Настройки чатов', onPress: () => router.push('/chat-settings') },
    { title: 'Уведомления', onPress: soon },
    { title: 'Данные и загрузки', onPress: soon },
    { title: 'Язык', onPress: soon },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text allowFontScaling={false} style={styles.title}>
          Настройки
        </Text>

        <View style={styles.menu}>
          {items.map((item, i) => (
            <View key={item.title}>
              {i > 0 ? <View style={styles.line} /> : null}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                onPress={item.onPress}
              >
                <Text allowFontScaling={false} style={styles.rowText}>
                  {item.title}
                </Text>
                <Text allowFontScaling={false} style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomBubble active="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 36, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 14 },
  menu: { backgroundColor: '#f3f4f7', borderRadius: 20, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowText: { fontSize: 16, color: '#111' },
  chevron: { fontSize: 22, color: '#8a8f98', lineHeight: 22 },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: '#d9dde3' },
});