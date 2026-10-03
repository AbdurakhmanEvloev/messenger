// src/app/chat/[id].tsx — экран чата с текстом и голосовыми (полный файл)
import {
    AudioModule,
    RecordingPresets,
    createAudioPlayer,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Путь к клиенту Supabase: если у вас файл лежит в другом месте, поправьте эту строку
import { supabase } from '../../lib/supabase';

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string | null;
  audio_path: string | null;
  image_path: string | null;
  created_at: string;
};

// Отметить чат прочитанным: от этого зависит счётчик непрочитанных в списке чатов
async function markChatRead(chatId: string) {
  const { error } = await supabase.rpc('mark_chat_read', { p_chat_id: chatId });
  if (error) console.log('[READ] не удалось отметить прочитанным:', error.message);
}

// ---------- Пузырь с фото ----------
function ImageBubble({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.storage
      .from('photos')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <View style={styles.photoPlaceholder} />;

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(false)}>
          <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </>
  );
}

// ---------- Пузырь голосового сообщения ----------
const BAR_HEIGHTS = [6, 10, 16, 8, 20, 12, 18, 7, 14, 22, 9, 15, 19, 8, 12, 17, 6, 13, 21, 10, 16, 8, 12, 6];

function formatTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function VoiceBubble({ path, mine }: { path: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const disposePlayer = () => {
    playerRef.current?.remove();
    playerRef.current = null;
  };

  // Когда пузырь исчезает с экрана, выключаем плеер
  useEffect(() => {
    return () => disposePlayer();
  }, []);

  const toggle = async () => {
    if (loading) return;
    try {
      // Нажали во время воспроизведения: пауза
      if (playing && playerRef.current) {
        playerRef.current.pause();
        setPlaying(false);
        return;
      }
      // Плеера нет (первый запуск или после окончания): создаём заново
      if (!playerRef.current) {
        setLoading(true);
        const { data, error } = await supabase.storage
          .from('voice')
          .createSignedUrl(path, 3600);
        if (error || !data) {
          Alert.alert('Ошибка', 'Не удалось получить голосовое');
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true });
        const player = createAudioPlayer({ uri: data.signedUrl });
        player.addListener('playbackStatusUpdate', (status) => {
          setPosition(status.currentTime ?? 0);
          if (status.duration) setDuration(status.duration);
          if (status.didJustFinish) {
            // Дослушали: останавливаем и удаляем плеер, чтобы запись не пошла по кругу
            setPlaying(false);
            setPosition(0);
            player.pause();
            setTimeout(() => {
              player.remove();
              if (playerRef.current === player) playerRef.current = null;
            }, 0);
          }
        });
        playerRef.current = player;
      }
      playerRef.current.play();
      setPlaying(true);
    } catch (e: any) {
      Alert.alert('Ошибка воспроизведения', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  const activeColor = mine ? '#ffffff' : '#2f80ed';
  const inactiveColor = mine ? 'rgba(255,255,255,0.45)' : '#b0bec5';

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={toggle}
        style={[styles.playBtn, mine ? styles.playBtnMine : styles.playBtnTheirs]}
      >
        <Text style={[styles.playIcon, mine ? styles.playIconMine : styles.playIconTheirs]}>
          {loading ? '…' : playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      <View style={styles.wave}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              marginRight: 2,
              backgroundColor: i / BAR_HEIGHTS.length < progress ? activeColor : inactiveColor,
            }}
          />
        ))}
      </View>

      <Text style={[styles.voiceTime, mine && styles.msgTextMine]}>
        {formatTime(playing ? position : duration)}
      </Text>
    </View>
  );
}

