// ============================================================
// 日出照三個月清理（每日 cron）
// ============================================================
//
// 保留 12 週（約三個月）以控制 Supabase 免費版 Storage 空間。
// 刪除 date < cutoff 且 sunrise_photo_path 非空者：先刪 Storage 檔、再清空 DB path。
// CRON_SECRET 授權；個別失敗記錄不中斷其餘。
//
// 排程（vercel.json）：台北 04:00 = UTC 20:00，離峰，與 daily-digest(12:30)/settlement(13:00) 錯開。

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayTaipei } from '@/lib/api-helper'

const BUCKET = 'sunrise-photos'
const RETENTION_WEEKS = 12

/** 今日往前 n 週的日期字串（YYYY-MM-DD） */
function weeksAgo(todayStr: string, weeks: number): string {
  const [y, m, d] = todayStr.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) - weeks * 7 * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ''}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized' }, { status: 401 })
  }

  const db     = createServerClient()
  const cutoff = weeksAgo(getTodayTaipei(), RETENTION_WEEKS)

  // 逾期且仍有照片的紀錄
  const { data, error } = await db
    .from('checkin_records')
    .select('id, sunrise_photo_path')
    .lt('date', cutoff)
    .not('sunrise_photo_path', 'is', null)

  if (error) {
    console.error('[cron/sunrise-cleanup] query failed', error.message)
    return NextResponse.json({ ok: false, msg: '查詢失敗' }, { status: 500 })
  }

  const rows = (data ?? []) as { id: number; sunrise_photo_path: string }[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, cutoff, removed: 0, msg: '無逾期照片' })
  }

  const paths = rows.map(r => r.sunrise_photo_path)

  // 先刪 Storage 檔（批次；個別不存在不影響整體）
  const { error: rmErr } = await db.storage.from(BUCKET).remove(paths)
  if (rmErr) {
    // 記錄但續行——DB path 仍應清空，避免指向已不該存在的檔
    console.error('[cron/sunrise-cleanup] storage remove error', rmErr.message)
  }

  // 清空 DB path（不刪 checkin_records 本身，只清照片欄）
  const { error: updErr } = await db
    .from('checkin_records')
    .update({ sunrise_photo_path: null })
    .in('id', rows.map(r => r.id))
  if (updErr) {
    console.error('[cron/sunrise-cleanup] clear path failed', updErr.message)
    return NextResponse.json({ ok: false, cutoff, msg: 'path 清空失敗' }, { status: 500 })
  }

  console.log('[cron/sunrise-cleanup]', `cutoff=${cutoff}`, `removed=${rows.length}`)
  return NextResponse.json({ ok: true, cutoff, removed: rows.length })
}
