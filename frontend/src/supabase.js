import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qgdtkwhgszvcywsnuyff.supabase.co'
const supabaseAnonKey = 'sb_publishable_SnWn8790oNGk0I0aRhcPWA_E265rDdl'   // your anon/publishable key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)