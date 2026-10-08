import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

async function touch() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid);
}

export function usePresence() {
  useEffect(() => {
    touch();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') touch();
    }, 30000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') touch();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}