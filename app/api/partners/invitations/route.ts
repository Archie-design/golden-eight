import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

/**
 * GET /api/partners/invitations
 * 回傳 { sent: [...], received: [...] }，皆為 status='pending' 的邀請。
 * 已含對方姓名/等級，供 UI 直接渲染。
 */
export async function GET() {
  const auth = await getCurrentMember()
  if (auth instanceof NextResponse) return auth
  const { member, db } = auth

  // sent：我發出、對方尚未回應
  // received：對方發給我、我尚未回應
  const [sentRes, receivedRes] = await Promise.all([
    db.from('partner_requests')
      .select('id, target_id, status, requested_at')
      .eq('requester_id', member.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),
    db.from('partner_requests')
      .select('id, requester_id, status, requested_at')
      .eq('target_id', member.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),
  ])

  const sent     = (sentRes.data     ?? []) as { id: number; target_id: string;    status: string; requested_at: string }[]
  const received = (receivedRes.data ?? []) as { id: number; requester_id: string; status: string; requested_at: string }[]

  const otherIds = [
    ...sent.map(r => r.target_id),
    ...received.map(r => r.requester_id),
  ]
  if (otherIds.length === 0) {
    return NextResponse.json({ ok: true, sent: [], received: [] })
  }

  const { data: members } = await db
    .from('members')
    .select('id, name, level')
    .in('id', otherIds)
  const byId = new Map(
    ((members ?? []) as { id: string; name: string; level: string }[])
      .map(m => [m.id, m] as const)
  )

  return NextResponse.json({
    ok: true,
    sent: sent.map(r => ({
      id:           r.id,
      requestedAt:  r.requested_at,
      other:        byId.get(r.target_id) ?? { id: r.target_id, name: '?', level: '?' },
    })),
    received: received.map(r => ({
      id:           r.id,
      requestedAt:  r.requested_at,
      other:        byId.get(r.requester_id) ?? { id: r.requester_id, name: '?', level: '?' },
    })),
  })
}
