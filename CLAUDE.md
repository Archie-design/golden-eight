# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

**黃金八套餐定課系統** is a gamified daily check-in/habit-tracking app for a community group. Users complete 8 daily tasks, earn points, and face monthly financial penalties if they miss targets.

### Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** (PostgreSQL) — direct SDK access with `service_role` key (server-side only); no ORM
- **Custom JWT auth** — HS256, 30-day expiry, stored in httpOnly cookies via the `jose` library
- **Tailwind CSS 4** + **shadcn/ui** components

### Directory Layout

```
app/
  page.tsx              # Public login/register page
  (main)/               # Route group — all protected pages
    layout.tsx          # Main layout with navbar
    checkin/            # Daily 8-task check-in UI
    dashboard/          # Stats & progress
    schedule/           # Schedule management
    admin/              # Admin panel
  api/                  # All API routes (auth, checkin, schedule, stats, admin)
lib/
  auth.ts               # JWT sign/verify helpers
  api-helper.ts         # getCurrentMember() — validates JWT, returns member or 401
  scoring.ts            # Pure functions: calcBaseScore, calcPunchBonus, calcMonthStats
  constants.ts          # Game rules: 8 tasks, level thresholds, penalties, achievements
  supabase.ts           # Supabase client (service_role)
  sunrise.ts            # Taiwan sunrise time calculation
types/index.ts          # Shared TypeScript types (Member, CheckInRecord, ApiResult<T>, etc.)
supabase/               # Database schema SQL
components/             # shadcn/ui-based UI components
```

### Auth Pattern

Every protected API route calls `getCurrentMember()` from `lib/api-helper.ts`, which reads the JWT cookie and returns the member or a 401 `Response`. Protected UI lives under `app/(main)/` — the layout handles auth gating.

Login identifies users by **name + last 3 digits of phone number** (no passwords).

### Data Model Highlights

- **`members`** — id like `M001`, level (黃金/白銀/青銅戰士), `is_admin`
- **`checkin_records`** — `tasks` is a `BOOLEAN[8]` array; one row per member per day
- **`monthly_summary`** — aggregated stats with `rate`, `passing`, `penalty` (NT$)
- **`achievements`** — unlocked badge codes per member
- **`tag_library`** / **`schedule_template`** — user-defined schedule entries with system tags

### Scoring Logic

Defined entirely in `lib/scoring.ts` and `lib/constants.ts`:
- Base score = count of completed tasks (0–8)
- Punch bonus = +0.5 for consecutive boxing days (破曉打拳 streak)
- Monthly pass thresholds: Gold 80%, Silver 70%, Bronze 60%
- Penalties on failure: Gold ¥200, Silver ¥300, Bronze ¥400

### Environment Variables

Required in `.env.local` (see `.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET   # 32+ characters
```

### API Response Shape

All API routes return `ApiResult<T>`:
```ts
{ ok: true, data: T } | { ok: false, msg: string }
```
