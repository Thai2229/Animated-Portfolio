import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const alt = 'Thai Van Le. Three sects, three things I built.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const font = await readFile(
    path.join(process.cwd(), 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff'),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 80,
          color: '#f4efe4',
          fontFamily: 'Cormorant Garamond',
          background: 'linear-gradient(180deg, #a9b8c4 0%, #1a2229 70%, #11161b 100%)',
        }}
      >
        <div style={{ fontSize: 120, lineHeight: 1 }}>Thai Van Le</div>
        <div style={{ fontSize: 48, marginTop: 20, color: '#e0b36a' }}>Three sects, three things I built.</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Cormorant Garamond', data: font, weight: 500, style: 'normal' }] },
  );
}
