import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/Navbar'
import { Toaster } from '@/components/ui/sonner'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? null
  const payload = token ? await verifyToken(token) : null
  if (!payload) redirect('/')

  const db = createServerClient()
  const { data: member } = await db.from('members').select('name, is_admin').eq('id', payload.sub).single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-100/70 to-yellow-200/80">
      <Navbar userName={member?.name} isAdmin={member?.is_admin} />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <Toaster position="top-center" richColors />
    </div>
  )
}
