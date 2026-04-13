// ============================================================
// 黃金八套餐 — 共用型別定義
// ============================================================

export type Level = '黃金戰士' | '白銀戰士' | '青銅戰士'
export type Status = '活躍' | '停用'

export interface Member {
  id: string
  name: string
  phone_last3: string
  join_date: string         // 'YYYY-MM-DD'
  level: Level
  next_level?: Level | null
  is_admin: boolean
  status: Status
  line_user_id?: string | null
  created_at: string
}

export interface JwtPayload {
  sub: string               // member id
  isAdmin: boolean
}

export interface CheckInRecord {
  id: number
  member_id: string
  date: string              // 'YYYY-MM-DD'
  tasks: boolean[]          // length 8
  base_score: number        // 0-8
  punch_bonus: number       // 0 or 0.5
  total_score: number       // 0-8.5
  note?: string
  submit_time: string
}

export interface MonthlySummary {
  id: number
  member_id: string
  year_month: string        // 'YYYY-MM'
  total_score: number
  max_score: number
  rate: number              // percentage 0-100
  passing: boolean
  penalty: number           // NT$
  max_streak: number
  is_dawn_king: boolean
  settled_at?: string | null
}

export interface Achievement {
  id: number
  member_id: string
  code: string
  unlocked_at: string
}

export interface Tag {
  id: string
  member_id?: string | null
  tag_name: string
  color: string
  emoji?: string | null
  is_system: boolean
  created_at: string
}

export interface ScheduleEntry {
  id: number
  member_id: string
  tag_id?: string | null
  tag_name: string
  start_time: string        // 'HH:MM'
  end_time: string
  note?: string
  is_public: boolean
  updated_at: string
}

// API response shapes
export interface ApiOk<T = void> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  msg: string
}

export type ApiResult<T = void> = ApiOk<T> | ApiError
