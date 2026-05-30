import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

/**
 * GET /api/partners/search?q=<keyword>
 * 依姓名搜尋活躍成員，排除自己 + 已有「任何狀態」關係的成員
 * （pending / accepted 都排除；rejected 不排除以便讓使用者重邀，但 invite API 會擋冷卻）。
 */
export async function GET(req: NextRequest) {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length === 0) {
    return NextResponse.json({ ok: true, results: [] })
  }

  // 1. 取所有與我有 pending / accepted 關係的成員 ID（排除清單）
  const { data: relsRaw } = await db
    .from('partner_requests')
    .select('requester_id, target_id, status')
    .or(`requester_id.eq.${member.id},target_id.eq.${member.id}`)
    .in('status', ['pending', 'accepted'])
  const rels = (relsRaw ?? []) as { requester_id: string; target_id: string; status: string }[]
  const excludeIds = new Set<string>([member.id])
  for (const r of rels) {
    excludeIds.add(r.requester_id === member.id ? r.target_id : r.requester_id)
  }

  // 2. 搜尋活躍成員（姓名模糊匹配）
  const { data: members } = await db
    .from('members')
    .select('id, name, level')
    .eq('status', '活躍')
    .ilike('name', `%${q}%`)
    .order('id')
    .limit(20)

  const results = ((members ?? []) as { id: string; name: string; level: string }[])
    .filter(m => !excludeIds.has(m.id))

  return NextResponse.json({ ok: true, results })
}