// ---------- Экран чата ----------
export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const chatId = String(id);
  const insets = useSafeAreaInsets(); // отступ снизу, чтобы панель не пряталась под системной кнопкой

  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // новые сверху
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Кто я
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Загрузка истории + realtime
  useEffect(() => {
    let active = true;

    supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) Alert.alert('Ошибка', error.message);
        else setMessages((data ?? []) as Message[]);
        markChatRead(chatId);
      });

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
          markChatRead(chatId);
        }
      )
      .subscribe();

    return () => {
      active = false;
      markChatRead(chatId);
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  // Отправка текста
  const sendText = useCallback(async () => {
    const value = text.trim();
    if (!value || !userId) return;
    setText('');
    const { error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender_id: userId, text: value });
    if (error) Alert.alert('Ошибка', error.message);
  }, [text, userId, chatId]);

  // Начать запись
  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа', 'Разрешите микрофон в настройках');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Ошибка записи', String(e?.message ?? e));
    }
  };

  // Остановить запись и отправить
  const stopAndSend = async () => {
    console.log('[VOICE] 0. нажата кнопка ■, userId =', userId);
    if (!userId) {
      Alert.alert('Ошибка', 'Не определён пользователь. Выйдите и войдите заново.');
      return;
    }
    setRecording(false);
    setSending(true);
    try {
      console.log('[VOICE] 1. останавливаю запись');
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      console.log('[VOICE] 2. файл записи:', uri);
      if (!uri) throw new Error('Запись не сохранилась');

      // Папка = id пользователя: так требует правило безопасности бакета voice
      const path = `${userId}/${Date.now()}.m4a`;

      // Читаем записанный файл как base64 и превращаем в байты
      const base64 = await new File(uri).base64();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      console.log('[VOICE] размер файла, байт:', bytes.length);
      if (bytes.length < 1000) throw new Error('Запись пустая (' + bytes.length + ' байт)');

      const { error: upErr } = await supabase.storage
        .from('voice')
        .upload(path, bytes.buffer, { contentType: 'audio/m4a' });
      console.log('[VOICE] 3. загрузка в Storage, ошибка:', upErr?.message ?? 'нет');
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: userId, audio_path: path });
      console.log('[VOICE] 4. запись в messages, ошибка:', insErr?.message ?? 'нет');
      if (insErr) throw insErr;
    } catch (e: any) {
      console.log('[VOICE] ОШИБКА:', e);
      Alert.alert('Не удалось отправить голосовое', String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  // Выбрать фото из галереи и отправить
  const pickAndSendPhoto = async () => {
    if (!userId || sending) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setSending(true);
      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : 'jpg';
      console.log('[PHOTO] 1. выбрано:', asset.uri, mime);

      const base64 = await new File(asset.uri).base64();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      console.log('[PHOTO] 2. размер, байт:', bytes.length);
      if (bytes.length < 500) throw new Error('Файл фото пустой');

      // Папка = id пользователя: так требует правило безопасности бакета photos
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, bytes.buffer, { contentType: mime });
      console.log('[PHOTO] 3. загрузка, ошибка:', upErr?.message ?? 'нет');
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: userId, image_path: path });
      console.log('[PHOTO] 4. запись в messages, ошибка:', insErr?.message ?? 'нет');
      if (insErr) throw insErr;
    } catch (e: any) {
      console.log('[PHOTO] ОШИБКА:', e);
      Alert.alert('Не удалось отправить фото', String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.sender_id === userId;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.image_path ? (
            <ImageBubble path={item.image_path} />
          ) : item.audio_path ? (
            <VoiceBubble path={item.audio_path} mine={mine} />
          ) : (
            <Text style={[styles.msgText, mine && styles.msgTextMine]}>{item.text}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: name ? String(name) : 'Чат' }} />

      <FlatList
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
        <Pressable style={styles.attachBtn} onPress={pickAndSendPhoto} disabled={sending}>
          <Text style={styles.attachText}>📎</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение"
          multiline
        />
        {text.trim().length > 0 ? (
          <Pressable style={styles.button} onPress={sendText}>
            <Text style={styles.buttonText}>➤</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, recording && styles.buttonRecording]}
            onPress={recording ? stopAndSend : startRecording}
            disabled={sending}
          >
            <Text style={styles.buttonText}>{recording ? '■' : '🎤'}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 12 },
  row: { flexDirection: 'row', marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#2f80ed', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#eceff1', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 16, color: '#111' },
  msgTextMine: { color: '#fff' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    fontSize: 16,
  },
  button: {
    width: 40,
    height: 40,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: { backgroundColor: '#e53935' },
  buttonText: { color: '#fff', fontSize: 18 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', minWidth: 190 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playBtnMine: { backgroundColor: 'rgba(255,255,255,0.25)' },
  playBtnTheirs: { backgroundColor: '#2f80ed' },
  playIcon: { fontSize: 13 },
  playIconMine: { color: '#fff' },
  playIconTheirs: { color: '#fff' },
  wave: { flexDirection: 'row', alignItems: 'center', height: 24, flex: 1 },
  voiceTime: { fontSize: 12, color: '#555', marginLeft: 8, minWidth: 32 },
  attachBtn: {
    width: 40,
    height: 40,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { fontSize: 22 },
  photo: { width: 220, height: 220, borderRadius: 12 },
  photoPlaceholder: { width: 220, height: 220, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.08)' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
});