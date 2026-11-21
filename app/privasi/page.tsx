import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Camera } from 'lucide-react';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privasi',
  description:
    'Bagaimana Fotoyuk memperlakukan foto dan data Anda: mode solo diproses di browser, mode berdua dikirim sementara ke server, tanpa akun dan tanpa pelacak iklan.',
  alternates: { canonical: '/privasi' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/privasi`,
    title: 'Privasi · Fotoyuk',
    description:
      'Foto mode solo tidak pernah dikirim ke server. Foto mode berdua hanya singgah di server agar dua kamera bisa digabung.',
  },
};

const UPDATED = '19 November 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-bold tracking-tight text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-zinc-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Fotoyuk, beranda">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Camera className="h-4 w-4" />
            </span>
            <span className="text-[17px] font-bold tracking-tight">Fotoyuk</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-600 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Beranda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-12 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Privasi</p>
        <h1 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">
          Foto Anda, sejauh mana kami menyentuhnya.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-600">
          Fotoyuk tidak meminta akun dan tidak memasang iklan. Bagian ini menjelaskan data apa yang
          benar-benar berpindah, ke mana, dan berapa lama tinggal.
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          Diperbarui {UPDATED}
        </p>

        <div className="mt-10 border-t border-zinc-200 pt-8">
          <Section title="Mode solo: tidak ada yang dikirim">
            <p>
              Kamera dibaca langsung dari browser dan strip disusun di perangkat Anda. Foto, pilihan
              template, dan nama di footer tidak pernah sampai ke server kami. Karena itu mode solo
              tetap berjalan walau koneksi terputus, dan menutup tab menghapus semua hasil sementara.
            </p>
          </Section>

          <Section title="Mode berdua: foto singgah di server">
            <p>
              Dua kamera di dua perangkat tidak bisa bertemu tanpa perantara. Saat sesi berdua aktif,
              foto dari masing-masing kamera dikirim ke server kami (Supabase, region Singapura) supaya
              bisa digabung menjadi satu strip.
            </p>
            <p>
              Foto itu terikat pada kode room acak. Siapa pun yang memegang kode tersebut dapat
              masuk ke sesi itu, jadi bagikan kode hanya kepada orang yang Anda ajak. Foto
              dikosongkan dari server saat sesi diulang atau diakhiri, dan sesi yang ditinggal
              begitu saja otomatis dihapus dari server paling lambat beberapa jam kemudian.
            </p>
            <p>
              Nama yang Anda tulis untuk footer hanya dipakai di dalam strip dan tidak dipakai untuk
              keperluan lain.
            </p>
          </Section>

          <Section title="Yang tidak kami kumpulkan">
            <p>
              Tidak ada akun, kata sandi, nomor telepon, atau alamat surel yang diminta untuk memakai
              Fotoyuk. Tidak ada cookie iklan, tidak ada pixel pelacak dari jaringan pengiklan, dan
              tidak ada penjualan data ke pihak lain.
            </p>
          </Section>

          <Section title="Statistik kunjungan">
            <p>
              Kami memakai Vercel Web Analytics dan Speed Insights untuk mengetahui berapa halaman
              dibuka dan seberapa cepat situs dimuat. Keduanya mengukur data agregat tanpa cookie dan
              tanpa profil pengunjung, sehingga tidak bisa dipakai untuk mengenali orang tertentu.
            </p>
          </Section>

          <Section title="Pihak ketiga">
            <p>
              Vercel menyediakan hosting dan jaringan pengiriman halaman. Supabase menyimpan sesi mode
              berdua dan template. Saweria hanya terlibat bila Anda menekan tombol dukungan, dan saat
              itu Anda berpindah ke situs mereka yang punya kebijakan privasi sendiri.
            </p>
          </Section>

          <Section title="Permintaan penghapusan">
            <p>
              Karena tidak ada akun, kami tidak punya daftar foto milik seseorang. Bila Anda ingin
              memastikan foto dari sebuah sesi berdua sudah hilang, akhiri sesi lewat tombol di studio
              atau kirim kode room dan perkiraan waktunya ke{' '}
              <a
                href="mailto:aghna1011@gmail.com"
                className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
              >
                aghna1011@gmail.com
              </a>
              , lalu kami hapus dari sisi server.
            </p>
          </Section>

          <Section title="Perubahan">
            <p>
              Bila cara kami menangani data berubah, halaman ini diperbarui dan tanggal di atas ikut
              berubah. Versi yang berlaku selalu versi yang tampil di alamat ini.
            </p>
          </Section>
        </div>

        <div className="mt-12">
          <Link
            href="/studio?mode=solo"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-[13px] font-bold text-white transition-colors hover:bg-black"
          >
            <Camera className="h-4 w-4" />
            Mulai foto
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-7 text-[11.5px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>
            <span className="font-bold text-zinc-900">Fotoyuk</span> — photobooth online gratis.
          </span>
          <nav className="flex gap-5" aria-label="Navigasi footer">
            <Link href="/" className="hover:text-zinc-900">Beranda</Link>
            <Link href="/studio" className="hover:text-zinc-900">Studio</Link>
            <Link href="/privasi" className="text-zinc-900">Privasi</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
