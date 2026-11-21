import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_TTL_SECONDS, createAdminToken } from '@/lib/adminSession';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; first: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function sameValue(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Panel admin belum dikonfigurasi.' }, { status: 503 });
  }

  const key = clientKey(request);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry) {
    if (now - entry.first > WINDOW_MS) attempts.delete(key);
    else if (entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' },
        { status: 429 },
      );
    }
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    password = '';
  }

  if (!password || !sameValue(password, expected)) {
    const current = attempts.get(key);
    if (current && now - current.first <= WINDOW_MS) current.count += 1;
    else attempts.set(key, { count: 1, first: now });

    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'Kata sandi salah.' }, { status: 401 });
  }

  attempts.delete(key);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: await createAdminToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_TTL_SECONDS,
  });
  return response;
}
