import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: '40px',
        }}
      >
        <span
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1,
          }}
        >
          八
        </span>
      </div>
    ),
    { ...size },
  )
}
