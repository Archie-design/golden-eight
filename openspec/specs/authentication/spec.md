# Authentication Capability

## Purpose

提供成員身分識別、登入授權與管理員授權機制。以姓名 + 完整手機號碼 + 密碼為主要識別憑證，輔以 LINE OAuth 快速登入；以 JWT (HS256, 7 天 TTL, sliding renewal) 維持登入狀態，支援 token 撤銷、帳號鎖定、管理員授權雙重檢查等安全控制。

## Requirements

### Requirement: 帳號註冊
系統 SHALL 接受姓名 + 完整 10 位手機號碼（09 開頭）+ 加入日 + 階梯選擇進行註冊。手機號碼 SHALL 以 HMAC-SHA256（PHONE_PEPPER）產生 `phone_hash` 儲存，原始號碼亦儲存於 `phone_full`（部分唯一索引）。`effective_start_date` SHALL 由 `computeEffectiveStartDate()` 依加入時間計算（< 12:00 加入日當天，≥ 12:00 加入日 +1）。

#### Scenario: 註冊成功
- **WHEN** 新成員以未使用過的姓名 + 手機提交註冊
- **THEN** `members` 新增記錄，`phone_hash` 與 `phone_full` 寫入，`effective_start_date` 依 12:00 規則設定

#### Scenario: 重複手機號碼
- **WHEN** 註冊提交的手機號碼已存在於 `phone_full`
- **THEN** API 回傳 409，拒絕註冊

---

### Requirement: 密碼登入
系統 SHALL 以姓名 + 完整 10 位手機 + 密碼進行登入比對。密碼比對使用 scrypt hash（`lib/password.ts`）。已設定密碼者 MUST 提供密碼；尚未設定密碼者（`password_hash IS NULL`）SHALL 允許登入但 SHALL 在 `(main)/layout.tsx` 強制導向 `/setup-password`。

#### Scenario: 登入成功
- **WHEN** 成員提交正確姓名 + 手機 + 密碼
- **THEN** 系統簽發 7 天 JWT 寫入 httpOnly cookie，`failed_attempts` 重置為 0

#### Scenario: 首次登入未設密碼
- **WHEN** 已有帳號但 `password_hash IS NULL` 的成員提交姓名 + 手機（無密碼）
- **THEN** 後端允許登入，前端 layout 偵測後強制導向 `/setup-password`

#### Scenario: 舊帳號自動遷移
- **WHEN** 僅有 `phone_last3` 的舊帳號首次以完整手機號碼登入
- **THEN** 系統自動寫入 `phone_hash` 與 `phone_full` 完成遷移，登入繼續

---

### Requirement: 帳號鎖定
系統 SHALL 對同一帳號連續 5 次登入失敗後鎖定 15 分鐘。`failed_attempts` 遞增、`locked_until` 設為現在 +15 分鐘。鎖定期間任何登入嘗試 MUST 拒絕。

#### Scenario: 連續失敗達上限
- **WHEN** 同一帳號連續 5 次提交錯誤密碼
- **THEN** `locked_until` 設為現在 +15 分鐘，第 5 次回應提示鎖定

#### Scenario: 鎖定期間嘗試登入
- **WHEN** 帳號 `locked_until > NOW()` 時提交登入
- **THEN** API 回傳 401 並提示鎖定剩餘時間

---

### Requirement: JWT 簽發與驗證
JWT MUST 使用 HS256 演算法、7 天 TTL，payload 包含 `{ sub, isAdmin, tv }`，並寫入 httpOnly cookie。每次呼叫 `GET /api/auth/me` 時系統 SHALL 重新簽發 7 天 cookie（sliding renewal）。`getCurrentMember()` MUST 同時驗證 token 簽章與 `tv` claim 對應 `members.token_version`。

#### Scenario: JWT 撤銷
- **WHEN** 成員 `token_version` 被遞增（例如管理員強制登出）
- **THEN** 既有 JWT 的 `tv` claim 不再匹配，所有 API 呼叫回傳 401

#### Scenario: Sliding renewal
- **WHEN** 持有有效 JWT 的成員呼叫 `/api/auth/me`
- **THEN** 系統重新簽發 7 天 cookie，延長有效期

---

