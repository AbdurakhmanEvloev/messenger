// src/components/IncomingCallListener.tsx — слушает входящие звонки, пока приложение открыто
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function IncomingCallListener() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUid: string | null = null;

    const openCall = (callId: string) => {
      // Уже на экране звонка — ничего не делаем
      if (pathRef.current.startsWith('/call/')) return;
      router.push(`/call/${callId}` as any);
    };

    const stop = () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
      currentUid = null;
    };

    const start = async (uid: string) => {
      if (currentUid === uid) return;
      stop();
      currentUid = uid;

      // Звонок мог прийти за секунды до запуска приложения
      const since = new Date(Date.now() - 40000).toISOString();
      const { data } = await supabase
        .from('calls')
        .select('id')
        .eq('callee', uid)
        .eq('status', 'ringing')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.[0]) openCall(data[0].id);

      channel = supabase
        .channel('incoming-calls-' + uid)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee=eq.${uid}` },
          (payload) => openCall((payload.new as { id: string }).id)
        )
        .subscribe();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) start(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) start(session.user.id);
      else stop();
    });

    return () => {
      sub.subscription.unsubscribe();
      stop();
    };
  }, [router]);

  return null;
}