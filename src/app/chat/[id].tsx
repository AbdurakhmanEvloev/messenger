// src/app/chat/[id].tsx — экран чата с текстом, голосовыми, фото и профилем собеседника (полный файл)
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
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

// ---------- Даты и время ----------
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// «Сегодня», «Вчера» или «3 октября» (с годом, если год другой)
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(iso) === dayKey(now.toISOString())) return 'Сегодня';
  if (dayKey(iso) === dayKey(new Date(now.getTime() - 86400000).toISOString())) return 'Вчера';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- Пузырь с фото ----------
const PHOTO_MAX_W = 240;
const PHOTO_MAX_H = 320;

function ImageBubble({ path, onLongPress }: { path: string; onLongPress?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ width: 220, height: 220 });

  useEffect(() => {
    let active = true;
    supabase.storage
      .from('photos')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!active || !data) return;
        setUrl(data.signedUrl);
        // Узнаём размеры фото и подгоняем пузырь под его пропорции
        Image.getSize(
          data.signedUrl,
          (w, h) => {
            if (!active || !w || !h) return;
            const scale = Math.min(PHOTO_MAX_W / w, PHOTO_MAX_H / h);
            setSize({ width: Math.round(w * scale), height: Math.round(h * scale) });
          },
          () => { }
        );
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <View style={[styles.photoPlaceholder, size]} />;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} onLongPress={onLongPress}>
        <Image
          source={{ uri: url }}
          style={{ width: size.width, height: size.height }}
          resizeMode="cover"
        />
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

function VoiceBubble({ path, mine, onLongPress }: { path: string; mine: boolean; onLongPress?: () => void }) {
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
  const activeColor = mine ? '#7c5cd6' : '#2f80ed';
  const inactiveColor = mine ? 'rgba(124,92,214,0.35)' : '#b0bec5';

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
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

// ---------- Галочки и время под сообщением ----------
function Ticks({ read, color }: { read: boolean; color: string }) {
  return (
    <Image
      source={
        read
          ? require('../../../assets/icons/tick_all.png')
          : require('../../../assets/icons/tick.png')
      }
      style={{ width: read ? 18 : 14, height: 14, tintColor: color }}
      resizeMode="contain"
    />
  );
}

function MessageMeta({
  time,
  mine,
  read,
  onPhoto = false,
  inline = false,
}: {
  time: string;
  mine: boolean;
  read: boolean;
  onPhoto?: boolean;
  inline?: boolean;
}) {
  const timeColor = onPhoto ? '#fff' : mine ? '#7a7585' : '#8a8f98';
  const tickColor = read ? (onPhoto ? '#6cb2ff' : '#2f80ed') : onPhoto ? '#fff' : '#9a94a8';
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
        inline && { marginLeft: 10, marginTop: 0, marginBottom: 1 },
        onPhoto && {
          position: 'absolute',
          right: 8,
          bottom: 6,
          marginTop: 0,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 10,
          backgroundColor: 'rgba(0,0,0,0.45)',
        },
      ]}
    >
      <Text style={{ fontSize: 11, color: timeColor }}>{time}</Text>
      {mine && (
        <View style={{ marginLeft: 4 }}>
          <Ticks read={read} color={tickColor} />
        </View>
      )}
    </View>
  );
}

