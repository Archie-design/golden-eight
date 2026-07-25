// ============================================================
// 黃金八套餐 — 前端圖片壓縮（日出照上傳用）
// ============================================================
//
// 手機日出原圖常 3~8MB，Supabase 免費版 Storage 僅 1GB，不壓縮一個月內必爆。
// 上傳前於前端以 Canvas 縮至長邊 ≤ maxEdge、輸出 JPEG，目標約 200KB。
// 純前端、無外部依賴。手機直拍常帶 EXIF 旋轉，以 imageOrientation 修正避免躺平。

export interface CompressOptions {
  /** 長邊最大像素（等比縮放） */
  maxEdge?: number
  /** JPEG 品質 0–1 */
  quality?: number
  /** 目標檔案大小（bytes）；超過則以較低品質二次重壓 */
  targetBytes?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxEdge:     1280,
  quality:     0.8,
  targetBytes: 220 * 1024,   // ~200KB 上限（留一點餘裕）
}

/**
 * 將使用者選的圖片檔壓縮為 JPEG Blob。
 * @throws 非圖片檔、解碼失敗、或環境不支援 Canvas 時拋錯（呼叫端 toast 提示）。
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const { maxEdge, quality, targetBytes } = { ...DEFAULTS, ...opts }

  if (!file.type.startsWith('image/')) {
    throw new Error('請選擇圖片檔')
  }

  // 解碼（修正 EXIF 方向，避免手機直拍照躺平）
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('圖片解碼失敗，請換一張')
  }

  // 等比縮放：長邊 ≤ maxEdge
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('瀏覽器不支援圖片處理')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const toBlob = (q: number): Promise<Blob | null> =>
    new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q))

  let blob = await toBlob(quality)
  // 仍超過目標大小 → 降品質二次重壓（一次即可，避免無限逼近）
  if (blob && blob.size > targetBytes) {
    const retry = await toBlob(0.6)
    if (retry && retry.size < blob.size) blob = retry
  }
  if (!blob) throw new Error('圖片壓縮失敗，請再試一次')

  return blob
}
