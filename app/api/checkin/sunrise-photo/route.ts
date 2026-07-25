// ============================================================
// 日出照上傳（選填，與打卡解耦）
// ============================================================
//
// 前端已壓縮（Canvas → JPEG ~200KB）後以 multipart/form-data 送入。
// 寫入 Storage 走 service-role（前端不直接寫）；path {ym}/{date}_{memberId}.jpg，
// upsert 覆蓋（一日一張）。照片附著於打卡：該日需已有 checkin_records，否則提示先打卡。

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember, getCheckinDayTaipei } from '@/lib/api-helper'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const BUCKET = 'sunrise-photos'
const MAX_BYTES = 1_000_000   // 壓縮後應 ~200KB；1MB 上限防呆（擋未壓縮的原圖）

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`sunrise:${getClientIp(request)}`, 10, 60_000)
  if (rl) return rl

  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  // ── 解析 multipart：file（壓縮後 JPEG）+ date（可選，預設當前邏輯日）──────
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, msg: '請以表單上傳圖片' }, { status: 400 })
  }
  const file = form.get('file')
  const rawDate = form.get('date')
  const date = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate : getCheckinDayTaipei()

  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, msg: '缺少圖片檔' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, msg: '圖片過大，請重試（應自動壓縮）' }, { status: 400 })
  }

  // ── 照片附著於打卡：該日需已有打卡紀錄 ────────────────────────────────
  const { data: rec } = await db
    .from('checkin_records').select('id')
    .eq('member_id', member.id).eq('date', date)
    .maybeSingle()
  if (!rec) {
    return NextResponse.json({ ok: false, msg: '請先完成今日打卡再上傳日出照' }, { status: 409 })
  }

  // ── 上傳 Storage（service-role），path 固定 → upsert 覆蓋 ────────────────
  const ym   = date.substring(0, 7)
  const path = `${ym}/${date}_${member.id}.jpg`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (upErr) {
    console.error('[sunrise-photo] storage upload failed', upErr.message)
    return NextResponse.json({ ok: false, msg: '上傳失敗，請再試一次' }, { status: 500 })
  }

  // ── 寫 path 到該打卡紀錄 ──────────────────────────────────────────────
  const { error: updErr } = await db
    .from('checkin_records').update({ sunrise_photo_path: path })
    .eq('member_id', member.id).eq('date', date)
  if (updErr) {
    console.error('[sunrise-photo] update path failed', updErr.message)
    return NextResponse.json({ ok: false, msg: '照片已上傳但關聯失敗，請再試一次' }, { status: 500 })
  }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ ok: true, data: { url: pub.publicUrl } })
}
