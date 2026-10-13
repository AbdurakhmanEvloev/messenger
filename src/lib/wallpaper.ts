import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const KEY = 'chat_wallpaper_uri';

// Адрес сохранённого фона (или null, если не выбран)
export async function getWallpaper(): Promise<string | null> {
  try {
    const uri = await AsyncStorage.getItem(KEY);
    if (!uri) return null;
    return new File(uri).exists ? uri : null;
  } catch {
    return null;
  }
}

// Копируем выбранное фото в память приложения, чтобы оно не пропало
export async function saveWallpaper(pickedUri: string): Promise<string> {
  const old = await getWallpaper();
  const target = new File(Paths.document, 'wallpaper-' + Date.now() + '.jpg');
  await new File(pickedUri).copy(target, { overwrite: true });
  await AsyncStorage.setItem(KEY, target.uri);
  if (old) {
    try {
      new File(old).delete();
    } catch {}
  }
  return target.uri;
}

export async function clearWallpaper(): Promise<void> {
  const old = await getWallpaper();
  await AsyncStorage.removeItem(KEY);
  if (old) {
    try {
      new File(old).delete();
    } catch {}
  }
}