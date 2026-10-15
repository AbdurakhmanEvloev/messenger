import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'chats' | 'friends' | 'settings' | 'profile';

const TABS = [
  { key: 'chats', label: 'Чаты', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', href: '/chats' },
  { key: 'friends', label: 'Друзья', icon: 'people-outline', iconOn: 'people', href: '/friends' },
  { key: 'settings', label: 'Настройки', icon: 'settings-outline', iconOn: 'settings', href: '/settings' },
  { key: 'profile', label: 'Профиль', icon: 'person-outline', iconOn: 'person', href: '/profile' },
] as const;

export default function BottomBubble({ active }: { active: Tab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}
    >
      <View style={styles.bubble}>
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Pressable
              key={t.key}
              onPress={() => !on && router.replace(t.href as any)}
              hitSlop={4}
              style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && !on && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
            >
              <Ionicons
                name={on ? t.iconOn : t.icon}
                size={22}
                color={on ? '#2a8bf2' : '#111'}
              />
              <Text
                style={[styles.label, on && styles.labelOn]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 28, right: 28 },
  bubble: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 4,
    borderWidth: 1,
    borderColor: '#d5d9de',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  itemOn: { backgroundColor: '#e8f1fe' },
  itemPressed: { backgroundColor: '#f2f4f7' },
  label: { fontSize: 10, color: '#111', marginTop: 1, fontWeight: '500' },
  labelOn: { color: '#2a8bf2', fontWeight: '600' },
});