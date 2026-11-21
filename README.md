# Fotoyuk — Photobooth Online Gratis

Photobooth online di browser: **solo** (hasil 2R/4R, diproses lokal di perangkat) dan **berdua** (dua kamera digabung lewat kode room). Live: https://lovyubuy.vercel.app

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- Supabase — sinkronisasi mode berdua (tabel `pb_docs`, realtime)
- Hosting: Vercel

## Struktur

```
src (root)
├── app/            # halaman & API routes (/, /studio, /admin, /privasi)
├── components/     # SoloStudio, editor overlay admin, dsb.
├── lib/            # store (shim Firestore→Supabase), foto, template
├── supabase/       # SQL: schema.sql (setup), hardening.sql (penguatan)
└── middleware.ts   # proteksi /admin
```

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

## Environment variables

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Publishable/anon key |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical URL (default `https://lovyubuy.vercel.app`) |
| `ADMIN_PASSWORD` | — | Mengaktifkan panel `/admin` |
| `ADMIN_SESSION_SECRET` | — | Opsional, kunci HMAC sesi admin (fallback ke ADMIN_PASSWORD) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Untuk API route tulis overlay (server-side saja) |

## Database

Skema & penguatan ada di `supabase/` — jalankan di SQL Editor Supabase sesuai urutan: `schema.sql` dulu, lalu blok-blok `hardening.sql`.
