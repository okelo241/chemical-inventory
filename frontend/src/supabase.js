import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qgdtkwhgszvcywsnuyff.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZHRrd2hnc3p2Y3l3c251eWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjE5NjgsImV4cCI6MjEwMTQzNzk2OH0.8hUTP4hQopuUKnucL7Nl8vFetJIpUOyQsgjCSGy2iJk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)