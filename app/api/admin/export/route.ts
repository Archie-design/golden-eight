import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getTodayTaipei, getMonthEnd } from '@/lib/api-helper'
import { countWorkingDays, fetchWeekdayHolidaySet } from '@/lib/working-days'
import { WORK_HOURS_TRACKING_START } from '@/lib/constants'
import { csvRow } from '@/lib/csv'

// GET /api/admin/export?yearMonth=YYYY-MM  → text/csv
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const { db } = admin

  const ymParam   = new URL(req.url).searchParams.get('yearMonth')
  const yearMonth = ymParam && /^\d{4}-\d{2}$/.test(ymParam) ? ymParam : getTodayTaipei().substring(0, 7)

  const { data: summaries } = await db
    .from('monthly_summary')
    .select('*, members(id, name, level, effective_start_date, join_date)')
    .eq('year_month', yearMonth)
    .order('member_id')

  type SummaryRow = {
    members: {
      id: string; name: string; level: string
      effective_start_date: string | null; join_date: string | null
    }
    member_id: string
    total_score: number
    max_score: number
    rate: number
    passing: boolean
    penalty: number
    max_streak: number
    is_dawn_king: boolean
    work_hours_deduction: number
  }

  const rows: SummaryRow[] = summaries ?? []

  // 工時補扣窗口：max(monthStart, WORK_HOURS_TRACKING_START) ~ monthEnd
  // 4 月只計 4/29-4/30；5 月起整月
  const monthStartStr = yearMonth + '-01'
  const monthEndStr   = getMonthEnd(yearMonth)
  const whWindowStart = monthStartStr > WORK_HOURS_TRACKING_START
    ? monthStartStr
    : WORK_HOURS_TRACKING_START

  // 額外撈：窗口平日假日集合（per-member 工作日以此純記憶體計算）+ 各成員紀錄
  const memberIds = rows.map(r => r.member_id)
  const [whHolidaySet, recsRes] = await Promise.all([
    whWindowStart > monthEndStr
      ? Promise.resolve(new Set<string>())
      : fetchWeekdayHolidaySet(whWindowStart, monthEndStr, db),
    memberIds.length
      ? db.from('checkin_records').select('member_id, date, tasks, work_hours')
          .in('member_id', memberIds)
          .gte('date', whWindowStart).lte('date', monthEndStr)
      : Promise.resolve({ data: [] }),
  ])

  // 依成員分組紀錄，稍後以各自 memberWhStart 過濾加總（對齊 settlement 的 per-member 分母）
  const recsByMember: Record<string, { date: string; tasks: boolean[]; work_hours: number | null }[]> = {}
  ;((recsRes.data ?? []) as { member_id: string; date: string; tasks: boolean[]; work_hours: number | null }[])
    .forEach(r => {
      (recsByMember[r.member_id] ??= []).push(r)
    })

  // 每位成員的工時窗口起點 = max(群組窗口, 個人起算日)，以及據此縮減的目標工時/實際工時
  function memberWorkHours(r: SummaryRow): { requiredHours: number; totalWh: number } {
    const memberStart   = r.members?.effective_start_date ?? r.members?.join_date ?? whWindowStart
    const memberWhStart = memberStart > whWindowStart ? memberStart : whWindowStart
    const workingDays   = memberWhStart > monthEndStr ? 0 : countWorkingDays(memberWhStart, monthEndStr, whHolidaySet)
    const totalWh = (recsByMember[r.member_id] ?? [])
      .filter(rec => rec.date >= memberWhStart)
      .reduce((s, rec) => s + (rec.work_hours != null ? rec.work_hours : (rec.tasks[4] ? 8 : 0)), 0)
    return { requiredHours: workingDays * 8, totalWh }
  }

  // P1-5：以 csvField 逐欄跳脫，阻擋公式注入（=/+/-/@）及逗號/引號。
  const header = [
    '成員編號', '姓名', '階梯', '總分', '滿分', '達成率(%)', '通過', '罰款(NT$)',
    '最長連打', '打拳王',
    '登載工時', '目標工時', '工時不足', '工時扣分',
  ]
  const lines  = [
    csvRow(header),
    ...rows.map(r => {
      const { requiredHours, totalWh } = memberWorkHours(r)
      const shortfall = Math.max(0, requiredHours - totalWh)
      return csvRow([
        r.members?.id    ?? '',
        r.members?.name  ?? '',
        r.members?.level ?? '',
        r.total_score,
        r.max_score,
        r.rate,
        r.passing ? '是' : '否',
        r.penalty,
        r.max_streak,
        r.is_dawn_king ? '是' : '否',
        totalWh,
        requiredHours,
        shortfall,
        r.work_hours_deduction ?? 0,
      ])
    }),
  ]

  const csv = '\uFEFF' + lines.join('\r\n')  // UTF-8 BOM for Excel compatibility

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="golden-eight-${yearMonth}.csv"`,
    },
  })
}
