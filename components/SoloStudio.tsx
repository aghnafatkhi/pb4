'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { ArrowLeft, Camera, Download, RefreshCcw } from 'lucide-react';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getSoloPaper,
  type FrameLayout,
} from '@/lib/photoLayout';
import { filterOptions, getFilterCSS, swatchTextColor } from '@/lib/photoFilters';
import { compressScreenshot } from '@/lib/imageUtils';
import { PRESET_OVERLAYS } from '@/lib/templates';
import SupportCard from './SupportCard';

const BASE_COLORS = [
  { hex: '#ffffff', label: 'Putih' },
  { hex: '#000000', label: 'Hitam' },
  { hex: '#f4f4f5', label: 'Zinc' },
  { hex: '#fbcfe8', label: 'Pink' },
  { hex: '#bfdbfe', label: 'Biru' },
];

const COUNTDOWN_SECONDS = 3;

function gradientDirection(direction: string) {
  if (direction === 'to-r') return 'to right';
  if (direction === 'to-br') return 'to bottom right';
  if (direction === 'to-tr') return 'to top right';
  return 'to bottom';
}

function loadImage(url: string, cache: Map<string, Promise<HTMLImageElement | null>>) {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = url;
    });
    cache.set(url, pending);
  }
  return pending;
}

interface SoloStudioProps {
  layout: FrameLayout;
  userName: string;
  onExit: () => void;
}

