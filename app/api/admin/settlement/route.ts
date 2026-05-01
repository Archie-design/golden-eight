import { NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei } from '@/lib/api-helper'
import { runSettlement } from '@/lib/settlement'

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const body = await req.json().catch(() => ({})) as { yearMonth?: string }
  const today     = getTodayTaipei()
  const yearMonth = /^\d{4}-\d{2}$/.test(body.yearMonth ?? '')
    ? body.yearMonth!
    : today.substring(0, 7)

  const { results, exempted } = await runSettlement(db, yearMonth, today)

  const exemptedSuffix = exempted.length ? `；${exempted.length} 位新進不參與計分（${exempted.map(e => e.name).join('、')}）` : ''
  return NextResponse.json({ ok: true, msg: `月結完成（${yearMonth}）${exemptedSuffix}`, results, exempted })
}
