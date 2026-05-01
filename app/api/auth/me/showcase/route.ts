import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'
import { ShowcaseSchema, parseBody } from '@/lib/validation'

export async function PATCH(request: NextRequest) {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  const { member, db } = result

  const parsed = await parseBody(request, ShowcaseSchema)
  if (parsed instanceof NextResponse) return parsed
  const { codes } = parsed.data

  // 防作弊：驗證 codes 全部存在於該成員 achievements
  if (codes.length > 0) {
    const { data: owned } = await db
      .from('achievements')
      .select('code')
      .eq('member_id', member.id)
      .in('code', codes)

    const ownedSet = new Set((owned ?? []).map((a: { code: string }) => a.code))
    const invalid  = codes.filter(c => !ownedSet.has(c))
    if (invalid.length > 0) {
      return NextResponse.json(
        { ok: false, msg: `未解鎖的成就無法選為展示：${invalid.join(', ')}` },
        { status: 400 },
      )
    }
  }

  // 去重保留順序
  const unique = Array.from(new Set(codes))

  const { error } = await db.from('members').update({ showcase_codes: unique }).eq('id', member.id)
  if (error) {
    console.error('[showcase] update failed', error)
    return NextResponse.json({ ok: false, msg: '更新失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, codes: unique })
}
