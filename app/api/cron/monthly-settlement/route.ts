import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayTaipei } from '@/lib/api-helper'
import { runSettlement } from '@/lib/settlement'

// GET /api/cron/monthly-settlement
// Vercel Cron 於每月 1 日 05:00 UTC（=13:00 Taipei）觸發，自動結算上個月。
// 排程必須晚於 12:00 Taipei，因打卡邏輯日界線在中午 12:00 — 5/1 12:00 前還可補打 4/30 的卡。
// 13:00 Taipei 留 1 小時 buffer，確保上月所有打卡已截止。
// 跳過已月結的列由 monthly_summary 的 (member_id, year_month) UNIQUE 與 upsert 處理；重跑安全。
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ''}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized' }, { status: 401 })
  }

  const db    = createServerClient()
  const today = getTodayTaipei()

  // 上個月（YYYY-MM）— 取「今天往前 1 個月」的月份字串
  const [y, m] = today.split('-').map(Number)
  const prev   = new Date(y, m - 2, 1)  // m 已經是 1-indexed，往前一個月 = m-2
  const prevYearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

  const { results, exempted } = await runSettlement(db, prevYearMonth, today)

  console.log('[cron/monthly-settlement]', prevYearMonth,
    `settled=${results.length}`,
    `exempted=${exempted.length}`,
    `passing=${results.filter(r => r.passing).length}`,
  )

  return NextResponse.json({ ok: true, yearMonth: prevYearMonth, results, exempted })
}
