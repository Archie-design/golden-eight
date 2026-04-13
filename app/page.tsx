'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Tab = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<Tab>('login')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const [loginName,  setLoginName]  = useState('')
  const [loginPhone, setLoginPhone] = useState('')

  const [regName,  setRegName]  = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regDate,  setRegDate]  = useState(new Date().toISOString().slice(0, 10))
  const [regLevel, setRegLevel] = useState('黃金戰士')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!loginName || !loginPhone) return setError('請填寫姓名與手機末三碼')
    if (!/^\d{3}$/.test(loginPhone)) return setError('手機末三碼須為 3 位數字')

    setLoading(true)
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loginName, phoneLast3: loginPhone }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.push('/checkin')
    else setError(data.msg)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!regName || !regPhone) return setError('請填寫所有必填欄位')
    if (!/^\d{3}$/.test(regPhone)) return setError('手機末三碼須為 3 位數字')

    setLoading(true)
    const res  = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regName, phoneLast3: regPhone, joinDate: regDate, level: regLevel }),
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
          <div className="text-5xl">🌟</div>
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
                <Label htmlFor="login-phone">手機末三碼</Label>
                <Input id="login-phone" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} maxLength={3} placeholder="例：789" />
                <p className="text-xs text-muted-foreground">用於驗證身分，不儲存原始號碼</p>
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" disabled={loading}>
                {loading ? '登入中…' : '登入'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">姓名</Label>
                <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} placeholder="請輸入您的姓名" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">手機末三碼</Label>
                <Input id="reg-phone" value={regPhone} onChange={e => setRegPhone(e.target.value)} maxLength={3} placeholder="例：789" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-date">加入日期</Label>
                <Input id="reg-date" type="date" value={regDate} onChange={e => setRegDate(e.target.value)} />
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
