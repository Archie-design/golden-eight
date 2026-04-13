'use client'

import { createClient } from '@supabase/supabase-js'

/** Browser-side Supabase client（anon key，只用於 Client Component） */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}
