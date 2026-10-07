import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'chats' | 'friends' | 'settings' | 'profile';

const TABS = [
  { key: 'chats', label: 'Чаты', icon: require('../../assets/icons/chats.png'), href: '/chats' },
  { key: 'friends', label: 'Друзья', icon: require('../../assets/icons/friends.png'), href: '/friends' },
  { key: 'settings', label: 'Настройки', icon: require('../../assets/icons/settings.png'), href: '/settings' },
  { key: 'profile', label: 'Профиль', icon: require('../../assets/icons/profile.png'), href: '/profile' },
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
              <Image
                source={t.icon}
                style={[styles.icon, { tintColor: on ? '#2a8bf2' : '#8a8f98' }]}
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
    backgroundColor: 'rgba(255,255,255,0.9)',
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
  icon: { width: 24, height: 24, resizeMode: 'contain' },
  label: { fontSize: 10, color: '#8a8f98', marginTop: 2, fontWeight: '500' },
  labelOn: { color: '#2a8bf2', fontWeight: '600' },
});