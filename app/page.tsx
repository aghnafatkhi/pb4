'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { generateRoomCode } from '@/lib/utils';
import { CustomWebcam } from '@/components/CustomWebcam';
import { Loader2, Camera, RefreshCcw, Check, Download, Heart, ArrowLeft, Copy } from 'lucide-react';

function getLocalUid() {
  if (typeof window === 'undefined') return 'temp-uid';
  let uid = localStorage.getItem('pb_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pb_uid', uid);
  }
  return uid;
}

const filterOptions = [
  { id: 'normal', name: 'Alami', style: 'none' },
  { id: 'bw', name: 'Monokrom', style: 'grayscale(100%) contrast(105%)' },
  { id: 'sepia', name: 'Hangat', style: 'sepia(40%) saturate(120%)' },
  { id: 'soft', name: 'Lembut', style: 'brightness(105%) contrast(92%) saturate(95%)' },
];

const getFilterCSS = (fid: string) => filterOptions.find(f => f.id === fid)?.style || 'none';

export default function Photobooth() {
  const [user, setUser] = useState<{ uid: string } | null>(null);

  useEffect(() => {
    setUser({ uid: getLocalUid() });
  }, []);

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#FDFBF9]">
        <Loader2 className="w-6 h-6 animate-spin text-[#9E9388]" />
      </div>
    );
  }

  return <PhotoboothRouter user={user} />;
}

function PhotoboothRouter({ user }: { user: { uid: string } }) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [role, setRole] = useState<'host' | 'guest' | null>(null);

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) {
        setRoomCode(hash);
        setRole('guest');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (roomCode && role) {
    return (
      <PhotoboothRoom
        roomCode={roomCode}
        role={role}
        onLeave={() => {
          setRoomCode(null);
          setRole(null);
          window.location.hash = '';
        }}
      />
    );
  }

  return (
    <PhotoboothHome
      user={user}
      onHost={(code) => {
        setRoomCode(code);
        setRole('host');
        window.location.hash = code;
      }}
    />
  );
}