// ---------- Экран чата ----------
export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const chatId = String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets(); // отступ снизу, чтобы панель не пряталась под системной кнопкой

  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // новые сверху
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingKind, setTypingKind] = useState<null | 'text' | 'voice'>(null); // собеседник печатает / записывает
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null); // когда собеседник последний раз читал чат
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);

  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Клавиатура: на iOS поднимаем панель ввода на высоту клавиатуры
  const [kbHeight, setKbHeight] = useState(0);
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const animate = (duration: number) => {
      if (!ios) return;
      LayoutAnimation.configureNext({
        duration: duration > 0 ? duration : 250,
        update: { type: LayoutAnimation.Types.keyboard },
      });
    };

    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      animate(e.duration);
      setKbHeight(e.endCoordinates.height);
      setKbVisible(true);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      animate(e.duration);
      setKbHeight(0);
      setKbVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Аватарка собеседника для шапки
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('chat_members')
        .select('user_id, profiles(avatar_path)')
        .eq('chat_id', chatId)
        .neq('user_id', u.user?.id ?? '')
        .limit(1)
        .single();
      setPeerAvatar((data as any)?.profiles?.avatar_path ?? null);
      setPeerId((data as any)?.user_id ?? null);
    })();
  }, [chatId]);

  // Узнаём, когда собеседник последний раз открывал чат (для галочек «прочитано»)
  const fetchOtherRead = useCallback(async () => {
    const me = userIdRef.current;
    if (!me) return;
    const { data } = await supabase.from('chat_members').select('user_id, last_read_at').eq('chat_id', chatId);
    const other = data?.find((r: any) => r.user_id !== me);
    if (other) setOtherReadAt(other.last_read_at);
  }, [chatId]);

  // Отметить чат прочитанным и сообщить об этом собеседнику, если он сейчас в чате
  const markRead = useCallback(async () => {
    const { error } = await supabase.rpc('mark_chat_read', { p_chat_id: chatId });
    if (error) {
      console.log('[READ] не удалось отметить прочитанным:', error.message);
      return;
    }
    if (String(channelRef.current?.state) === 'joined') {
      channelRef.current?.send({ type: 'broadcast', event: 'read', payload: {} });
    }
  }, [chatId]);

  // Сообщить собеседнику «печатаю» (не чаще раза в 2 секунды)
  const sendTyping = useCallback((kind: 'text' | 'voice') => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    if (String(channelRef.current?.state) !== 'joined') return;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { kind } });
  }, []);

  // Кто я
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      fetchOtherRead();
    });
  }, [fetchOtherRead]);

  // Пока идёт запись голосового, собеседник видит «записывает голосовое…»
  useEffect(() => {
    if (!recording) return;
    lastTypingSent.current = 0;
    sendTyping('voice');
    const t = setInterval(() => {
      lastTypingSent.current = 0;
      sendTyping('voice');
    }, 2500);
    return () => clearInterval(t);
  }, [recording, sendTyping]);

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
        markRead();
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
          setTypingKind(null);
          markRead();
        }
      )
      // Сообщение удалили: убираем его из списка (у удаления нет фильтра по чату, но id уникален)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) setMessages((prev) => prev.filter((x) => x.id !== deletedId));
      })
      // Собеседник печатает
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setTypingKind(payload?.kind === 'voice' ? 'voice' : 'text');
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingKind(null), 3500);
      })
      // Собеседник прочитал чат
      .on('broadcast', { event: 'read' }, () => {
        fetchOtherRead();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') markRead();
      });
    channelRef.current = channel;

    return () => {
      active = false;
      markChatRead(chatId);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [chatId, markRead, fetchOtherRead]);

  // Ввод текста: заодно говорим собеседнику «печатает…»
  const onChangeText = (value: string) => {
    setText(value);
    if (value.trim()) sendTyping('text');
  };

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

  // Сделать фото камерой или выбрать из галереи и отправить
  const pickAndSendPhoto = async (source: 'library' | 'camera' = 'library') => {
    if (!userId || sending) return;
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Нет доступа', 'Разрешите камеру в настройках телефона');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
        });
      }
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

  // Удалить своё сообщение (и файл, если это голосовое или фото)
  const deleteMessage = async (m: Message) => {
    const { data, error } = await supabase.from('messages').delete().eq('id', m.id).select('id');
    if (error || !data || data.length === 0) {
      Alert.alert('Не удалось удалить', error?.message ?? 'Нет прав на удаление. Выполнен ли SQL из файла 8-small-things-sql?');
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (m.audio_path) await supabase.storage.from('voice').remove([m.audio_path]);
    if (m.image_path) await supabase.storage.from('photos').remove([m.image_path]);
  };

  const confirmDelete = (m: Message) => {
    Alert.alert('Удалить сообщение?', 'Оно исчезнет и у собеседника.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deleteMessage(m) },
    ]);
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.sender_id === userId;
    // Список перевёрнут: индекс 0 — самое новое сообщение
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const showDate = !older || dayKey(older.created_at) !== dayKey(item.created_at);
    // Подряд идущие сообщения одного автора склеиваем в «серию»: хвостик только у последнего
    const groupedWithNewer =
      !!newer && newer.sender_id === item.sender_id && dayKey(newer.created_at) === dayKey(item.created_at);
    const isImage = !!item.image_path;
    const isRead = mine && !!otherReadAt && new Date(item.created_at).getTime() <= new Date(otherReadAt).getTime();
    const onLongPress = mine ? () => confirmDelete(item) : undefined;
    const firstInGroup =
      !older || older.sender_id !== item.sender_id || dayKey(older.created_at) !== dayKey(item.created_at);

    return (
      <View>
        {showDate && (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{dayLabel(item.created_at)}</Text>
          </View>
        )}
        <View
          style={[
            styles.row,
            mine ? styles.rowMine : styles.rowTheirs,
            !groupedWithNewer && styles.rowGroupEnd,
          ]}
        >
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={350}
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
              isImage && styles.bubbleImage,
              !mine && firstInGroup && styles.tailFirst,
            ]}
          >
            {item.image_path ? (
              <ImageBubble path={item.image_path} onLongPress={onLongPress} />
            ) : item.audio_path ? (
              <VoiceBubble path={item.audio_path} mine={mine} onLongPress={onLongPress} />
            ) : (
              <View style={styles.textRow}>
                <Text style={[styles.msgText, mine && styles.msgTextMine, { flexShrink: 1 }]}>
                  {item.text}
                </Text>
                <MessageMeta time={timeOf(item.created_at)} mine={mine} read={isRead} inline />
              </View>
            )}
            {(isImage || !!item.audio_path) && (
              <MessageMeta time={timeOf(item.created_at)} mine={mine} read={isRead} onPhoto={isImage} />
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      enabled={false}
      behavior="padding"
    >
      <Stack.Screen
        options={{
          title: name ? String(name) : 'Чат',
          headerTitle: () => (
            <Pressable
              style={styles.headerRow}
              onPress={() => peerId && router.push(`/user/${peerId}`)}
            >
              <Avatar name={name ? String(name) : '?'} path={peerAvatar} size={36} />
              <View>
                <Text style={styles.headerName} numberOfLines={1}>
                  {name ? String(name) : 'Чат'}
                </Text>
                {typingKind && (
                  <Text style={styles.headerTyping}>
                    {typingKind === 'voice' ? 'записывает голосовое…' : 'печатает…'}
                  </Text>
                )}
              </View>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        extraData={otherReadAt}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      />

      <View style={[styles.inputBar,
      {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        paddingBottom: 8 + (Platform.OS === 'ios' && kbVisible ? 0 : insets.bottom),
      },
      ]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: '#fff',
            borderRadius: 20,
            paddingLeft: 14,
            paddingRight: 2,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 100,
              paddingVertical: 8,
              fontSize: 16,
              color: '#111',
              textAlignVertical: 'center',
            }}
            value={text}
            onChangeText={onChangeText}
            placeholder="Сообщение"
            placeholderTextColor="#8a8f98"
            multiline
          />
          <Pressable
            style={{ width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => pickAndSendPhoto('library')}
            disabled={sending}
          >
            <Image source={require('../../../assets/icons/clip.png')} style={{ width: 24, height: 24, tintColor: '#6b7280' }} />
          </Pressable>
          {text.trim().length === 0 && (
            <Pressable
              style={{ width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => pickAndSendPhoto('camera')}
              disabled={sending || recording}
            >
              <Image source={require('../../../assets/icons/camera.png')} style={{ width: 24, height: 24, tintColor: '#6b7280' }} />
            </Pressable>
          )}
        </View>

        {text.trim().length > 0 ? (
          <Pressable style={styles.button} onPress={sendText}>
            <Image source={require('../../../assets/icons/send.png')} style={{ width: 22, height: 22, tintColor: '#fff' }} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, recording && styles.buttonRecording]}
            onPress={recording ? stopAndSend : startRecording}
            disabled={sending}
          >
            {recording ? (
              <Text style={styles.buttonText}>■</Text>
            ) : (
              <Image
                source={require('../../../assets/icons/mic.png')}
                style={{ width: 22, height: 22, tintColor: '#fff' }}
              />
            )}
          </Pressable>
        )}
      </View>

      {/* iOS: подпорка высотой с клавиатуру, она поднимает панель ввода */}
      <View style={{ height: kbHeight }} />

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fce9ef' },
  list: { padding: 12 },
  row: { flexDirection: 'row', marginVertical: 1 },
  rowGroupEnd: { marginBottom: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#e6dcfb' },
  bubbleTheirs: { backgroundColor: '#ffffff' },
  tailMine: { borderBottomRightRadius: 4 },
  tailTheirs: { borderBottomLeftRadius: 4 },
  bubbleImage: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  msgText: { fontSize: 16, color: '#111' },
  msgTextMine: { color: '#111' },
  msgTime: { alignSelf: 'flex-end', fontSize: 11, color: '#8a8f98', marginTop: 2, marginRight: 2 },
  msgTimeMine: { color: '#7a7585' },
  textRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' },
  msgTimeInline: { marginLeft: 10, marginTop: 0, marginRight: 0, marginBottom: 1 },
  tailFirst: { borderTopLeftRadius: 3 },
  msgTimeOnPhoto: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    marginTop: 0,
    marginRight: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: '#fff',
  },
  tickRead: { color: '#2f80ed', fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#111' },
  headerTyping: { fontSize: 12, color: '#2563eb' },
  dateChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 10,
  },
  dateChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  playBtnMine: { backgroundColor: '#7c5cd6' },
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
  photo: { width: 220, height: 220, borderRadius: 0 },
  photoPlaceholder: { width: 220, height: 220, borderRadius: 0, backgroundColor: 'rgba(0,0,0,0.08)' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
});