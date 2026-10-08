import { Stack } from 'expo-router';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { usePresence } from '../lib/presence';

export default function Layout() {
  usePresence();
  
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerLeft: () =>
          navigation.canGoBack() ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ paddingRight: 8 }}>
              <Image
                source={require('../../assets/icons/back.png')}
                style={{ width: 30, height: 30, tintColor: '#3e4044' }}
              />
            </Pressable>
          ) : null,
      })}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="chats"
        options={({ navigation }) => ({
          title: 'Чаты',
          headerBackVisible: false,
          headerLeft: () => null,
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
      <Stack.Screen
        name="chat/[id]"
        options={{
          title: 'Чат',
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={() => Alert.alert('Меню', 'Здесь скоро будут функции')}
            >
              <Text style={{ fontSize: 26, color: '#2563eb', lineHeight: 28 }}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="profile" options={{ title: 'Профиль' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Изменить профиль' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'Профиль' }} />
    </Stack>
  );
}