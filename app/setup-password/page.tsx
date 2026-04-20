'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SetupPasswordPage() {
  const router   = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('密碼至少 8 個字元')
    if (password !== confirm) return setError('兩次輸入的密碼不一致')

    setLoading(true)
    const res  = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.ok) router.push('/checkin')
    else setError(data.msg ?? '設定失敗，請重試')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-500 to-yellow-400 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <Star className="mx-auto w-12 h-12 text-amber-500 fill-amber-400" />
          <h1 className="text-xl font-bold">設定登入密碼</h1>
          <p className="text-sm text-muted-foreground">為保障帳號安全，請設定密碼後繼續使用</p>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 8 個字元"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">確認密碼</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="再次輸入密碼"
                autoComplete="new-password"
              />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
              disabled={loading}
            >
              {loading ? '設定中…' : '確認設定'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
