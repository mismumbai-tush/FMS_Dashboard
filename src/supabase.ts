import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project')) {
  console.warn('Supabase URL or Anon Key is missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Use a valid placeholder URL if missing to prevent immediate crash, 
// but actual API calls will fail gracefully with a descriptive error.
export const supabase = createClient(
  supabaseUrl && !supabaseUrl.includes('your-project') ? supabaseUrl : 'https://placeholder.supabase.co', 
  supabaseAnonKey && !supabaseAnonKey.includes('your-key') ? supabaseAnonKey : 'placeholder-key'
);
