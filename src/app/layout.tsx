import type { Metadata, Viewport } from 'next';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/noto-serif/latin-400.css';
import '@fontsource/noto-serif/latin-600.css';
import './globals.css';

const description =
  'Thai Van Le, software engineer at UC San Diego. Three projects, each guarded by a sect in an interactive 3D valley: veryshrt, a Productivity App and a 2D Physics Engine.';

export const metadata: Metadata = {
  title: 'Thai Van Le',
  description,
  openGraph: { title: 'Thai Van Le', description, type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Thai Van Le', description },
};

export const viewport: Viewport = { themeColor: '#a9b8c4' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
