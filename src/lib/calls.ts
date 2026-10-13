// src/lib/calls.ts — вспомогательные функции звонков
import { supabase } from './supabase';

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';

export type CallRow = {
  id: string;
  chat_id: string;
  caller: string;
  callee: string;
  status: CallStatus;
  created_at: string;
};

// Понятный текст ошибки
export function friendlyCallError(message: string) {
  const m = (message || '').toLowerCase();
  if (m.includes('blocked')) return 'Звонок невозможен: один из вас заблокировал другого.';
  if (m.includes('busy')) return 'Собеседник или вы уже в звонке.';
  if (m.includes('не настроен')) return 'Сервер звонков ещё не настроен.';
  if (m.includes('network') || m.includes('fetch')) return 'Нет соединения с интернетом.';
  return message;
}

// Начать звонок в чате. Возвращает id звонка
export async function startCall(chatId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_call', { p_chat_id: chatId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setCallStatus(callId: string, status: CallStatus) {
  const { error } = await supabase.rpc('set_call_status', { p_call_id: callId, p_status: status });
  if (error) throw new Error(error.message);
}

// Токен для входа в комнату LiveKit (выдаёт функция livekit-token в Supabase)
export async function fetchCallToken(callId: string): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('livekit-token', { body: { call_id: callId } });
  if (error) {
    let msg = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return data as { token: string; url: string };
}