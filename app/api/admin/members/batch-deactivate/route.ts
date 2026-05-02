import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-helper'
import { parseBody, BatchDeactivateSchema } from '@/lib/validation'

/**
 * POST /api/admin/members/batch-deactivate
 * Body: { memberIds: string[] }
 * Response: { ok: true, succeeded: string[], failed: { id, msg }[] }
 *
 * 循序對每個 ID 套用 status='停用'。部分失敗（成員不存在或已停用）不影響其他 ID。
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const parsed = await parseBody(req, BatchDeactivateSchema)
  if (parsed instanceof NextResponse) return parsed
  const { memberIds } = parsed.data

  const succeeded: string[] = []
  const failed:    { id: string; msg: string }[] = []

  for (const id of memberIds) {
    const { data: existing, error: selErr } = await db
      .from('members')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (selErr || !existing) {
      failed.push({ id, msg: '成員不存在' })
      continue
    }
    if (existing.status === '停用') {
      failed.push({ id, msg: '已停用' })
      continue
    }

    const { error: updErr } = await db.from('members').update({ status: '停用' }).eq('id', id)
    if (updErr) {
      console.error('[batch-deactivate] update failed', id, updErr)
      failed.push({ id, msg: '停用失敗' })
      continue
    }
    succeeded.push(id)
  }

  return NextResponse.json({ ok: true, succeeded, failed })
}
