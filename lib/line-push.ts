// ============================================================
// 黃金八套餐 — LINE Messaging API 推播
// ============================================================
//
// 注意：推播用的是 Messaging API channel 的 LINE_CHANNEL_ACCESS_TOKEN，
// 與 LINE Login 綁定用的 LINE_CHANNEL_ID / LINE_CHANNEL_SECRET 是不同 channel、
// 不同用途，切勿混用。
//
// 前提：收件人必須已加官方帳號好友，否則 API 會回錯誤。

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push'

export interface PushResult {
  sent:   string[]
  failed: { userId: string; msg: string }[]
}

/**
 * 推播純文字訊息給多位使用者。
 *
 * 個別收件人失敗會被隔離：記錄於 `failed` 並繼續推播其餘收件人，
 * 不拋出例外、不中斷流程（呼叫端的快照資料不應因推播失敗而失效）。
 */
export async function pushTextToUsers(userIds: string[], text: string): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const result: PushResult = { sent: [], failed: [] }

  if (!token) {
    console.error('[line-push] LINE_CHANNEL_ACCESS_TOKEN 未設定，略過推播')
    return { sent: [], failed: userIds.map(userId => ({ userId, msg: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' })) }
  }

  for (const userId of userIds) {
    try {
      const res = await fetch(LINE_PUSH_ENDPOINT, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
      })

      if (res.ok) {
        result.sent.push(userId)
      } else {
        const body = await res.text().catch(() => '')
        const msg  = `HTTP ${res.status} ${body.slice(0, 200)}`
        console.error('[line-push] push failed', userId, msg)
        result.failed.push({ userId, msg })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[line-push] push threw', userId, msg)
      result.failed.push({ userId, msg })
    }
  }

  return result
}
