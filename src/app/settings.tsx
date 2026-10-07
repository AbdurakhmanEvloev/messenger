import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomBubble from '../components/BottomBubble';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#111', paddingHorizontal: 16, marginBottom: 12 }}>
        Настройки
      </Text>

      <Pressable
        onPress={() => router.push('/chat-settings')}
        style={({ pressed }) => ({
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: pressed ? '#f2f4f7' : '#fff',
        })}
      >
        <Text style={{ fontSize: 17, color: '#111' }}>Настройки чатов</Text>
        <Text style={{ fontSize: 22, color: '#8a8f98' }}>›</Text>
      </Pressable>

      <BottomBubble active="settings" />
    </View>
  );
}