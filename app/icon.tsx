import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

const RAYS = [-66, -44, -22, 0, 22, 44, 66]
const GROUND_H = 110

export default function Icon() {
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

        {/* Rays — emanate from sun centre (bottom: GROUND_H, left: 50%) */}
        {RAYS.map((deg, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: GROUND_H,
            left: '50%',
            width: 18,
            height: 180,
            background: 'linear-gradient(0deg, rgba(254,240,138,0.85), transparent)',
            transformOrigin: 'bottom center',
            transform: `translateX(-9px) rotate(${deg}deg)`,
            borderRadius: '9px',
            display: 'flex',
          }} />
        ))}

        {/* Sun glow halo */}
        <div style={{
          position: 'absolute',
          bottom: GROUND_H - 10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 340,
          height: 170,
          borderRadius: '999px 999px 0 0',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.55) 0%, rgba(251,191,36,0.25) 55%, transparent 75%)',
          display: 'flex',
        }} />

        {/* Sun body — half circle */}
        <div style={{
          position: 'absolute',
          bottom: GROUND_H,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 200,
          height: 100,
          borderRadius: '999px 999px 0 0',
          background: 'linear-gradient(180deg, #ffffff 0%, #fef9c3 40%, #fde68a 100%)',
          boxShadow: '0 0 48px 16px rgba(255,255,200,0.7)',
          display: 'flex',
        }} />
      </div>
    ),
    { ...size },
  )
}
