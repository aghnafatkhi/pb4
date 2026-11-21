import { ArrowUpRight, Coffee } from 'lucide-react';

export const SAWERIA_URL = 'https://saweria.co/aghnafatkhi';

export default function SupportCard({ className = '' }: { className?: string }) {
  return (
    <a
      href={SAWERIA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-400 ${className}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
        <Coffee className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-bold text-zinc-900">Foto kamu sudah selesai</span>
        <span className="block text-[10.5px] leading-relaxed text-zinc-500">
          Gratis dan tanpa watermark. Kalau senang, traktir kopi mulai Rp 5.000.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-zinc-900">
        Traktir
        <ArrowUpRight className="h-3 w-3" />
      </span>
    </a>
  );
}
