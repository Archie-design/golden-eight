import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const RAYS = [-55, -27, 0, 27, 55]
const GROUND_H = 40

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #bae6fd 0%, #fed7aa 52%, #fbbf24 100%)',
        }}
      >
        {/* Ground */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: GROUND_H,
          background: 'linear-gradient(180deg, #d97706, #92400e)',
          display: 'flex',
        }} />

        {/* Rays */}
        {RAYS.map((deg, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: GROUND_H,
            left: '50%',
            width: 8,
            height: 68,
            background: 'linear-gradient(0deg, rgba(254,240,138,0.85), transparent)',
            transformOrigin: 'bottom center',
            transform: `translateX(-4px) rotate(${deg}deg)`,
            borderRadius: '4px',
            display: 'flex',
          }} />
        ))}

        {/* Sun glow */}
        <div style={{
          position: 'absolute',
          bottom: GROUND_H - 4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 60,
          borderRadius: '999px 999px 0 0',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.55) 0%, rgba(251,191,36,0.2) 60%, transparent 80%)',
          display: 'flex',
        }} />

        {/* Sun body */}
        <div style={{
          position: 'absolute',
          bottom: GROUND_H,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 74,
          height: 37,
          borderRadius: '999px 999px 0 0',
          background: 'linear-gradient(180deg, #ffffff 0%, #fef9c3 40%, #fde68a 100%)',
          boxShadow: '0 0 20px 8px rgba(255,255,200,0.7)',
          display: 'flex',
        }} />
      </div>
    ),
    { ...size },
  )
}
