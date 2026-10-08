import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomBubble from '../components/BottomBubble';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const soon = () => Alert.alert('Скоро', 'Этот раздел скоро появится');

  const items = [
    { title: 'Настройки чатов', onPress: () => router.push('/chat-settings') },
    { title: 'Уведомления', onPress: soon },
    { title: 'Данные и загрузки', onPress: soon },
    { title: 'Язык', onPress: soon },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#111', paddingHorizontal: 16, marginBottom: 12 }}>
        Настройки
      </Text>

      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: '#f4f5f7',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.title}
            onPress={item.onPress}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: pressed ? '#e9ebef' : 'transparent',
              borderTopWidth: i === 0 ? 0 : 0.5,
              borderTopColor: '#cfd4da',
            })}
          >
            <Text style={{ fontSize: 17, color: '#111' }}>{item.title}</Text>
            <Text style={{ fontSize: 22, color: '#8a8f98' }}>›</Text>
          </Pressable>
        ))}
      </View>

      <BottomBubble active="settings" />
    </View>
  );
}