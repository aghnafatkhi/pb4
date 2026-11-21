const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://lovyubuy.vercel.app';

export const SITE_URL = raw.replace(/\/+$/, '');
