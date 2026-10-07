import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const KEY = 'chat_background_uri';

export async function getChatBg(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setChatBg(pickedUri: string): Promise<string> {
  const dest = new File(Paths.document, `chat-bg-${Date.now()}.jpg`);
  new File(pickedUri).copy(dest);
  const old = await AsyncStorage.getItem(KEY);
  await AsyncStorage.setItem(KEY, dest.uri);
  if (old) {
    try { new File(old).delete(); } catch {}
  }
  return dest.uri;
}

export async function clearChatBg() {
  const old = await AsyncStorage.getItem(KEY);
  await AsyncStorage.removeItem(KEY);
  if (old) {
    try { new File(old).delete(); } catch {}
  }
}