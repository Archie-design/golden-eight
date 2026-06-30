import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Shared Zod schemas ────────────────────────────────────────────────────────

export const LEVELS = ['黃金戰士', '白銀戰士', '青銅戰士'] as const

// 台灣手機格式：09 開頭共 10 位數
const PHONE_RE = /^09\d{8}$/
const PHONE_MSG = '請輸入 10 位數手機號碼（09 開頭）'

export const LoginSchema = z.object({
  name:     z.string().min(1, '請填寫姓名').max(50).transform(s => s.trim()),
  phone:    z.string().regex(PHONE_RE, PHONE_MSG),
  password: z.string().optional(),
})

export const SetPasswordSchema = z.object({
  password:        z.string().min(8, '密碼至少 8 個字元'),
  currentPassword: z.string().optional(),
})

export const RegisterSchema = LoginSchema.extend({
  level:    z.enum(LEVELS, { message: '無效的階梯選項' }),
})

export const CheckInSubmitSchema = z.object({
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tasks:            z.array(z.boolean()).length(8, '任務陣列必須為 8 個布林值'),
  note:             z.string().max(500).optional(),
  work_hours:       z.number().min(0).max(24).optional(),
  early_sleep_half: z.boolean().optional().default(false),
}).refine(
  // 破曉打拳(tasks[1])前置條件：須同時完成早睡早起/子時入睡(tasks[0])。
  // 同一筆打卡內判定，不跨日；早睡只要勾選即算(1 分或 0.5 分皆可)。
  d => !d.tasks[1] || d.tasks[0],
  { message: '要打卡「破曉打拳」前，請先完成「早睡早起（子時入睡）」', path: ['tasks'] },
)

export const NextLevelSchema = z.object({
  level: z.enum(LEVELS, { message: '無效的階梯選項' }),
})

export const ShowcaseSchema = z.object({
  codes: z.array(z.string().min(1).max(64)).max(3, '最多選 3 顆'),
})

export const CreateTagSchema = z.object({
  tagName: z.string().min(1, '請填寫標籤名稱').max(20, '標籤名稱最長 20 字'),
  color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色碼格式錯誤').optional(),
  emoji:   z.string().max(2).optional(),
})

export const DeleteTagSchema = z.object({
  tagId: z.string().min(1, '請提供標籤 ID'),
})

export const SaveTemplateSchema = z.object({
  isPublic: z.boolean(),
  blocks:   z.array(z.object({
    id:        z.number().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, '時間格式錯誤'),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/, '時間格式錯誤'),
    tags:      z.array(z.object({
      id:    z.string().nullish(),
      name:  z.string(),
      color: z.string(),
      emoji: z.string().nullish(),
    })),
  })),
})

export const AddMemberSchema = z.object({
  name:  z.string().min(1).max(50).transform(s => s.trim()),
  phone: z.string().regex(PHONE_RE, PHONE_MSG),
  level: z.enum(LEVELS),
})

export const BatchDeactivateSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, '至少需選擇一位成員').max(100, '單次最多 100 人'),
})

// ── 夥伴系統 ─────────────────────────────────────────────────

const MEMBER_ID_RE = /^M\d+$/

export const PartnerInviteSchema = z.object({
  targetId: z.string().regex(MEMBER_ID_RE, '無效的成員 ID'),
})

export const PartnerInvitationActionSchema = z.object({
  action: z.enum(['accept', 'reject'], { message: '無效的操作' }),
})

// 鼓勵訊息驗證在 route 內動態 import ENCOURAGE_MESSAGES（避免 constants → validation 循環依賴）
export const PartnerEncourageSchema = z.object({
  message: z.string().min(1).max(50),
})

// ── Helper: parse request body with schema, return error response on failure ──

export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T } | NextResponse> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, msg: '無效的 JSON 格式' }, { status: 400 })
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? '輸入資料驗證失敗'
    return NextResponse.json({ ok: false, msg }, { status: 400 })
  }
  return { data: result.data }
}