function PhotoboothHome({ user, onHost }: { user: { uid: string }, onHost: (code: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('grid');
  const [joinCode, setJoinCode] = useState('');

  const createRoom = async () => {
    setCreating(true);
    const code = generateRoomCode();
    await setDoc(doc(db, 'rooms', code), {
      createdAt: serverTimestamp(),
      status: 'waiting',
      layout: selectedLayout,
      overlayBackground: '#FAF8F5',
      countdownStartAt: null,
      poseIndex: 0,
      host: {
        uid: user.uid,
        connected: true,
        ready: false,
        photoUrls: [],
        photoReady: false,
        filter: 'normal',
      },
      guest: {
        uid: null,
        connected: false,
        ready: false,
        photoUrls: [],
        photoReady: false,
        filter: 'normal',
      },
    });
    setCreating(false);
    onHost(code);
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-[#FDFBF9] text-[#2C2825] px-5 py-8 max-w-md mx-auto">
      <header className="text-center pt-4 pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EDE6] text-[#786C60] text-xs font-medium tracking-wide mb-3">
          <Heart className="w-3 h-3 fill-[#786C60]" />
          <span>Shared Photobooth</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold tracking-tight text-[#2C2825] mb-2">
          Dari Aghna Untuk Ghina
        </h1>
      </header>

      <main className="my-auto space-y-6 bg-white p-6 rounded-3xl border border-[#EFE8E1] shadow-sm">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[#9E9388] mb-3">
            Pilih Format Foto
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedLayout('grid')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col items-center gap-2.5 ${
                selectedLayout === 'grid'
                  ? 'border-[#2C2825] bg-[#FDFBF9] shadow-xs'
                  : 'border-[#EFE8E1] hover:border-[#D8CFC4]'
              }`}
            >
              <div className="w-8 h-10 grid grid-cols-2 grid-rows-2 gap-1 border border-[#2C2825] rounded p-1 bg-white">
                <div className="bg-[#2C2825] rounded-xs"></div>
                <div className="bg-[#2C2825] rounded-xs"></div>
                <div className="bg-[#2C2825] rounded-xs"></div>
                <div className="bg-[#2C2825] rounded-xs"></div>
              </div>
              <span className="text-xs font-semibold text-[#2C2825]">Grid (4 Pose)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLayout('split-vertical')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col items-center gap-2.5 ${
                selectedLayout === 'split-vertical'
                  ? 'border-[#2C2825] bg-[#FDFBF9] shadow-xs'
                  : 'border-[#EFE8E1] hover:border-[#D8CFC4]'
              }`}
            >
              <div className="w-8 h-10 flex flex-col gap-1 border border-[#2C2825] rounded p-1 bg-white">
                <div className="bg-[#2C2825] flex-1 rounded-xs"></div>
                <div className="bg-[#2C2825] flex-1 rounded-xs"></div>
              </div>
              <span className="text-xs font-semibold text-[#2C2825]">Stacked (2 Pose)</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={createRoom}
          disabled={creating}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#2C2825] text-[#FDFBF9] text-sm font-medium hover:bg-[#423C38] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          <span>Buat Room Baru</span>
        </button>

        <div className="relative flex items-center justify-center my-2">
          <div className="absolute inset-0 border-t border-[#EFE8E1]"></div>
          <span className="relative bg-white px-3 text-[11px] font-medium text-[#9E9388] uppercase tracking-wider">
            Atau Gabung Room
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="KODE ROOM (4 Angka)"
            maxLength={4}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="flex-1 bg-[#F9F6F3] border border-[#EFE8E1] rounded-2xl px-4 py-3 font-mono text-center text-sm font-semibold tracking-wider text-[#2C2825] placeholder:text-[#B2A79C] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal outline-none focus:border-[#2C2825] transition-colors"
          />
          <button
            type="button"
            onClick={() => {
              if (joinCode) window.location.hash = joinCode;
            }}
            disabled={!joinCode}
            className="px-5 py-3 rounded-2xl bg-[#E8DED5] text-[#2C2825] text-sm font-semibold hover:bg-[#DCD0C5] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Masuk
          </button>
        </div>
      </main>

      <footer className="text-center pt-6 text-xs text-[#9E9388]">
        <p>Photobooth Spesial &bull; Dari Aghna Untuk Ghina</p>
      </footer>
    </div>
  );
}

function PhotoboothRoom({
  roomCode,
  role,
  onLeave,
}: {
  roomCode: string;
  role: 'host' | 'guest';
  onLeave: () => void;
}) {
  const [room, setRoom] = useState<any>(null);
  const roomRef = useRef<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const currentRoom = roomRef.current;
        const currentPhotos = currentRoom?.[role]?.photoUrls || [];
        const newPhotos = [...currentPhotos, imageSrc];

        const layout = currentRoom?.layout || 'split-vertical';
        const requiredPoses = layout === 'grid' ? 2 : 1;
        const isFinished = newPhotos.length >= requiredPoses;
        updateDoc(doc(db, 'rooms', roomCode), {
          [`${role}.photoUrls`]: newPhotos,
          [`${role}.photoReady`]: isFinished,
        });
      }
    }
  }, [roomCode, role]);

  const compositePhotos = useCallback(() => {
    const currentRoom = roomRef.current;
    if (
      !canvasRef.current ||
      !currentRoom?.host?.photoUrls ||
      !currentRoom?.guest?.photoUrls
    )
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 900;

    const loadImages = (urls: string[]) => {
      return Promise.all(
        urls.map((url) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = url;
          });
        })
      );
    };

    Promise.all([
      loadImages(currentRoom.host.photoUrls),
      loadImages(currentRoom.guest.photoUrls),
    ]).then(([hostImgs, guestImgs]) => {
      const bg = currentRoom.overlayBackground || '#FAF8F5';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawCover = (
        img: HTMLImageElement,
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;
        let sx, sy, sw, sh;
        if (imgRatio > targetRatio) {
          sh = img.height;
          sw = sh * targetRatio;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / targetRatio;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        ctx.restore();
      };

      const layout = currentRoom.layout || 'grid';
      const hostFilter = currentRoom.host.filter || 'normal';
      const guestFilter = currentRoom.guest.filter || 'normal';

      const padding = 32;
      const spacing = 18;
      const bottomPadding = 120;
      const drawW = canvas.width - padding * 2;
      const drawH = canvas.height - padding - bottomPadding;

      if (layout === 'grid') {
        const cellW = (drawW - spacing) / 2;
        const cellH = (drawH - spacing) / 2;

        ctx.filter = getFilterCSS(hostFilter);
        if (hostImgs[0]) drawCover(hostImgs[0], padding, padding, cellW, cellH);
        if (hostImgs[1])
          drawCover(
            hostImgs[1],
            padding + cellW + spacing,
            padding + cellH + spacing,
            cellW,
            cellH
          );

        ctx.filter = getFilterCSS(guestFilter);
        if (guestImgs[0])
          drawCover(guestImgs[0], padding + cellW + spacing, padding, cellW, cellH);
        if (guestImgs[1])
          drawCover(guestImgs[1], padding, padding + cellH + spacing, cellW, cellH);
      } else {
        const cellW = drawW;
        const cellH = (drawH - spacing) / 2;

        ctx.filter = getFilterCSS(hostFilter);
        if (hostImgs[0]) drawCover(hostImgs[0], padding, padding, cellW, cellH);

        ctx.filter = getFilterCSS(guestFilter);
        if (guestImgs[0])
          drawCover(guestImgs[0], padding, padding + cellH + spacing, cellW, cellH);
      }

      ctx.filter = 'none';
      ctx.fillStyle = '#2C2825';
      ctx.textAlign = 'center';
      ctx.font = '600 24px "Playfair Display", Georgia, serif';
      ctx.fillText('Dari Aghna Untuk Ghina', canvas.width / 2, canvas.height - 62);

      ctx.fillStyle = '#8C8074';
      ctx.font = '400 13px system-ui, sans-serif';
      ctx.fillText(
        new Date().toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        canvas.width / 2,
        canvas.height - 38
      );
    });
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rooms', roomCode), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoom(data);

        if (role === 'guest' && data.guest.uid === null) {
          updateDoc(doc(db, 'rooms', roomCode), {
            'guest.uid': getLocalUid(),
            'guest.connected': true,
          });
        }
      } else {
        alert('Room tidak ditemukan!');
        onLeave();
      }
    });

    const handleBeforeUnload = () => {
      updateDoc(doc(db, 'rooms', roomCode), {
        [`${role}.connected`]: false,
        [`${role}.ready`]: false,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      unsub();
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomCode, role, onLeave]);

  useEffect(() => {
    if (room?.status === 'countdown' && room?.countdownStartAt) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = room.countdownStartAt - now;

        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(0);
          capturePhoto();

          if (role === 'host') {
            const layout = room.layout || 'split-vertical';
            const requiredPoses = layout === 'grid' ? 2 : 1;
            const currentPose = (room.poseIndex || 0) + 1;

            if (currentPose < requiredPoses) {
              updateDoc(doc(db, 'rooms', roomCode), {
                poseIndex: currentPose,
                countdownStartAt: Date.now() + 4000,
              });
            }
          }
        } else {
          setCountdown(Math.ceil(remaining / 1000));
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setTimeout(() => setCountdown(null), 0);
    }
  }, [
    room?.status,
    room?.countdownStartAt,
    room?.poseIndex,
    room?.layout,
    role,
    roomCode,
    capturePhoto,
  ]);

  useEffect(() => {
    if (room?.host?.photoUrls && room?.guest?.photoUrls) {
      const layout = room.layout || 'split-vertical';
      const requiredPoses = layout === 'grid' ? 2 : 1;
      if (
        room.host.photoUrls.length >= requiredPoses &&
        room.guest.photoUrls.length >= requiredPoses
      ) {
        compositePhotos();
      }
    }
  }, [
    room?.host?.photoUrls,
    room?.guest?.photoUrls,
    room?.host?.photoReady,
    room?.guest?.photoReady,
    room?.status,
    room?.layout,
    role,
    room?.host?.filter,
    room?.guest?.filter,
    room?.overlayBackground,
    compositePhotos,
  ]);

  const toggleReady = () => {
    if (!room) return;
    const isReady = !room[role].ready;
    const ref = doc(db, 'rooms', roomCode);
    updateDoc(ref, { [`${role}.ready`]: isReady });

    if (isReady) {
      const otherRole = role === 'host' ? 'guest' : 'host';
      if (room[otherRole].ready && room.status !== 'countdown') {
        updateDoc(ref, {
          status: 'countdown',
          countdownStartAt: Date.now() + 4000,
          poseIndex: 0,
        });
      }
    }
  };

  const resetSession = () => {
    if (role === 'host') {
      updateDoc(doc(db, 'rooms', roomCode), {
        status: 'waiting',
        'host.ready': false,
        'guest.ready': false,
        'host.photoReady': false,
        'guest.photoReady': false,
        'host.photoUrls': [],
        'guest.photoUrls': [],
        poseIndex: 0,
        countdownStartAt: null,
      });
    }
  };

  const changeFilter = (newFilter: string) => {
    if (!room) return;
    updateDoc(doc(db, 'rooms', roomCode), { [`${role}.filter`]: newFilter });
  };

  const changeOverlayBackground = (color: string) => {
    if (role === 'host') {
      updateDoc(doc(db, 'rooms', roomCode), { overlayBackground: color });
    }
  };

  const downloadPhoto = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `DariAghnaUntukGhina-${roomCode}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#FDFBF9]">
        <Loader2 className="w-6 h-6 animate-spin text-[#9E9388]" />
      </div>
    );
  }

  const myData = role === 'host' ? room.host : room.guest;
  const otherData = role === 'host' ? room.guest : room.host;
  const isCaptured = room.host.photoReady && room.guest.photoReady;

  let statusText = 'Siap mengambil foto?';
  if (myData?.ready && !otherData?.ready) statusText = 'Menunggu pasanganmu...';
  if (!myData?.ready && otherData?.ready) statusText = 'Pasanganmu sudah siap!';

  return (
    <div className="min-h-dvh bg-[#FDFBF9] text-[#2C2825] flex flex-col max-w-md mx-auto relative">
      <header className="flex items-center justify-between px-5 py-4 border-b border-[#EFE8E1] bg-[#FDFBF9]/90 backdrop-blur-md sticky top-0 z-40">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 text-xs font-medium text-[#786C60] hover:text-[#2C2825] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Keluar</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-widest px-2.5 py-1 bg-[#F3EDE6] rounded-full border border-[#E8DED5] text-[#2C2825]">
            {roomCode}
          </span>
          <button
            type="button"
            onClick={copyRoomLink}
            className="p-1.5 rounded-full hover:bg-[#F3EDE6] text-[#786C60] transition-colors"
            title="Salin Link Room"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-5 py-6">
        {isCaptured ? (
          <div className="flex flex-col items-center space-y-5 animate-in fade-in duration-300">
            <div className="w-full aspect-[2/3] max-w-xs rounded-xl shadow-lg border border-[#EFE8E1] bg-white overflow-hidden p-2">
              <canvas ref={canvasRef} className="w-full h-full object-contain rounded-lg" />
            </div>

            <div className="w-full bg-white p-4 rounded-2xl border border-[#EFE8E1] shadow-xs">
              <span className="block text-[11px] font-semibold text-[#9E9388] uppercase tracking-wider mb-2.5">
                Filter Warna
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {filterOptions.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFilter(f.id)}
                    className={`py-2 px-1 text-xs font-medium rounded-xl transition-all ${
                      (myData?.filter || 'normal') === f.id
                        ? 'bg-[#2C2825] text-white shadow-xs'
                        : 'bg-[#F9F6F3] text-[#786C60] hover:bg-[#F0EAE1]'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {role === 'host' && (
              <div className="w-full bg-white p-4 rounded-2xl border border-[#EFE8E1] shadow-xs">
                <span className="block text-[11px] font-semibold text-[#9E9388] uppercase tracking-wider mb-2.5">
                  Warna Bingkai
                </span>
                <div className="flex justify-between gap-2">
                  {[
                    { id: 'white', hex: '#ffffff' },
                    { id: 'cream', hex: '#FAF8F5' },
                    { id: 'blush', hex: '#FCEFEF' },
                    { id: 'sage', hex: '#EBF2EE' },
                    { id: 'dark', hex: '#2C2825' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => changeOverlayBackground(bg.hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        (room.overlayBackground || '#FAF8F5') === bg.hex
                          ? 'border-[#2C2825] scale-110'
                          : 'border-transparent shadow-xs'
                      }`}
                      style={{ backgroundColor: bg.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="w-full space-y-2 pt-1">
              <button
                type="button"
                onClick={downloadPhoto}
                className="w-full py-3.5 rounded-2xl bg-[#2C2825] text-white font-medium text-sm hover:bg-[#423C38] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Simpan Hasil Foto</span>
              </button>

              {role === 'host' && (
                <button
                  type="button"
                  onClick={resetSession}
                  className="w-full py-3 rounded-2xl bg-white border border-[#EFE8E1] text-[#786C60] font-medium text-sm hover:bg-[#F9F6F3] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Foto Ulang</span>
                </button>
              )}

              {role === 'guest' && (
                <p className="text-center text-xs text-[#9E9388] py-2 font-medium italic">
                  Menunggu host jika ingin foto ulang...
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-full aspect-[3/4] max-w-xs relative rounded-3xl overflow-hidden bg-zinc-900 border-4 border-white shadow-md">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#F9F6F3]">
                  <Camera className="w-10 h-10 text-[#C4B9AD] mb-3" />
                  <p className="text-[#2C2825] font-semibold text-sm mb-1">Kamera Tidak Aktif</p>
                  <p className="text-[#8C8074] text-xs leading-relaxed">{cameraError}</p>
                </div>
              ) : (
                <CustomWebcam
                  ref={webcamRef}
                  onUserMediaError={(err: string | Error) =>
                    setCameraError(
                      typeof err === 'string' ? err : err.message || 'Gagal mengaktifkan kamera.'
                    )
                  }
                  className="w-full h-full object-cover -scale-x-100"
                  style={{ filter: getFilterCSS(myData?.filter || 'normal') }}
                />
              )}

              {countdown !== null && countdown > 0 && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs z-20">
                  <span className="text-8xl font-serif font-bold text-white drop-shadow-md animate-pulse">
                    {countdown}
                  </span>
                </div>
              )}

              {countdown === 0 && (
                <div className="absolute inset-0 bg-white z-30 transition-opacity duration-700 opacity-100"></div>
              )}

              {countdown !== null && room?.layout === 'grid' && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-10">
                  <span className="bg-black/60 text-white text-[11px] px-3.5 py-1.5 rounded-full backdrop-blur-md font-medium tracking-wider uppercase">
                    Pose {(room.poseIndex || 0) + 1} / 2
                  </span>
                </div>
              )}

              {countdown === null && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
                  {!otherData?.connected ? (
                    <span className="bg-black/60 text-white text-[11px] px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                      <span>Menunggu Pasangan...</span>
                    </span>
                  ) : otherData?.ready ? (
                    <span className="bg-emerald-800/80 text-white text-[11px] px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 ml-auto">
                      <Check className="w-3 h-3" />
                      <span>Pasangan Siap</span>
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {countdown === null && (
              <div className="w-full max-w-xs mt-6 flex flex-col items-center space-y-3">
                <p className="text-xs font-medium text-[#8C8074] h-4 tracking-wide">
                  {statusText}
                </p>

                <button
                  type="button"
                  onClick={toggleReady}
                  disabled={!otherData?.connected}
                  className={`w-full py-4 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xs ${
                    !otherData?.connected
                      ? 'bg-[#EFE8E1] text-[#9E9388] cursor-not-allowed'
                      : myData?.ready
                      ? 'bg-[#E8DED5] text-[#2C2825] border border-[#D8CFC4]'
                      : 'bg-[#2C2825] text-white hover:bg-[#423C38] active:scale-[0.99]'
                  }`}
                >
                  {myData?.ready ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>Kamu Sudah Siap</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Siap Ambil Foto</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
