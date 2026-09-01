// 學員請假時可選的事由清單（僅 active）——登入即可讀
import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { db } = result

  const { data } = await db
    .from('leave_reasons').select('label')
    .eq('active', true)
    .order('sort_order').order('id')
  return NextResponse.json({ ok: true, data: (data ?? []).map((r: { label: string }) => r.label) })
}
