import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Server-side admin guard: reads is_admin live from DB, not from JWT
// This ensures access control stays correct even if the JWT was issued
// before is_admin was set to true.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token       = cookieStore.get('token')?.value ?? null
  const payload     = token ? await verifyToken(token) : null

  if (!payload) redirect('/')

  const db = createServerClient()
  const { data: member } = await db
    .from('members')
    .select('is_admin')
    .eq('id', payload.sub)
    .single()

  if (!member?.is_admin) redirect('/checkin')

  return <>{children}</>
}
