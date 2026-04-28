// ============================================================
// 共用 SELECT 欄位白名單
//
// 集中管理需要從各表撈取的欄位組合，避免：
//   1. select('*') 拉到不必要的敏感欄位（phone_*, password_hash 等）
//   2. 各 route 寫法不一致導致回傳格式漂移
// ============================================================

/** members 統計／排行用：滿足 Member type 的必填欄位 + 等級設定 */
export const MEMBER_COLS_STATS =
  'id, name, level, join_date, effective_start_date, next_level, is_admin, status, created_at'

/** members 月結用：與 STATS 同（業務邏輯已不需要敏感欄位） */
export const MEMBER_COLS_SETTLEMENT = MEMBER_COLS_STATS

/** checkin_records 統計用：滿足 CheckInRecord type 的必填欄位 */
export const RECORD_COLS_STATS =
  'id, member_id, date, tasks, total_score, base_score, punch_bonus, punch_streak, work_hours, note, submit_time'

/** checkin_records 月結用：與 STATS 同 */
export const RECORD_COLS_SETTLEMENT = RECORD_COLS_STATS
