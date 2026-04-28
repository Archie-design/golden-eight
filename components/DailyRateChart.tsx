'use client'

import { useState } from 'react'

export function DailyRateChart({
  calendar,
  threshold,
}: {
  calendar: { day: number; score: number | null }[]
  threshold: number
}) {
  const total = calendar.length
  const [startDay, setStartDay] = useState(1)
  const [endDay,   setEndDay]   = useState(total)

  const W = 400, H = 200
  const PAD = { top: 28, right: 36, bottom: 22, left: 32 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const span   = endDay - startDay
  const xPos   = (day: number) => PAD.left + ((day - startDay) / Math.max(span, 1)) * innerW
  const yPos   = (pct: number) => PAD.top  + (1 - pct / 100) * innerH

  const threshPct = Math.round(threshold * 100)
  const threshY   = yPos(threshPct)
  const yTicks    = [0, 25, 50, 75, 100]

  const filtered = calendar.filter(d => d.day >= startDay && d.day <= endDay)

  // Polyline segments — break on null gaps
  const segments: string[][] = []
  let cur: string[] = []
  for (const d of filtered) {
    if (d.score !== null) {
      cur.push(`${xPos(d.day)},${yPos(Math.round((d.score / 8) * 100))}`)
    } else {
      if (cur.length) { segments.push(cur); cur = [] }
    }
  }
  if (cur.length) segments.push(cur)

  const dots = filtered
    .filter(d => d.score !== null)
    .map(d => ({
      x:    xPos(d.day),
      y:    yPos(Math.round((d.score! / 8) * 100)),
      rate: Math.round((d.score! / 8) * 100),
    }))

  // X-axis labels: every day when span ≤ 10, else ~5 evenly spaced
  const xLabelDays: number[] = []
  if (span <= 10) {
    for (let d = startDay; d <= endDay; d++) xLabelDays.push(d)
  } else {
    const step = Math.ceil(span / 4)
    for (let d = startDay; d <= endDay; d += step) xLabelDays.push(d)
    if (xLabelDays[xLabelDays.length - 1] !== endDay) xLabelDays.push(endDay)
  }

  const presets: { label: string; s: number; e: number }[] = [
    { label: '全月', s: 1, e: total },
    ...(total > 10 ? [{ label: '1–10', s: 1, e: 10 }] : []),
    ...(total > 10 ? [{ label: `11–${Math.min(20, total)}`, s: 11, e: Math.min(20, total) }] : []),
    ...(total > 20 ? [{ label: `21–${total}`, s: 21, e: total }] : []),
  ]

  return (
    <div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {presets.map(p => {
          const active = p.s === startDay && p.e === endDay
          return (
            <button
              key={p.label}
              onClick={() => { setStartDay(p.s); setEndDay(p.e) }}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                active
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white/70 text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yPos(t)} y2={yPos(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 4} y={yPos(t) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{t}</text>
          </g>
        ))}

        <line
          x1={PAD.left} x2={W - PAD.right}
          y1={threshY}  y2={threshY}
          stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3"
        />
        <text x={W - PAD.right + 3} y={threshY + 4} fontSize={9} fill="#f97316">{threshPct}%</text>

        {segments.map((seg, i) => seg.length > 1 && (
          <polyline
            key={i}
            points={seg.join(' ')}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {dots.map((p, i) => {
          const labelY = p.y - (i % 2 === 0 ? 10 : 20)
          const color  = p.rate >= threshPct ? '#fbbf24' : '#ef4444'
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3.5} fill={color} stroke="white" strokeWidth={1.5} />
              <text x={p.x} y={labelY} fontSize={8} fill={color} textAnchor="middle" fontWeight="600">
                {p.rate}%
              </text>
            </g>
          )
        })}

        {xLabelDays.map(d => (
          <text key={d} x={xPos(d)} y={H - 4} fontSize={9} fill="#9ca3af" textAnchor="middle">{d}</text>
        ))}
      </svg>
    </div>
  )
}
