import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('your-project') || !supabaseAnonKey || supabaseAnonKey.includes('your-key');

if (isPlaceholder) {
  console.warn('Supabase configuration is missing or using placeholders. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Use a valid placeholder URL if missing to prevent immediate crash, 
// but actual API calls will fail gracefully with a descriptive error.
export const supabase = createClient(
  !isPlaceholder ? supabaseUrl : 'https://placeholder-project.supabase.co', 
  !isPlaceholder ? supabaseAnonKey : 'placeholder-key'
);

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = () => !isPlaceholder;
