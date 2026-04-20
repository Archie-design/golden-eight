# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type check only
```

No test suite is configured.

## Architecture

**黃金八套餐定課系統** is a gamified daily check-in/habit-tracking app. Members complete 8 daily tasks, earn points, and face monthly financial penalties if they miss targets.

### Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** (PostgreSQL) — `service_role` key only; all DB access is server-side; RLS enabled on every table (service_role bypasses it automatically)
- **Custom JWT auth** — HS256, **7-day expiry** with sliding renewal; stored in httpOnly cookie; `jose` library
- **Tailwind CSS 4** + **shadcn/ui** components

### Auth Pattern

Every protected API route calls `getCurrentMember()` from `lib/api-helper.ts`, which reads the JWT, verifies the `tv` (token_version) claim against the DB, and returns the member or a 401 Response. Admin routes call `requireAdmin()` instead — it re-queries `is_admin` from the DB on every request, never trusting the JWT payload.

Protected UI lives under `app/(main)/` — the layout calls `/api/auth/me`, which also re-issues a fresh 7-day cookie (sliding renewal).

Login identifies members by **name + full 10-digit phone number**. The phone is stored as `phone_hash` (HMAC-SHA256 with `PHONE_PEPPER`). Old accounts with only `phone_last3` migrate lazily on first login.

### Key lib Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | `createToken` / `verifyToken` — JWT includes `sub`, `isAdmin`, `tv` |
| `lib/api-helper.ts` | `getCurrentMember`, `requireAdmin`, Taipei time helpers (`getTodayTaipei`, `getCheckinDayTaipei`) |
| `lib/scoring.ts` | Pure functions: `calcBaseScore`, `calcMonthStats`, `calcNewAchievementsFromAggregates`, `calcPenalty` |
| `lib/constants.ts` | 8 tasks, level thresholds, 49 achievement definitions |
| `lib/phone.ts` | `hashPhone(phone)` — HMAC-SHA256 with `PHONE_PEPPER` env var |
| `lib/rate-limit.ts` | In-memory per-IP rate limiter; `checkRateLimit(key, limit, windowMs)` returns 429 Response or null |
| `lib/cookie-options.ts` | `AUTH_COOKIE_OPTIONS` (secure in prod), `AUTH_TOKEN_MAX_AGE` (7 days) |
| `lib/csv.ts` | `csvField` / `csvRow` — formula-injection-safe CSV output |
| `lib/sunrise.ts` | `getSunriseTime(date)` — DB-cached (`sunrise_cache` table); `addMinutes(hhmm, n)` |
| `lib/validation.ts` | Zod schemas for all API inputs |

### Check-in Day Boundary

The logical check-in day uses **noon (12:00 Taipei) as the day boundary**. Before noon, `getCheckinDayTaipei()` returns yesterday's date. This means a member at 10:00 AM on 5/1 is still checking in for 4/30. Use `getCheckinDayTaipei()` for check-in logic; use `getTodayTaipei()` only for calendar/display purposes.

### Data Model Highlights

- **`members`** — id `M001…`, `phone_hash`, `token_version` (JWT revocation), `failed_attempts` / `locked_until` (login lockout), `line_user_id`
- **`checkin_records`** — `tasks BOOLEAN[8]`; `punch_bonus` is always 0 (feature suspended); one row per member per day (UNIQUE)
- **`monthly_summary`** — `rate`, `passing`, `penalty` (NT$), `is_dawn_king`
- **`achievements`** — 49 badge codes; UNIQUE(member_id, code)
- **`schedule_template`** — `block_tags JSONB` (`[{id,name,color,emoji}]`); replaced old `tag_id`/`tag_name` columns
- **`sunrise_cache`** — cross-instance DB cache for external sunrise API calls

### Postgres RPC Functions

Two PL/pgSQL functions handle operations that require atomicity or set-based SQL:

- `replace_schedule_template(p_member_id, p_is_public, p_blocks)` — atomic delete + insert for schedule saves
- `remove_tag_from_templates(p_member_id, p_tag_id)` — removes a tag from all schedule blocks using `jsonb_array_elements`

Call via `db.rpc('function_name', { args })`.

### Scoring Logic

In `lib/scoring.ts` and `lib/constants.ts`:
- Base score = completed task count (0–8); `punch_bonus` fixed at 0
- Monthly pass: Gold ≥80%, Silver ≥70%, Bronze ≥60%
- Penalties: Gold NT$200, Silver NT$300, Bronze NT$400
- Achievement calculation on check-in submit uses **aggregate counts + 105-day window** (`calcNewAchievementsFromAggregates`) — does not fetch full history

### Rate Limiting

Applied at: login (10/min/IP), register (5/10min/IP), checkin submit (20/min/IP), tag POST (30/min/IP). In-memory per-instance; acceptable for current scale. All 429 responses include `Retry-After`.

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=           # 32+ chars — also fallback pepper if PHONE_PEPPER unset
PHONE_PEPPER=         # 32+ chars — HMAC pepper for phone_hash; do NOT rotate after first use
LINE_CHANNEL_ID=      # LINE Login OAuth
LINE_CHANNEL_SECRET=
LINE_CALLBACK_URL=    # https://<host>/api/auth/line/callback
CRON_SECRET=          # Bearer token verified by /api/cron/daily-reminder
```

### API Response Shape

All routes return `ApiResult<T>`:
```ts
{ ok: true, data: T } | { ok: false, msg: string }
```

### Database Migrations

Schema ground truth: `supabase/schema.sql` (bootstrap a new environment).  
Incremental changes: `supabase/migrations/` — apply in order to an existing DB via Supabase SQL Editor.
