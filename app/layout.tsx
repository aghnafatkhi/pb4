import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Fotoyuk — Photobooth Online Gratis, Foto Solo atau Berdua',
    template: '%s · Fotoyuk',
  },
  description:
    'Photobooth online gratis langsung di browser. Foto solo tanpa koneksi atau photo booth berdua lewat kode room, lengkap dengan template, filter, dan hasil photo strip siap unduh.',
  keywords: [
    'photobooth online',
    'photobooth online gratis',
    'photo booth online',
    'photo booth online gratis',
    'photobooth gratis',
    'photo strip online',
    'foto strip online',
    'photobooth solo',
    'photobooth berdua',
    'photo booth virtual',
    'fotoyuk',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Fotoyuk',
    locale: 'id_ID',
    title: 'Fotoyuk — Photobooth Online Gratis',
    description:
      'Bikin photo strip di browser: foto solo sendiri atau berdua lewat kode room. Template siap pakai, filter, unduh PNG. Gratis, tanpa akun.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fotoyuk — Photobooth Online Gratis',
    description:
      'Photobooth online gratis di browser. Foto solo atau berdua, pilih template, unduh photo strip.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
