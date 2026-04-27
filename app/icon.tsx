import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '80px',
        }}
      >
        <span
          style={{
            fontSize: 280,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1,
            letterSpacing: '-8px',
          }}
        >
          八
        </span>
      </div>
    ),
    { ...size },
  )
}
