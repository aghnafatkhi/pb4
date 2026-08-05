import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dari Ghina Dari Aghna',
  description: 'Shared Photobooth for Ghina & Aghna',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${playfair.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-[#FDFBF9] text-[#2C2825] antialiased selection:bg-[#E8DED5] selection:text-[#2C2825]">
        {children}
      </body>
    </html>
  );
}