### Requirement: 管理員授權
管理員相關 API（`/api/admin/*`）MUST 透過 `requireAdmin()` 驗證。`requireAdmin()` SHALL 每次重新查詢 `members.is_admin`，不得僅信任 JWT payload 中的 `isAdmin` claim。

#### Scenario: 一般成員呼叫 admin API
- **WHEN** `is_admin = false` 的成員呼叫 `/api/admin/penalty`
- **THEN** API 回傳 403

#### Scenario: 管理員權限被撤銷後呼叫
- **WHEN** 成員的 `is_admin` 被改為 false 但持有舊 JWT
- **THEN** `requireAdmin()` 從 DB 確認後拒絕，回傳 403

---

### Requirement: LINE OAuth 登入與綁定
系統 SHALL 提供 LINE OAuth 登入（未登入起點 `/api/auth/line/login`）與綁定（已登入起點 `/api/auth/line`）。OAuth 回呼時系統 SHALL 以 `line_user_id` 唯一索引查找帳號。未綁定者 SHALL 回到登入頁附錯誤碼。

#### Scenario: 已綁定 LINE 用戶登入
- **WHEN** 已綁定 `line_user_id` 的成員透過 LINE 快速登入
- **THEN** 系統識別帳號並簽發 JWT cookie

#### Scenario: 未綁定者透過 LINE 登入
- **WHEN** 尚未綁定 LINE 的用戶從登入頁點 LINE 快速登入
- **THEN** OAuth 回呼後因找不到帳號，導回登入頁並附錯誤碼提示

---

### Requirement: Rate Limiting 與 CSRF 緩解
系統 SHALL 對 `/api/auth/login` 套用 per-IP 限流 10 次/分鐘、`/api/auth/register` 5 次/10 分鐘。所有 API MUST 在 `Origin` header 與 `Host` 不一致時回傳 403（CSRF 緩解）。

#### Scenario: 登入請求超過限流
- **WHEN** 同 IP 1 分鐘內提交超過 10 次 `/api/auth/login`
- **THEN** API 回傳 429 並附 `Retry-After` header

#### Scenario: CSRF 跨來源請求
- **WHEN** 請求的 `Origin` 與 `Host` 不一致
- **THEN** API 回傳 403

---

### Requirement: 設定下月階梯
成員 SHALL 在每月 25 日（含）以後可透過 `POST /api/auth/next-level` 選擇下月階梯。系統 SHALL 將選擇寫入 `members.next_level`，月結時自動套用至 `level` 並清空 `next_level`。

#### Scenario: 25 日後設定下月階梯
- **WHEN** 成員在每月 25 日（含）之後提交 `{ level: '黃金戰士' }`
- **THEN** `members.next_level` 更新為 `'黃金戰士'`

#### Scenario: 25 日前嘗試設定
- **WHEN** 成員在每月 24 日（含）之前嘗試設定下月階梯
- **THEN** API 回傳 400 並提示需 25 日後

---

## Data Model

`members` 表（節錄與 authentication 相關欄位）：

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | M001…（`next_member_id()` sequence） |
| name | TEXT | 姓名（與 phone 共同識別） |
| phone_full | TEXT | 完整 10 位號碼，部分唯一索引 |
| phone_hash | TEXT | HMAC-SHA256(phone, PHONE_PEPPER) |
| phone_last3 | TEXT | 棄用，舊帳號相容 |
| password_hash | TEXT | scrypt `salt:hash`，NULL = 未設定 |
| failed_attempts | INT | 連續失敗次數 |
| locked_until | TIMESTAMPTZ | 鎖定截止 |
| token_version | INT | JWT 撤銷版本 |
| join_date | DATE | 加入日 |
| effective_start_date | DATE | 起算計分日 |
| is_admin | BOOLEAN | 管理員 |
| status | TEXT | 活躍/停用 |
| line_user_id | TEXT | LINE userId，部分唯一索引 |
| line_display_name | TEXT | LINE 顯示名 |
| line_picture_url | TEXT | LINE 頭像 URL |

## Notes / Limitations

- Rate limiter 為 per-instance in-memory；多 region 嚴格一致需改 Upstash Ratelimit
- `PHONE_PEPPER` 首次使用後不可更換，否則既有 `phone_hash` 全失效
- `JWT_SECRET` 強制 ≥ 32 字元，無 fallback
