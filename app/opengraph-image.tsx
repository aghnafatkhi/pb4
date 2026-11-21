import { ImageResponse } from 'next/og';

export const alt = 'Fotoyuk — photobooth online gratis untuk foto solo atau berdua';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                background: '#09090b',
                color: '#ffffff',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              F
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#09090b', letterSpacing: -1 }}>
              Fotoyuk
            </div>
            <div
              style={{
                display: 'flex',
                border: '1px solid #d4d4d8',
                borderRadius: 999,
                padding: '4px 14px',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2,
                color: '#71717a',
              }}
            >
              GRATIS
            </div>
          </div>

          <div
            style={{
              marginTop: 36,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2,
              color: '#09090b',
            }}
          >
            Photobooth online gratis, langsung dari browser.
          </div>
          <div style={{ marginTop: 24, fontSize: 26, lineHeight: 1.45, color: '#52525b' }}>
            Foto solo tanpa unggah, atau berdua lewat kode room. Template, filter, unduh PNG.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 300,
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: 20,
            padding: 14,
            transform: 'rotate(-3deg)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((row) => (
              <div key={row} style={{ display: 'flex', gap: 8 }}>
                {[0, 1].map((col) => (
                  <div
                    key={col}
                    style={{
                      flex: 1,
                      height: 118,
                      borderRadius: 8,
                      background: 'linear-gradient(180deg, #e4e4e7 0%, #f4f4f5 100%)',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #e4e4e7',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 4, color: '#09090b' }}>
                FOTOYUK
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#a1a1aa' }}>SOLO · BERDUA</div>
            </div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#a1a1aa' }}>750 × 1050</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
