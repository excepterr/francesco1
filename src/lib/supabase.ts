import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Не заданы переменные окружения SUPABASE_URL или SUPABASE_KEY!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);