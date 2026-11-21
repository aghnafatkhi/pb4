import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Studio photobooth Fotoyuk: foto solo atau berdua langsung dari browser.',
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
