import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://ygoyjinxljvkbzibggul.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ypzo3aIGSHrkHvRpa9Gdsw_9UZ4Wz5u';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});