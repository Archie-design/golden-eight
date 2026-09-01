// ============================================================
// 黃金八套餐 — 請假日查詢 helper
// ============================================================
//
// 請假日從計分分母移除。分母函式（calcMonthStats / expectedCheckinDays）需要
// 「該成員該月請假日集合」。此 helper 供所有分母呼叫點統一撈取，避免各處重複查詢邏輯
// 造成分母不一致（同一人不同頁達成率不同的最大風險）。

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 撈指定成員在某月的請假日集合。
 * @param db         supabase client（service-role）
 * @param memberIds  成員 id 陣列（單人傳 [id]，全員傳全部）
 * @param yearMonth  'YYYY-MM'
 * @returns Record<memberId, Set<'YYYY-MM-DD'>>；無請假者為空 Set
 */
export async function fetchLeaveDates(
  db: SupabaseClient,
  memberIds: string[],
  yearMonth: string,
): Promise<Record<string, Set<string>>> {
  const out: Record<string, Set<string>> = {}
  for (const id of memberIds) out[id] = new Set()
  if (memberIds.length === 0) return out

  const monthStart = `${yearMonth}-01`
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  const { data } = await db
    .from('leave_records')
    .select('member_id, date')
    .in('member_id', memberIds)
    .gte('date', monthStart)
    .lte('date', monthEnd)

  ;((data ?? []) as { member_id: string; date: string }[]).forEach(r => {
    (out[r.member_id] ??= new Set()).add(r.date)
  })
  return out
}
