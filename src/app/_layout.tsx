import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="chats"
        options={({ navigation }) => ({
          title: 'Чаты',
          headerBackVisible: false,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => navigation.navigate('users')}>
                <Text style={{ color: '#2563eb', fontSize: 16 }}>Новый</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('profile')}>
                <Text style={{ color: '#2563eb', fontSize: 16 }}>Профиль</Text>
              </Pressable>
            </View>
          ),
        })}
      />
      <Stack.Screen name="users" options={{ title: 'Новый чат' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Чат' }} />
      <Stack.Screen name="profile" options={{ title: 'Профиль' }} />
    </Stack>
  );
}