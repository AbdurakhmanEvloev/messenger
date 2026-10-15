// src/app/call/[id].tsx — экран звонка (голос и видео: исходящий, входящий и разговор)
let AudioSession: any = null;
let registerGlobals: any = null;
let VideoTrack: any = null;
let Room: any = null;
let RoomEvent: any = null;
let Track: any = null;
let livekitReady = false;
try {
  ({ AudioSession, registerGlobals, VideoTrack } = require('@livekit/react-native'));
  ({ Room, RoomEvent, Track } = require('livekit-client'));
  livekitReady = true;
} catch (e) {
  livekitReady = false; // Expo Go: нативного WebRTC нет
}
import { AudioModule } from 'expo-audio';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { Room as LKRoom } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { CallRow, CallStatus, fetchCallToken, friendlyCallError, setCallStatus } from '../../lib/calls';
import { supabase } from '../../lib/supabase';

if (livekitReady) registerGlobals();

type Phase = 'loading' | 'ringing' | 'connecting' | 'live' | 'ended';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// Разрешение на камеру (на Android его нужно спросить вручную)
async function ensureCameraPermission() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export default function CallScreen() {
  const { id, video } = useLocalSearchParams<{ id: string; video?: string }>();
  const callId = String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('loading');
  const [role, setRole] = useState<'caller' | 'callee'>('caller');
  const [peerName, setPeerName] = useState('');
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [note, setNote] = useState(''); // «Нет ответа», «Звонок завершён» и т.п.
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [remoteVideo, setRemoteVideo] = useState<any>(null);
  const [localVideo, setLocalVideo] = useState<any>(null);

  const roomRef = useRef<LKRoom | null>(null);
  const statusRef = useRef<CallStatus>('ringing');
  const roleRef = useRef<'caller' | 'callee'>('caller');
  const finishedRef = useRef(false);
  const connectingRef = useRef(false);
  const wantVideoRef = useRef(false);
  const audioStartedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Обновить картинки: своё видео и видео собеседника
  const refreshVideo = useCallback(() => {
    const room = roomRef.current;
    if (!room || !Track) return;
    const lp = room.localParticipant;
    const lpub = lp.getTrackPublication(Track.Source.Camera);
    setLocalVideo(
      lpub?.track && !lpub.isMuted ? { participant: lp, publication: lpub, source: Track.Source.Camera } : null
    );
    const peer: any = Array.from(room.remoteParticipants.values())[0];
    const rpub = peer?.getTrackPublication(Track.Source.Camera);
    setRemoteVideo(
      rpub?.track && !rpub.isMuted ? { participant: peer, publication: rpub, source: Track.Source.Camera } : null
    );
  }, []);

  // Закрыть экран звонка: отключаем звук и возвращаемся назад
  const finish = useCallback(
    (text: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setNote(text);
      setPhase('ended');
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (audioStartedRef.current) {
        AudioSession.stopAudioSession();
        audioStartedRef.current = false;
      }
      setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/chats');
      }, 1200);
    },
    [router]
  );

  // Подключиться к комнате LiveKit
  const connect = useCallback(async () => {
    if (connectingRef.current || finishedRef.current) return;
    connectingRef.current = true;
    setPhase('connecting');
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа', 'Разрешите микрофон в настройках телефона, чтобы звонить');
        try {
          await setCallStatus(callId, 'ended');
        } catch { }
        finish('Нет доступа к микрофону');
        return;
      }

      // Android: микрофон и Bluetooth-звук (на Android 12+ без этого бывают зависания)
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (Number(Platform.Version) >= 31) {
          await PermissionsAndroid.request('android.permission.BLUETOOTH_CONNECT' as any);
        }
      }

      await AudioSession.startAudioSession();
      audioStartedRef.current = true;

      const { token, url } = await fetchCallToken(callId);
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        if (!finishedRef.current) finish('Звонок завершён');
      });
      // Собеседник вышел из комнаты — завершаем и у нас
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setCallStatus(callId, 'ended').catch(() => { });
        finish('Звонок завершён');
      });
      // Видео: обновляем картинку, когда что-то изменилось
      room.on(RoomEvent.TrackSubscribed, refreshVideo);
      room.on(RoomEvent.TrackUnsubscribed, refreshVideo);
      room.on(RoomEvent.TrackMuted, refreshVideo);
      room.on(RoomEvent.TrackUnmuted, refreshVideo);
      room.on(RoomEvent.LocalTrackPublished, refreshVideo);
      room.on(RoomEvent.LocalTrackUnpublished, refreshVideo);

      await room.connect(url, token);

      if (finishedRef.current) {
        room.disconnect();
        return;
      }
      setPhase('live');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

      // Микрофон включаем уже после «разговора»; если не вышло, показываем причину
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (e: any) {
        Alert.alert('Микрофон не включился', String(e?.message ?? e));
      }

      if ((video === '1' || wantVideoRef.current) && (await ensureCameraPermission())) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          setCamOn(true);
          refreshVideo();
        } catch (e: any) {
          Alert.alert('Камера не включилась', String(e?.message ?? e));
        }
      }
    } catch (e: any) {
      Alert.alert('Не удалось подключиться', friendlyCallError(String(e?.message ?? e)));
      try {
        await setCallStatus(callId, 'ended');
      } catch { }
      finish('Не удалось подключиться');
    }
  }, [callId, finish, video, refreshVideo]);

  // Реакция на смену статуса звонка (из realtime или из проверки раз в 3 секунды)
  const onStatus = useCallback(
    (status: CallStatus) => {
      if (finishedRef.current || status === statusRef.current) return;
      statusRef.current = status;
      if (status === 'accepted') connect();
      else if (status === 'declined') finish('Звонок отклонён');
      else if (status === 'missed') finish(roleRef.current === 'caller' ? 'Нет ответа' : 'Пропущенный звонок');
      else if (status === 'ended') finish('Звонок завершён');
    },
    [connect, finish]
  );

  // Загрузка звонка и подписка на изменения
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const me = u.user?.id;
      const { data: call } = await supabase.from('calls').select('*').eq('id', callId).single();
      if (!active) return;
      if (!me || !call) {
        finish('Звонок не найден');
        return;
      }
      const c = call as CallRow;
      const r = c.caller === me ? 'caller' : 'callee';
      setRole(r);
      roleRef.current = r;

      const peer = r === 'caller' ? c.callee : c.caller;
      const { data: p } = await supabase.from('profiles').select('username, avatar_path').eq('id', peer).single();
      if (active && p) {
        setPeerName(p.username || 'Без имени');
        setPeerAvatar(p.avatar_path ?? null);
      }

      if (c.status === 'ringing') {
        statusRef.current = 'ringing';
        setPhase('ringing');
      } else if (c.status === 'accepted') {
        statusRef.current = 'ringing'; // чтобы onStatus сработал
        onStatus('accepted');
      } else {
        finish('Звонок уже завершён');
        return;
      }

      channel = supabase
        .channel('call-' + callId)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
          (payload) => onStatus((payload.new as CallRow).status)
        )
        .subscribe();

      // Подстраховка: если realtime пропустил событие, проверяем статус сами
      poll = setInterval(async () => {
        const { data: row } = await supabase.from('calls').select('status').eq('id', callId).single();
        if (row) onStatus(row.status as CallStatus);
      }, 3000);
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [callId, onStatus, finish]);

  // Звонящий ждёт ответа не дольше 45 секунд
  useEffect(() => {
    if (phase !== 'ringing' || role !== 'caller') return;
    const t = setTimeout(() => {
      setCallStatus(callId, 'missed').catch(() => { });
    }, 45000);
    return () => clearTimeout(t);
  }, [phase, role, callId]);

  // Уход с экрана: отключаемся
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
      if (audioStartedRef.current) AudioSession.stopAudioSession();
    };
  }, []);

  // Положить трубку / отклонить / отменить
  const hangup = useCallback(async () => {
    if (finishedRef.current) return;
    const st = statusRef.current;
    try {
      if (st === 'ringing') await setCallStatus(callId, roleRef.current === 'caller' ? 'missed' : 'declined');
      else if (st === 'accepted') await setCallStatus(callId, 'ended');
    } catch { }
    finish(st === 'ringing' && roleRef.current === 'callee' ? 'Звонок отклонён' : 'Звонок завершён');
  }, [callId, finish]);

  // Кнопка «назад» на Android = положить трубку
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hangup();
      return true;
    });
    return () => sub.remove();
  }, [hangup]);

  // Ответить на входящий (withVideo = true: сразу с камерой)
  const accept = async (withVideo = false) => {
    wantVideoRef.current = withVideo;
    try {
      await setCallStatus(callId, 'accepted');
      statusRef.current = 'accepted';
      connect();
    } catch (e: any) {
      Alert.alert('Не удалось ответить', friendlyCallError(String(e?.message ?? e)));
      finish('Звонок завершён');
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    } catch { }
  };

  // Динамик / разговорный динамик (зависит от телефона, поэтому в try)
  const toggleSpeaker = async () => {
    const next = !speaker;
    setSpeaker(next);
    try {
      await (AudioSession as any).selectAudioOutput?.(next ? 'speaker' : 'earpiece');
    } catch { }
  };

  // Включить / выключить свою камеру
  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      if (!camOn && !(await ensureCameraPermission())) {
        Alert.alert('Нет доступа', 'Разрешите камеру в настройках телефона');
        return;
      }
      await room.localParticipant.setCameraEnabled(!camOn);
      setCamOn(!camOn);
      refreshVideo();
    } catch (e: any) {
      Alert.alert('Камера', String(e?.message ?? e));
    }
  };

  // Переключить фронтальную и заднюю камеру
  const flipCamera = async () => {
    try {
      const pub: any = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
      const next = facing === 'user' ? 'environment' : 'user';
      await pub?.track?.restartTrack({ facingMode: next });
      setFacing(next);
    } catch { }
  };

  let statusText = '';
  if (phase === 'loading') statusText = '';
  else if (phase === 'ringing') statusText = role === 'caller' ? 'Вызов…' : 'Входящий звонок';
  else if (phase === 'connecting') statusText = 'Соединение…';
  else if (phase === 'live') statusText = fmt(seconds);
  else statusText = note;

  const showIncomingButtons = phase === 'ringing' && role === 'callee';
  const showCallButtons = phase === 'connecting' || phase === 'live' || (phase === 'ringing' && role === 'caller');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {VideoTrack && remoteVideo && (
        <VideoTrack trackRef={remoteVideo} style={StyleSheet.absoluteFill} objectFit="cover" />
      )}
      {VideoTrack && localVideo && (
        <View style={[styles.selfView, { top: insets.top + 12 }]}>
          <VideoTrack trackRef={localVideo} style={{ flex: 1 }} objectFit="cover" mirror={facing === 'user'} />
          <Pressable style={styles.flipBtn} onPress={flipCamera}>
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.center}>
        {remoteVideo ? null : phase === 'loading' ? (
          <ActivityIndicator color="#2563eb" size="large" />
        ) : (
          <>
            <Avatar name={peerName || '?'} path={peerAvatar} size={140} />
            <Text style={styles.name} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={[styles.status, phase === 'live' && styles.statusLive]}>{statusText}</Text>
          </>
        )}
      </View>

      {showIncomingButtons && (
        <View style={styles.buttonsRow}>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, styles.red]} onPress={hangup}>
              <Image source={require('../../../assets/icons/phon.png')} style={[styles.icon, styles.iconEnd]} />
            </Pressable>
            <Text style={styles.btnLabel}>Отклонить</Text>
          </View>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, styles.green]} onPress={() => accept(false)}>
              <Image source={require('../../../assets/icons/phon.png')} style={styles.icon} />
            </Pressable>
            <Text style={styles.btnLabel}>Ответить</Text>
          </View>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, styles.green]} onPress={() => accept(true)}>
              <Text style={styles.emoji}>🎥</Text>
            </Pressable>
            <Text style={styles.btnLabel}>С видео</Text>
          </View>
        </View>
      )}

      {showCallButtons && (
        <View style={styles.buttonsRow}>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, muted ? styles.dark : styles.gray]} onPress={toggleMute}>
              <Text style={[styles.emoji, muted && { opacity: 0.9 }]}>{muted ? '🔇' : '🎙'}</Text>
            </Pressable>
            <Text style={styles.btnLabel}>{muted ? 'Включить' : 'Микрофон'}</Text>
          </View>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, styles.red]} onPress={hangup}>
              <Image source={require('../../../assets/icons/phon.png')} style={[styles.icon, styles.iconEnd]} />
            </Pressable>
            <Text style={styles.btnLabel}>{phase === 'ringing' ? 'Отмена' : 'Завершить'}</Text>
          </View>
          <View style={styles.btnBox}>
            <Pressable style={[styles.circle, speaker ? styles.dark : styles.gray]} onPress={toggleSpeaker}>
              <Text style={styles.emoji}>🔊</Text>
            </Pressable>
            <Text style={styles.btnLabel}>Динамик</Text>
          </View>
          {phase === 'live' && (
            <View style={styles.btnBox}>
              <Pressable style={[styles.circle, camOn ? styles.dark : styles.gray]} onPress={toggleCamera}>
                <Text style={styles.emoji}>{camOn ? '📷' : '🎥'}</Text>
              </Pressable>
              <Text style={styles.btnLabel}>Камера</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingHorizontal: 24 },
  name: { fontSize: 28, fontWeight: '800', color: '#111', marginTop: 24, textAlign: 'center' },
  status: { fontSize: 17, color: '#8a8f98', marginTop: 8 },
  statusLive: { color: '#2563eb', fontWeight: '600' },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  btnBox: { alignItems: 'center', width: 80 },
  circle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  gray: { backgroundColor: '#f2f4f7' },
  dark: { backgroundColor: '#d5d9df' },
  red: { backgroundColor: '#ef4444' },
  green: { backgroundColor: '#22c55e' },
  icon: { width: 30, height: 30, tintColor: '#fff' },
  iconEnd: { transform: [{ rotate: '135deg' }] },
  emoji: { fontSize: 28 },
  btnLabel: { fontSize: 13, color: '#8a8f98', marginTop: 8 },
  selfView: {
    position: 'absolute',
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 5,
  },
  flipBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});