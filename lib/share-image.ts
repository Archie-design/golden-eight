// ============================================================
// 黃金八套餐 — DOM 轉圖片 + 系統分享（打卡完成截圖用）
// ============================================================
//
// 主路徑：Web Share API（navigator.share({ files })）喚起系統分享單，
//         使用者可直接傳到 LINE 群組或儲存影像到相簿。
// 退化：不支援檔案分享 → 下載 PNG；下載亦不穩（部分 iOS LINE webview）
//       → 交由呼叫端顯示圖片供長按儲存。
//
// 截圖目標卡片僅含文字與 lucide inline SVG，無外部圖片，故無 CORS 污染。

import { toBlob } from 'html-to-image'

export type ShareOutcome =
  | 'shared'        // 已透過系統分享單分享
  | 'cancelled'     // 使用者於分享單取消（正常）
  | 'downloaded'    // 退化為下載
  | 'show-image'    // 連下載都不宜，呼叫端應顯示圖片供長按儲存

export interface ShareResult {
  outcome: ShareOutcome
  /** outcome === 'show-image' 時提供的 blob URL，呼叫端顯示後負責 revoke */
  imageUrl?: string
}

/** 是否為 iOS 裝置（download 在 iOS/LINE webview 常失效，優先走顯示圖片） */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ 會偽裝成 Mac，用觸控點數輔助判斷
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * 將指定 DOM 節點轉為 PNG 並嘗試分享。
 * 截圖前等字型載入完成，避免截出系統 fallback 字型。
 *
 * @param node     要截圖的 DOM 節點
 * @param filename 檔名（分享 / 下載用）
 * @param filterFn html-to-image 的節點過濾（回傳 false 者不入鏡，用來排除按鈕）
 */
export async function captureAndShare(
  node: HTMLElement,
  filename: string,
  filterFn?: (el: HTMLElement) => boolean,
): Promise<ShareResult> {
  // 等字型載入，否則截圖字型 fallback
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready
  }

  const blob = await toBlob(node, {
    pixelRatio: 2,           // 提高解析度，群組裡看得清楚
    cacheBust: true,
    filter: filterFn ? (el) => filterFn(el as HTMLElement) : undefined,
  })
  if (!blob) throw new Error('截圖產生失敗')

  const file = new File([blob], filename, { type: 'image/png' })

  // ① 主路徑：Web Share files
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return { outcome: 'shared' }
    } catch (e) {
      // 使用者取消 → 正常，不視為錯誤
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { outcome: 'cancelled' }
      }
      // 其他分享錯誤 → 落到退化路徑
    }
  }

  // ③ iOS / LINE webview：download 常失效，直接交呼叫端顯示圖片供長按
  if (isIOS()) {
    return { outcome: 'show-image', imageUrl: URL.createObjectURL(blob) }
  }

  // ② 退化：下載
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return { outcome: 'downloaded' }
  } catch {
    // 下載也失敗 → 顯示圖片供長按
    return { outcome: 'show-image', imageUrl: URL.createObjectURL(blob) }
  }
}
