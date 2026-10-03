// src/app/_layout.tsx — навигация приложения (полный файл)
import { Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700' },
        headerTintColor: '#2563eb',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="chats"
        options={({ navigation }) => ({
          title: 'Чаты',
          headerBackVisible: false,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('profile')} hitSlop={10}>
              <Text style={{ color: '#2563eb', fontSize: 16 }}>Профиль</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="users" options={{ title: 'Новый чат' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Чат' }} />
      <Stack.Screen name="profile" options={{ title: 'Профиль' }} />
    </Stack>
  );
}