// CSV 欄位安全輸出 — 審查報告 P1-5
// 1. 以 =/+/-/@/Tab/CR 開首的值前綴單引號，阻止 Excel 當公式執行
// 2. 含逗號/引號/換行的值以雙引號包裹；內層引號雙寫跳脫

const FORMULA_TRIGGER = /^[=+\-@\t\r]/

export function csvField(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (FORMULA_TRIGGER.test(s)) s = "'" + s
  if (/[",\r\n]/.test(s))      s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvField).join(',')
}
