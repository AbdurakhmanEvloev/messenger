import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="chats" options={{ title: 'Чаты' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Чат' }} />
    </Stack>
  );
}