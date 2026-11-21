'use client';

import { useState } from 'react';
import { Camera, Loader2, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'Gagal masuk. Coba lagi.');
        setPending(false);
        return;
      }

      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next && next.startsWith('/admin') ? next : '/admin');
    } catch {
      setError('Tidak bisa menghubungi server. Periksa koneksi.');
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Camera className="h-4 w-4" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-zinc-900">Fotoyuk</span>
          <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            Admin
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(9,9,11,0.35)]"
        >
          <h1 className="text-[15px] font-bold tracking-tight text-zinc-900">Masuk ke panel</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            Hanya untuk pengelola template. Sesi berakhir otomatis dalam 8 jam.
          </p>

          <label htmlFor="admin-password" className="mt-5 block text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Kata sandi
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-3 text-[13px] text-zinc-900 outline-none transition-colors focus:border-zinc-900"
            />
          </div>

          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || password.length === 0}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[13px] font-bold text-white transition-colors hover:bg-black disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? 'Memeriksa' : 'Masuk'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11.5px] text-zinc-500">
          Kata sandi diatur lewat environment <span className="font-mono">ADMIN_PASSWORD</span>.
        </p>
      </div>
    </main>
  );
}
