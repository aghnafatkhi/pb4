import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Camera, Check, Coffee, Users } from 'lucide-react';
import { PRESET_OVERLAYS } from '@/lib/templates';
import { SAWERIA_URL } from '@/components/SupportCard';
import LiveStamp from '@/components/LiveStamp';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Photobooth Online Gratis — Foto Solo atau Berdua',
  description:
    'Fotoyuk adalah photobooth online gratis di browser. Foto solo jadi kertas 2R atau 4R, atau photo booth berdua lewat kode room. Langsung unduh, tanpa akun.',
  alternates: { canonical: '/' },
};

const faqs = [
  {
    q: 'Apakah Fotoyuk gratis?',
    a: 'Ya. Semua mode, template, dan unduhan gratis, tanpa akun, tanpa watermark.',
  },
  {
    q: 'Apa bedanya solo dan berdua?',
    a: 'Solo memotret satu orang dan langsung memproses hasil di perangkat itu juga. Berdua menyatukan dua kamera lewat kode room yang diacak.',
  },
  {
    q: 'Apakah foto diunggah ke server?',
    a: 'Tidak untuk mode solo: foto diproses di browser dan tidak pernah dikirim. Mode berdua butuh server untuk menggabungkan dua kamera, jadi foto dikirim sementara dan dikosongkan saat sesi diulang atau ditutup. Rinciannya ada di halaman Privasi.',
  },
  {
    q: 'Ukuran hasilnya berapa?',
    a: 'Solo 2 pose keluar sebagai kertas 2R (750 × 1050 px), solo 4 pose sebagai 4R grid 2×2 (1125 × 750 px). Mode berdua menghasilkan strip 750 × 1050 px. Semua diunduh sebagai PNG.',
  },
];