export default function SoloStudio({ layout, userName, onExit }: SoloStudioProps) {
  const paper = getSoloPaper(layout);
  const frames = paper.columns * paper.rows;

  const [phase, setPhase] = useState<'camera' | 'result'>('camera');
  const [photos, setPhotos] = useState<string[]>([]);
  const [filterId, setFilterId] = useState('normal');
  const [themeHex, setThemeHex] = useState('#ffffff');
  const [footerName, setFooterName] = useState('');
  const [footerDate, setFooterDate] = useState('');
  const [showFooterDate, setShowFooterDate] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [supportVisible, setSupportVisible] = useState(false);

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photosRef = useRef<string[]>([]);
  const imageCacheRef = useRef<Map<string, Promise<HTMLImageElement | null>>>(new Map());
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const cache = imageCacheRef.current;
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      cache.clear();
    };
  }, []);

  const queue = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timersRef.current.push(id);
  }, []);

  const compose = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || photosRef.current.length === 0) return;

    canvas.width = paper.width;
    canvas.height = paper.height;

    const preset = PRESET_OVERLAYS.find((p) => p.hex === themeHex);
    const baseColor = preset?.baseColor || themeHex;
    const gradient = preset?.gradient;

    if (gradient?.enabled && gradient.color2) {
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
      if (gradient.direction === 'to-r') x1 = canvas.width;
      else if (gradient.direction === 'to-br') { x1 = canvas.width; y1 = canvas.height; }
      else if (gradient.direction === 'to-tr') { x1 = canvas.width; y0 = canvas.height; }
      else y1 = canvas.height;
      const fill = ctx.createLinearGradient(x0, y0, x1, y1);
      fill.addColorStop(0, baseColor);
      fill.addColorStop(1, gradient.color2);
      ctx.fillStyle = fill;
    } else {
      ctx.fillStyle = baseColor;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layerUrls = (preset?.layers || []).map((l) => l.src || '');
    const [photoImgs, layerImgs] = await Promise.all([
      Promise.all(photosRef.current.map((url) => loadImage(url, imageCacheRef.current))),
      Promise.all(layerUrls.map((url) => (url ? loadImage(url, imageCacheRef.current) : Promise.resolve(null)))),
    ]);

    const drawContain = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const scale = Math.min(w / img.width, h / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      ctx.drawImage(img, x + (w - drawWidth) / 2, y + (h - drawHeight) / 2, drawWidth, drawHeight);
    };

    const contentWidth = canvas.width - paper.padding * 2;
    const contentHeight = canvas.height - paper.padding - paper.footer;
    const cellWidth = (contentWidth - paper.gap * (paper.columns - 1)) / paper.columns;
    const cellHeight = (contentHeight - paper.gap * (paper.rows - 1)) / paper.rows;

    ctx.filter = getFilterCSS(filterId);
    photoImgs.slice(0, frames).forEach((img, i) => {
      if (!img) return;
      const col = i % paper.columns;
      const row = Math.floor(i / paper.columns);
      const x = paper.padding + col * (cellWidth + paper.gap);
      const y = paper.padding + row * (cellHeight + paper.gap);
      drawContain(img, x, y, cellWidth, cellHeight);
    });
    ctx.filter = 'none';

    const baseLower = String(baseColor).toLowerCase();
    const textColor = baseLower === '#000000' ? '#ffffff' : '#18181b';
    const subColor = baseLower === '#000000' ? '#a1a1aa' : '#71717a';

    const dateStr = (() => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(footerDate)) {
        const [y, m, d] = footerDate.split('-');
        return `${d}.${m}.${y}`;
      }
      return new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).replace(/\//g, '.');
    })();
    const footerTitle = (footerName.trim() || preset?.name || 'FOTOYUK').toUpperCase();

    const titleY = canvas.height - Math.round(paper.footer * 0.56);
    const subY = canvas.height - Math.round(paper.footer * 0.2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(footerTitle, canvas.width / 2, titleY);

    ctx.fillStyle = subColor;
    ctx.font = '500 12px monospace';
    ctx.fillText(
      showFooterDate ? `${dateStr} • FOTOYUK` : 'FOTOYUK',
      canvas.width / 2,
      subY
    );

    preset?.layers?.forEach((layer, idx) => {
      if (layer.hidden) return;
      // Footer decorations shrink with the paper; corner stickers keep their size.
      const layerScale = layer.y < 200 ? 1 : canvas.height / CANVAS_HEIGHT;
      const layerWidth = layer.width * layerScale;
      const layerHeight = layer.height * layerScale;
      const anchorRight = layer.x + layer.width / 2 >= CANVAS_WIDTH / 2;
      const layerX = anchorRight ? canvas.width - (CANVAS_WIDTH - layer.x) : layer.x;
      const layerY = layer.y < 200 ? layer.y : canvas.height - (CANVAS_HEIGHT - layer.y);
      const centerX =
        layer.type === 'text' ? canvas.width / 2 : layerX + layerWidth / 2;

      ctx.save();
      if (layer.opacity !== undefined && layer.opacity !== null) {
        ctx.globalAlpha = Number(layer.opacity);
      }
      ctx.translate(centerX, layerY + layerHeight / 2);
      ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
      if (layer.type === 'text' && layer.text) {
        ctx.fillStyle = layer.color || '#18181B';
        ctx.font = `bold ${Math.round((layer.fontSize || 32) * layerScale)}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.text, 0, 0);
      } else {
        const img = layerImgs[idx];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight);
        }
      }
      ctx.restore();
    });
  }, [filterId, footerDate, footerName, frames, paper, showFooterDate, themeHex]);

  useEffect(() => {
    if (phase === 'result') void compose();
  }, [phase, photos, compose]);

  const finishShoot = useCallback((next: string[]) => {
    setIsShooting(false);
    setCountdown(null);
    queue(() => setPhase('result'), 650);
    photosRef.current = next;
    setPhotos(next);
  }, [queue]);

  // Rekursi antar-pose lewat ref agar callback tidak mereferensi dirinya
  // sendiri sebelum dideklarasikan (react-hooks/immutability).
  const runPoseRef = useRef<(poseIndex: number) => void>(() => {});

  const runPose = useCallback((poseIndex: number) => {
    let remaining = COUNTDOWN_SECONDS;
    setCountdown(remaining);
    const tick = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      clearInterval(tick);
      intervalRef.current = null;
      setCountdown(0);
      const shot = webcamRef.current?.getScreenshot();
      if (!shot) {
        setIsShooting(false);
        setCountdown(null);
        setCameraError('Kamera belum siap. Coba lagi.');
        return;
      }
      void compressScreenshot(shot).then((photo) => {
        const next = [...photosRef.current, photo];
        photosRef.current = next;
        setPhotos(next);
        setCountdown(null);
        if (next.length >= frames) {
          finishShoot(next);
        } else {
          queue(() => runPoseRef.current(next.length), 900);
        }
      });
    }, 1000);
    intervalRef.current = tick;
  }, [finishShoot, frames, queue]);

  useEffect(() => {
    runPoseRef.current = runPose;
  }, [runPose]);

  const startShoot = () => {
    if (isShooting || !cameraReady) return;
    setIsShooting(true);
    photosRef.current = [];
    setPhotos([]);
    runPose(0);
  };

  const retake = () => {
    photosRef.current = [];
    setPhotos([]);
    setPhase('camera');
    setFooterName('');
    setFooterDate('');
    setShowFooterDate(true);
    setThemeHex('#ffffff');
    setFilterId('normal');
  };

  const downloadPhoto = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `fotoyuk-solo-${paper.id.toLowerCase()}-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    setSupportVisible(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-sm font-bold text-zinc-900 leading-none">Fotoyuk Solo</div>
            <div className="text-[11px] text-zinc-500 mt-1">{paper.id} · {frames} pose · {userName}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {phase === 'result' ? (
          <div className="w-full max-w-sm flex flex-col items-center space-y-4">
            <div
              className="w-full bg-white rounded-[20px] p-2.5 ring-1 ring-zinc-200 shadow-[0_24px_48px_-32px_rgba(9,9,11,0.55)]"
              style={{ aspectRatio: `${paper.width} / ${paper.height}` }}
            >
              <canvas ref={canvasRef} className="w-full h-full object-contain rounded-xl" />
            </div>

            <div className="w-full space-y-1.5">
              <span className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Filter</span>
              <div className="w-full flex overflow-x-auto bg-white p-1.5 rounded-2xl border border-zinc-200 gap-1.5">
                {filterOptions.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterId(f.id)}
                    aria-pressed={filterId === f.id}
                    className={`px-3.5 h-8 text-xs font-semibold rounded-xl shrink-0 transition-colors duration-200 cursor-pointer ${
                      filterId === f.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full space-y-1.5">
              <span className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Tema frame</span>
              <div className="w-full flex overflow-x-auto bg-white p-2 rounded-2xl border border-zinc-200 gap-2 items-center">
                {[
                  ...BASE_COLORS.map((c) => ({ id: c.hex, hex: c.hex, label: undefined as string | undefined, preset: undefined })),
                  ...PRESET_OVERLAYS.map((p) => ({ id: p.id, hex: p.hex, label: p.label, preset: p })),
                ].map((bg) => {
                  const active = themeHex === bg.hex;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setThemeHex(bg.hex)}
                      aria-pressed={active}
                      title={bg.preset?.name || bg.hex}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 cursor-pointer ${
                        active ? 'border-zinc-900 ring-2 ring-zinc-900/70' : 'border-zinc-300 hover:scale-105'
                      }`}
                      style={{
                        backgroundColor: bg.preset?.baseColor || bg.hex,
                        backgroundImage:
                          bg.preset?.gradient?.enabled
                            ? `linear-gradient(${gradientDirection(bg.preset.gradient.direction)}, ${bg.preset.baseColor}, ${bg.preset.gradient.color2})`
                            : undefined,
                      }}
                    >
                      {bg.label ? (
                        <span
                          className="text-[8px] font-bold uppercase tracking-wide leading-none"
                          style={{ color: swatchTextColor(bg.preset?.baseColor || bg.hex) }}
                        >
                          {bg.label.slice(0, 4)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full rounded-2xl border border-zinc-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Teks & tanggal</span>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showFooterDate}
                    onChange={(e) => setShowFooterDate(e.target.checked)}
                    className="w-3.5 h-3.5 accent-zinc-900 cursor-pointer"
                  />
                  Tanggal
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={footerName}
                  onChange={(e) => setFooterName(e.target.value.slice(0, 28))}
                  placeholder="Nama di foto"
                  aria-label="Nama pada foto"
                  className="h-9 px-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-semibold focus:outline-none focus:border-zinc-900 focus:bg-white"
                />
                <input
                  type="date"
                  value={footerDate}
                  disabled={!showFooterDate}
                  onChange={(e) => setFooterDate(e.target.value)}
                  aria-label="Tanggal pada foto"
                  className="h-9 px-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-semibold focus:outline-none focus:border-zinc-900 focus:bg-white disabled:opacity-40"
                />
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={downloadPhoto}
                className="flex-1 h-12 bg-zinc-900 hover:bg-black text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Foto</span>
              </button>
              <button
                onClick={retake}
                className="px-4 h-12 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Ulang</span>
              </button>
            </div>

            {supportVisible && <SupportCard />}

            <p className="text-[11px] text-zinc-400 text-center">
              Foto diproses di perangkat ini. Tidak ada yang diunggah.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center space-y-4">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-black border border-zinc-300"
              style={{ aspectRatio: '4 / 3' }}
            >
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-100 text-zinc-900">
                  <Camera className="w-8 h-8 text-red-500 mb-2" />
                  <p className="font-bold text-xs">Kamera Tidak Tersedia</p>
                  <p className="text-[11px] text-zinc-500 mt-1">{cameraError}</p>
                </div>
              ) : (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored
                  forceScreenshotSourceSize
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.85}
                  videoConstraints={{ facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={(err) => {
                    setCameraReady(false);
                    setCameraError(typeof err === 'string' ? err : err.message || 'Error kamera');
                  }}
                  className="w-full h-full object-cover"
                  style={{ filter: getFilterCSS(filterId) }}
                />
              )}

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/80 text-center text-white">
                  <Camera className="w-7 h-7 opacity-90" />
                  <p className="font-bold text-xs">Izinkan akses kamera</p>
                  <p className="text-[11px] text-zinc-300 max-w-[220px]">
                    Klik “Izinkan” pada dialog browser di bagian atas layar. Tanpa izin, foto tidak bisa dimulai.
                  </p>
                </div>
              )}

              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-7xl font-bold font-mono text-white">{countdown}</span>
                </div>
              )}

              {countdown === 0 && <div className="absolute inset-0 bg-white" />}

              {isShooting && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <span className="bg-black/70 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md">
                    Pose {Math.min(photos.length + 1, frames)} / {frames}
                  </span>
                </div>
              )}
            </div>

            <div className="w-full space-y-1.5">
              <span className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Filter</span>
              <div className="w-full flex overflow-x-auto bg-white p-1.5 rounded-2xl border border-zinc-200 gap-1.5">
                {filterOptions.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterId(f.id)}
                    aria-pressed={filterId === f.id}
                    className={`px-3.5 h-8 text-xs font-semibold rounded-xl shrink-0 transition-colors duration-200 cursor-pointer ${
                      filterId === f.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startShoot}
              disabled={!cameraReady || Boolean(cameraError) || isShooting}
              className={`w-full h-12 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer ${
                !cameraReady || cameraError || isShooting
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-zinc-900 hover:bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isShooting ? `Pose ${Math.min(photos.length + 1, frames)} dari ${frames}...` : `Mulai Foto · ${frames} Pose`}</span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center">
              Duduk di depan kamera, lalu mulai. Hitung mundur {COUNTDOWN_SECONDS} detik per pose.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
