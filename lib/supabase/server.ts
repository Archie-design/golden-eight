import { createClient } from '@supabase/supabase-js'

/** Server-side Supabase client（使用 service_role key，繞過 RLS） */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
