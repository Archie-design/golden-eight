import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/api-helper'

export async function GET() {
  const result = await getCurrentMember()
  if (result instanceof NextResponse) return result
  return NextResponse.json({ ok: true, user: result.member })
}
