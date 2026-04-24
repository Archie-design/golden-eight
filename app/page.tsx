'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Tab = 'login' | 'register'

function LoginPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab]         = useState<Tab>('login')
  const [error, setError] = useState(() => {
    const err = searchParams.get('error')
    if (err === 'line_not_bound') return '此 LINE 帳號尚未綁定任何成員，請先用姓名登入後再綁定'
    if (err === 'line_state')     return 'LINE 驗證失敗，請重試'
    if (err === 'line_denied')    return '已取消 LINE 登入'
    if (err === 'line_token' || err === 'line_profile') return 'LINE 授權失敗，請重試'
    return ''
  })
  const [loading, setLoading] = useState(false)

  const [loginName,     setLoginName]     = useState('')
  const [loginPhone,    setLoginPhone]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regName,  setRegName]  = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regLevel, setRegLevel] = useState('黃金戰士')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!loginName || !loginPhone) return setError('請填寫姓名與完整手機號')
    if (!/^09\d{8}$/.test(loginPhone)) return setError('請輸入 10 位數手機號碼（09 開頭）')

    setLoading(true)
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loginName, phone: loginPhone, password: loginPassword || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.push('/checkin')
    else setError(data.msg)
  }

  async function lineLogin() {
    setError('')
    setLoading(true)
    const res  = await fetch('/api/auth/line/login')
    const json = await res.json()
    setLoading(false)
    if (json.ok) window.location.href = json.url
    else setError(json.msg)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!regName || !regPhone) return setError('請填寫所有必填欄位')
    if (!/^09\d{8}$/.test(regPhone)) return setError('請輸入 10 位數手機號碼（09 開頭）')

    setLoading(true)
    const res  = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regName, phone: regPhone, level: regLevel }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.push('/checkin')
    else setError(data.msg)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-500 to-yellow-400 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <Star className="mx-auto w-12 h-12 text-amber-500 fill-amber-400" />
          <h1 className="text-xl font-bold">黃金八套餐</h1>
          <p className="text-sm text-muted-foreground">定課打卡系統</p>
        </CardHeader>

        <div className="flex border-b mx-6">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground'
              }`}
            >
              {t === 'login' ? '登入' : '新成員加入'}
            </button>
          ))}
        </div>

        <CardContent className="pt-4">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-name">姓名</Label>
                <Input id="login-name" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="請輸入您的姓名" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-phone">手機號碼</Label>
                <Input id="login-phone" value={loginPhone} onChange={e => setLoginPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} inputMode="numeric" placeholder="09xxxxxxxx" />
                <p className="text-xs text-muted-foreground">請輸入完整 10 位數手機號碼</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">密碼</Label>
                <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="首次登入可留空" autoComplete="current-password" />
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" disabled={loading}>
                {loading ? '登入中…' : '登入'}
              </Button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10"
                disabled={loading}
                onClick={lineLogin}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-[#06C755]" aria-hidden="true">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINE 快速登入
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">姓名</Label>
                <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} placeholder="請輸入您的姓名" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">手機號碼</Label>
                <Input id="reg-phone" value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} inputMode="numeric" placeholder="09xxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>挑戰階梯</Label>
                <Select value={regLevel} onValueChange={v => v && setRegLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="青銅戰士">青銅戰士（60%，罰 400 元）</SelectItem>
                    <SelectItem value="白銀戰士">白銀戰士（70%，罰 300 元）</SelectItem>
                    <SelectItem value="黃金戰士">黃金戰士（80%，罰 200 元）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" disabled={loading}>
                {loading ? '加入中…' : '加入挑戰！'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
