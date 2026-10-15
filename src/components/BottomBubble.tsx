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
              onPress={() => !on && router.push(t.href)}
              style={[styles.item, on && styles.itemOn]}
            >
              <Ionicons
                name={on ? t.iconOn : t.icon}
                size={24}
                color={on ? '#2a8bf2' : '#8a8f98'}
              />
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
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
  wrap: { position: 'absolute', left: 16, right: 16 },
  bubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 30,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 26,
  },
  itemOn: { backgroundColor: '#eef1f5' },
  label: { fontSize: 10, color: '#8a8f98', marginTop: 2, fontWeight: '500' },
  labelOn: { color: '#2a8bf2', fontWeight: '600' },
});