function templateBackground(base: string, gradient?: { color2: string; direction: string }) {
  if (!gradient) return base;
  const dirMap: Record<string, string> = {
    'to-b': 'to bottom',
    'to-r': 'to right',
    'to-br': 'to bottom right',
    'to-tr': 'to top right',
  };
  return `linear-gradient(${dirMap[gradient.direction] ?? 'to bottom'}, ${base}, ${gradient.color2})`;
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Fotoyuk',
      url: SITE_URL,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser',
      inLanguage: 'id-ID',
      description:
        'Photobooth online gratis di browser untuk foto solo (cetak 2R atau 4R) maupun photo booth berdua lewat kode room, dengan template dan unduhan PNG tanpa watermark.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
      featureList: [
        'Photobooth online gratis',
        'Foto solo jadi kertas 2R atau 4R',
        'Photo booth berdua lewat kode room',
        'Template dan filter siap pakai',
        'Unduh PNG tanpa watermark',
      ],
      isFamilyFriendly: true,
    },
    {
      '@type': 'WebSite',
      name: 'Fotoyuk',
      url: SITE_URL,
      inLanguage: 'id-ID',
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Fotoyuk, beranda">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Camera className="h-4 w-4" />
            </span>
            <span className="text-[17px] font-bold tracking-tight">Fotoyuk</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-zinc-600 sm:flex" aria-label="Navigasi utama">
            <a href="#ukuran" className="hover:text-zinc-900">Ukuran cetak</a>
            <a href="#template" className="hover:text-zinc-900">Template</a>
            <a href="#faq" className="hover:text-zinc-900">FAQ</a>
          </nav>
          <Link
            href="/studio?mode=solo"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[12px] font-bold text-white transition-colors hover:bg-black"
          >
            Mulai foto
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-zinc-200">
          <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-12 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:pb-16 lg:pt-16">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Photobooth online · gratis
              </p>
              <h1 className="mt-4 max-w-xl text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[44px]">
                Photobooth online gratis, langsung dari browser.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-600">
                Foto solo dengan hasil kertas 2R atau 4R, atau foto berdua lewat kode room. Jadi,
                tinggal unduh.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/studio?mode=solo"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-[13px] font-bold text-white transition-colors hover:bg-black"
                >
                  <Camera className="h-4 w-4" />
                  Foto solo
                </Link>
                <Link
                  href="/studio?mode=duo"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-[13px] font-bold text-zinc-800 transition-colors hover:border-zinc-900 hover:text-zinc-900"
                >
                  <Users className="h-4 w-4" />
                  Foto berdua
                </Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Gratis</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Tanpa akun</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Tanpa watermark</span>
              </p>
            </div>

            {/* Hasil cetak 2R */}
            <div className="relative mx-auto w-full max-w-[290px]">
              <div
                aria-hidden="true"
                className="absolute -right-1 top-8 w-[47%] rotate-[7deg] rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-30px_rgba(9,9,11,0.6)]"
              >
                <div className="space-y-1.5">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="aspect-square rounded-[3px] bg-[linear-gradient(160deg,#ddd6fe,#c7d2fe_45%,#a5b4fc)]"
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-center font-mono text-[7px] font-bold tracking-[0.2em] text-zinc-500">
                  STRIP
                </p>
              </div>

              <div className="relative w-[82%] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_24px_60px_-30px_rgba(9,9,11,0.45)]">
                <div className="space-y-2" aria-hidden="true">
                  {[0, 1].map((row) => (
                    <div
                      key={row}
                      className="relative aspect-[4/3] overflow-hidden rounded-md bg-[linear-gradient(150deg,#fde68a,#fbcfe8_50%,#d4d4d8)]"
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.85),transparent_58%)]" />
                      <span className="absolute bottom-1.5 right-2 font-mono text-[7px] tracking-[0.14em] text-white/90">
                        <LiveStamp />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-zinc-200 pt-2">
                  <div>
                    <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-900">FOTOYUK</p>
                    <p className="font-mono text-[8px] tracking-[0.16em] text-zinc-400">2 POSE</p>
                  </div>
                  <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-zinc-500">2R</span>
                </div>
              </div>

              <p className="mt-4 text-center text-[11.5px] leading-relaxed text-zinc-500">
                Hasil 2R, 750 × 1050 px — siap cetak atau kirim ke chat.
              </p>
            </div>
          </div>
        </section>

        {/* Modes */}
        <section className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid max-w-5xl gap-3 px-5 py-10 sm:px-8 md:grid-cols-2">
            <article className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Solo</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                  2 atau 4 pose, hasil kertas 2R / 4R.
                </p>
              </div>
              <Link
                href="/studio?mode=solo"
                className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-zinc-900 hover:underline"
              >
                Mulai <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
            <article className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Berdua</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                  Dua kamera, satu kode room, hasil strip.
                </p>
              </div>
              <Link
                href="/studio?mode=duo"
                className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-zinc-900 hover:underline"
              >
                Mulai <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          </div>
        </section>

        {/* Print sizes */}
        <section id="ukuran" className="border-b border-zinc-200">
          <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-[22px] font-bold tracking-tight">Pilih ukuran hasil</h2>
              <p className="text-[12px] text-zinc-500">Semua diunduh sebagai PNG.</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { name: '2R', detail: '2 pose · 2,5 × 3,5 in', note: 'Satu foto vertikal, dua shot bertumpuk.' },
                { name: '4R', detail: '4 foto · grid 2×2', note: 'Empat shot di kertas 4 × 6 in.' },
                { name: 'Strip', detail: '2–4 pose · berdua', note: 'Dua kolom, host dan guest.' },
              ].map((item) => (
                <div key={item.name} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[17px] font-bold tracking-tight">{item.name}</span>
                    <span className="font-mono text-[10px] capitalize tracking-wide text-zinc-500">{item.detail}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Templates */}
        <section id="template" className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-[22px] font-bold tracking-tight">Template</h2>
              <p className="text-[12px] text-zinc-500">Ganti filter dan nama sebelum unduh.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {PRESET_OVERLAYS.map((tpl) => {
                const sticker = tpl.layers.find((layer) => layer.type === 'image')?.src;
                return (
                  <div key={tpl.id} className="overflow-hidden rounded-xl border border-zinc-200">
                    <div
                      className="relative flex aspect-[4/5] flex-col justify-end p-3"
                      style={{ background: templateBackground(tpl.baseColor, tpl.gradient) }}
                    >
                      {sticker ? (
                        <img
                          src={sticker}
                          alt=""
                          aria-hidden="true"
                          className="absolute right-2.5 top-2.5 h-8 w-8 rotate-6 opacity-90"
                        />
                      ) : null}
                      <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-zinc-800">
                        {tpl.name.toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-zinc-200">
          <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
            <h2 className="text-[22px] font-bold tracking-tight">FAQ</h2>
            <div className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200">
              {faqs.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[13.5px] font-bold text-zinc-900 marker:hidden">
                    {item.q}
                    <span className="mt-0.5 text-zinc-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-2 pr-8 text-[13px] leading-relaxed text-zinc-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Dukungan */}
        <section className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="max-w-md">
              <h2 className="text-[14px] font-bold tracking-tight text-zinc-900">
                Gratis, tanpa iklan di dalam studio
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                Server dan pengembangan kami biayai sendiri. Kalau hasil fotonya berguna, traktir kopi
                mulai Rp 5.000 lewat Saweria — seikhlasnya, tidak wajib.
              </p>
            </div>
            <a
              href={SAWERIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-black"
            >
              <Coffee className="h-4 w-4" />
              Traktir kopi
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-zinc-900 text-white">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-5 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
            <h2 className="text-[22px] font-bold tracking-tight">Siap foto?</h2>
            <div className="flex gap-3">
              <Link
                href="/studio?mode=solo"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[12.5px] font-bold text-zinc-900 transition-colors hover:bg-zinc-100"
              >
                <Camera className="h-4 w-4" />
                Foto solo
              </Link>
              <Link
                href="/studio?mode=duo"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-700 px-5 text-[12.5px] font-bold text-white transition-colors hover:border-zinc-500"
              >
                <Users className="h-4 w-4" />
                Foto berdua
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-7 text-[11.5px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white">
              <Camera className="h-3 w-3" />
            </span>
            <span className="font-bold text-zinc-900">Fotoyuk</span>
            <span>Photobooth online gratis.</span>
          </div>
          <nav className="flex gap-5" aria-label="Navigasi footer">
            <a href="#ukuran" className="hover:text-zinc-900">Ukuran</a>
            <a href="#template" className="hover:text-zinc-900">Template</a>
            <a href="#faq" className="hover:text-zinc-900">FAQ</a>
            <Link href="/studio" className="hover:text-zinc-900">Studio</Link>
            <Link href="/privasi" className="hover:text-zinc-900">Privasi</Link>
            <a href={SAWERIA_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">Dukung</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
