// 共用 cookie 設定 — 審查報告 P2-13
// production 自動加上 secure flag

const IS_PROD = process.env.NODE_ENV === 'production'

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure:   IS_PROD,
  path:     '/',
}

export const AUTH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7   // 7 天；/api/auth/me 會滑動續期

export const SHORT_STATE_MAX_AGE = 600                // 10 分鐘（OAuth state）
