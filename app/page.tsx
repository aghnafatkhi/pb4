'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { generateRoomCode } from '@/lib/utils';
import { CustomWebcam } from '@/components/CustomWebcam';
import { Loader2, Camera, RefreshCcw, Check, UserPlus, Download, Image as ImageIcon } from 'lucide-react';


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
  { id: 'normal', name: 'Normal', style: 'none' },
  { id: 'bw', name: 'B&W', style: 'grayscale(100%)' },
  { id: 'sepia', name: 'Sepia', style: 'sepia(100%)' },
  { id: 'warm', name: 'Warm', style: 'sepia(30%) saturate(140%) hue-rotate(-10deg)' },
];

const getFilterCSS = (fid: string) => filterOptions.find(f => f.id === fid)?.style || 'none';

export default function Photobooth() {
  const [user, setUser] = useState<{uid: string} | null>(null);

  useEffect(() => {
    setUser({ uid: getLocalUid() });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4c4b7]" />
      </div>
    );
  }

  return <PhotoboothRouter user={user} />;
}

function PhotoboothRouter({ user }: { user: {uid: string} }) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [role, setRole] = useState<'host'|'guest' | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        setRoomCode(hash);
        setRole('guest');
      }, 0);
    }
  }, []);

  if (roomCode && role) {
    return <PhotoboothRoom roomCode={roomCode} role={role} onLeave={() => { setRoomCode(null); setRole(null); window.location.hash = ''; }} />;
  }

  return <PhotoboothHome user={user} onHost={(code) => { setRoomCode(code); setRole('host'); window.location.hash = code; }} />;
}

function PhotoboothHome({ user, onHost }: { user: {uid: string}, onHost: (code: string) => void }) {
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
        filter: 'normal'
      },
      guest: {
        uid: null,
        connected: false,
        ready: false,
        photoUrls: [],
        photoReady: false,
        filter: 'normal'
      }
    });
    setCreating(false);
    onHost(code);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf8f5] text-[#4a443c] p-6 font-serif">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-[#d4c4b7]/20 border border-[#d4c4b7]/30">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 italic">Memories</h1>
          <p className="text-[#a89f91] font-sans text-sm">Romantic shared photobooth</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-sans font-semibold mb-3 text-[#a89f91]">Pilih Layout</label>
            <div className="grid grid-cols-2 gap-3 font-sans">
              <button 
                onClick={() => setSelectedLayout('grid')}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${selectedLayout === 'grid' ? 'border-[#d4c4b7] bg-[#faf8f5] shadow-inner' : 'border-zinc-100 hover:border-[#d4c4b7]/50'}`}
              >
                <div className="w-8 h-10 grid grid-cols-2 grid-rows-2 gap-1 border-2 border-[#4a443c] rounded p-1">
                   <div className="bg-[#4a443c] rounded-sm"></div><div className="bg-[#4a443c] rounded-sm"></div>
                   <div className="bg-[#4a443c] rounded-sm"></div><div className="bg-[#4a443c] rounded-sm"></div>
                </div>
                <span className="text-xs font-semibold">Grid (4 Pose)</span>
              </button>
              <button 
                onClick={() => setSelectedLayout('split-vertical')}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${selectedLayout === 'split-vertical' ? 'border-[#d4c4b7] bg-[#faf8f5] shadow-inner' : 'border-zinc-100 hover:border-[#d4c4b7]/50'}`}
              >
                <div className="w-8 h-10 flex flex-col gap-1 border-2 border-[#4a443c] rounded p-1">
                   <div className="bg-[#4a443c] flex-1 rounded-sm"></div>
                   <div className="bg-[#4a443c] flex-1 rounded-sm"></div>
                </div>
                <span className="text-xs font-semibold">Stacked (2 Pose)</span>
              </button>
            </div>
          </div>

          <button 
            onClick={createRoom} 
            disabled={creating}
            className="w-full py-4 rounded-full bg-[#4a443c] text-white font-sans font-medium hover:bg-[#3a352f] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Buat Room Photobooth
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#d4c4b7]/30"></div></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-xs font-sans text-[#a89f91]">ATAU</span></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Kode Room"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 bg-[#faf8f5] border border-[#d4c4b7]/50 rounded-full px-5 py-3 font-mono text-center outline-none focus:border-[#4a443c] transition-colors"
            />
            <button 
              onClick={() => { if(joinCode) window.location.hash = joinCode; }}
              disabled={!joinCode}
              className="px-6 rounded-full bg-[#d4c4b7] text-white font-sans font-medium hover:bg-[#c4b3a5] transition-all disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoboothRoom({ roomCode, role, onLeave }: { roomCode: string, role: 'host'|'guest', onLeave: () => void }) {
  const [room, setRoom] = useState<any>(null);
  const roomRef = useRef<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          [`${role}.photoReady`]: isFinished
        });
      }
    }
  }, [roomCode, role]);

  const compositePhotos = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!canvasRef.current || !currentRoom?.host?.photoUrls || !currentRoom?.guest?.photoUrls) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 2R Canvas Size: 600x900 (2:3 aspect ratio)
    canvas.width = 600; 
    canvas.height = 900; 
    
    const loadImages = (urls: string[]) => {
       return Promise.all(urls.map(url => {
           return new Promise<HTMLImageElement>((resolve) => {
               const img = new Image();
               img.onload = () => resolve(img);
               img.src = url;
           });
       }));
    };

    Promise.all([
        loadImages(currentRoom.host.photoUrls),
        loadImages(currentRoom.guest.photoUrls)
    ]).then(([hostImgs, guestImgs]) => {
         const bg = currentRoom.overlayBackground || '#FAF8F5';
         ctx.fillStyle = bg;
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         
         const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
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
             // Apply filter BEFORE drawing
             ctx.translate(x + w, y);
             ctx.scale(-1, 1);
             ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
             ctx.restore();
         };

         const layout = currentRoom.layout || 'grid';
         const hostFilter = currentRoom.host.filter || 'normal';
         const guestFilter = currentRoom.guest.filter || 'normal';
         
         const padding = 30;
         const spacing = 20;
         const bottomPadding = 130;
         const drawW = canvas.width - (padding * 2);
         const drawH = canvas.height - padding - bottomPadding;

         if (layout === 'grid') {
             // 4 photos: 2x2
             const cellW = (drawW - spacing) / 2;
             const cellH = (drawH - spacing) / 2;
             
             ctx.filter = getFilterCSS(hostFilter);
             if (hostImgs[0]) drawCover(hostImgs[0], padding, padding, cellW, cellH);
             if (hostImgs[1]) drawCover(hostImgs[1], padding + cellW + spacing, padding + cellH + spacing, cellW, cellH);
             
             ctx.filter = getFilterCSS(guestFilter);
             if (guestImgs[0]) drawCover(guestImgs[0], padding + cellW + spacing, padding, cellW, cellH);
             if (guestImgs[1]) drawCover(guestImgs[1], padding, padding + cellH + spacing, cellW, cellH);
         } else {
             // split-vertical (Stacked 2 poses)
             const cellW = drawW;
             const cellH = (drawH - spacing) / 2;
             
             ctx.filter = getFilterCSS(hostFilter);
             if (hostImgs[0]) drawCover(hostImgs[0], padding, padding, cellW, cellH);
             
             ctx.filter = getFilterCSS(guestFilter);
             if (guestImgs[0]) drawCover(guestImgs[0], padding, padding + cellH + spacing, cellW, cellH);
         }
         
         // Reset filter for branding
         ctx.filter = 'none';
         
         // Branding Text
         ctx.fillStyle = '#4a443c';
         ctx.textAlign = 'center';
         ctx.font = 'italic 500 28px Georgia, serif';
         ctx.fillText('Love & Memories', canvas.width / 2, canvas.height - 65);
         ctx.font = '300 12px sans-serif';
         ctx.fillText(new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }), canvas.width / 2, canvas.height - 40);
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
            'guest.connected': true
          });
        }
      } else {
        alert("Room tidak ditemukan!");
        onLeave();
      }
    });

    const handleBeforeUnload = () => {
      updateDoc(doc(db, 'rooms', roomCode), { [`${role}.connected`]: false, [`${role}.ready`]: false });
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
  }, [room?.status, room?.countdownStartAt, room?.poseIndex, room?.layout, role, roomCode, capturePhoto]);
  
  useEffect(() => {
    if (room?.host?.photoUrls && room?.guest?.photoUrls) {
        const layout = room.layout || 'split-vertical';
        const requiredPoses = layout === 'grid' ? 2 : 1;
        if (room.host.photoUrls.length >= requiredPoses && room.guest.photoUrls.length >= requiredPoses) {
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
    compositePhotos
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
          poseIndex: 0
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
            countdownStartAt: null
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
    link.download = `Memories-${roomCode}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
      <Loader2 className="w-8 h-8 animate-spin text-[#d4c4b7]" />
    </div>
  );

  const myData = role === 'host' ? room.host : room.guest;
  const otherData = role === 'host' ? room.guest : room.host;
  
  const isCaptured = room.host.photoReady && room.guest.photoReady;
  
  let statusText = "Menunggu siap...";
  if (myData?.ready && !otherData?.ready) statusText = "Menunggu partner...";
  if (!myData?.ready && otherData?.ready) statusText = "Partner sudah siap!";

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-white/60 backdrop-blur-md border-b border-[#d4c4b7]/20 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-1.5 rounded-full text-sm font-mono tracking-widest border border-[#d4c4b7]/50 shadow-sm text-[#4a443c] font-bold">
            {roomCode}
          </div>
          <span className="text-xs text-[#a89f91] uppercase tracking-wider font-semibold">{role}</span>
        </div>
        <button onClick={onLeave} className="text-[#a89f91] hover:text-[#4a443c] px-3 py-1 text-sm font-medium transition-colors">
          Keluar
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* State: Captured */}
        {isCaptured ? (
          <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-full aspect-[2/3] rounded-sm shadow-2xl relative mb-8 border-4 border-white bg-white overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full object-cover" />
            </div>
            
            <div className="w-full bg-white p-4 rounded-3xl border border-[#d4c4b7]/30 shadow-sm mb-6">
              <label className="block text-xs font-semibold mb-3 text-[#a89f91] uppercase tracking-wider">Pilih Filter</label>
              <div className="flex gap-2">
                {filterOptions.map(f => (
                  <button
                    key={f.id}
                    onClick={() => changeFilter(f.id)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                      (myData?.filter || 'normal') === f.id 
                        ? 'bg-[#4a443c] text-white shadow-md' 
                        : 'bg-[#faf8f5] text-[#a89f91] hover:bg-[#f0ebe1]'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {role === 'host' && (
              <div className="w-full bg-white p-4 rounded-3xl border border-[#d4c4b7]/30 shadow-sm mb-8">
                 <label className="block text-xs font-semibold mb-3 text-[#a89f91] uppercase tracking-wider">Warna Bingkai</label>
                 <div className="flex justify-between gap-2">
                  {[
                    {id: 'white', hex: '#ffffff'}, 
                    {id: 'black', hex: '#222222'}, 
                    {id: 'cream', hex: '#FAF8F5'}, 
                    {id: 'pink', hex: '#FCE7F3'}, 
                    {id: 'blue', hex: '#E0F2FE'}
                  ].map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => changeOverlayBackground(bg.hex)}
                      className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${
                        (room.overlayBackground || '#FAF8F5') === bg.hex 
                          ? 'border-[#4a443c] scale-110 shadow-md' 
                          : 'border-transparent shadow-sm'
                      }`}
                      style={{ backgroundColor: bg.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={downloadPhoto}
                className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-[#d4c4b7] text-[#4a443c] rounded-full font-bold shadow-sm active:scale-95 transition-transform hover:bg-[#faf8f5]"
              >
                <Download className="w-5 h-5" />
                Simpan ke Galeri
              </button>
              
              {role === 'host' && (
                <button 
                  onClick={resetSession}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-[#4a443c] text-white rounded-full font-bold shadow-xl active:scale-95 transition-transform hover:bg-[#3a352f]"
                >
                  <RefreshCcw className="w-5 h-5" />
                  Foto Ulang
                </button>
              )}
              {role === 'guest' && (
                <p className="text-[#a89f91] text-sm text-center font-medium italic mt-2">Menunggu host untuk mengulang sesi...</p>
              )}
            </div>
          </div>
        ) : (
          /* State: Camera / Waiting */
          <div className="w-full max-w-sm flex flex-col relative">
            <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[3/4] shadow-2xl border-4 border-white">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#faf8f5]">
                  <Camera className="w-12 h-12 text-[#d4c4b7] mb-4" />
                  <p className="text-[#4a443c] font-bold mb-2">Akses Kamera Ditolak</p>
                  <p className="text-[#a89f91] text-sm">{cameraError}</p>
                </div>
              ) : (
                <CustomWebcam
                  ref={webcamRef}
                  onUserMediaError={(err: string | Error) => setCameraError(typeof err === 'string' ? err : err.message || 'Gagal mengakses kamera.')}
                  className={`w-full h-full object-cover ${role === 'guest' ? '-scale-x-100' : '-scale-x-100'}`} 
                  style={{ filter: getFilterCSS(myData?.filter || 'normal') }}
                />
              )}
              
              {/* Overlay Countdown */}
              {countdown !== null && countdown > 0 && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-md z-10 animate-in fade-in">
                  <span className="text-9xl font-bold text-white drop-shadow-2xl animate-pulse">{countdown}</span>
                </div>
              )}
              
              {/* Flash effect */}
              {countdown === 0 && (
                <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-1000"></div>
              )}
              
              {/* Poses Indicator */}
              {countdown !== null && room?.layout === 'grid' && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-10">
                   <div className="bg-white/90 text-[#4a443c] text-xs px-4 py-2 rounded-full font-bold shadow-lg tracking-widest uppercase border border-white">
                     Pose {(room.poseIndex || 0) + 1} / 2
                   </div>
                </div>
              )}
              
              {/* Other user status overlay */}
              {(!otherData?.connected || otherData?.ready) && countdown === null && (
                <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none z-10">
                   {!otherData?.connected && (
                     <div className="bg-black/60 text-white text-xs px-3 py-2 rounded-full backdrop-blur-md flex items-center gap-2 shadow-lg">
                       <Loader2 className="w-3 h-3 animate-spin" /> Partner Offline
                     </div>
                   )}
                   {otherData?.connected && otherData?.ready && (
                     <div className="bg-[#4a443c]/90 text-white text-xs px-3 py-2 rounded-full backdrop-blur-md flex items-center gap-2 shadow-lg ml-auto">
                       <Check className="w-3 h-3" /> Partner Siap
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* Controls */}
            {countdown === null && (
              <div className="mt-8 flex flex-col items-center gap-4">
                <p className="text-[#a89f91] text-sm h-5 font-semibold uppercase tracking-wider">{statusText}</p>
                
                <button
                  onClick={toggleReady}
                  disabled={!otherData?.connected}
                  className={`w-full py-5 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg
                    ${!otherData?.connected 
                      ? 'bg-[#e5e0d8] text-[#a89f91] shadow-none' 
                      : myData?.ready 
                        ? 'bg-[#d4c4b7] text-white shadow-[#d4c4b7]/40' 
                        : 'bg-[#4a443c] text-white hover:bg-[#3a352f]'
                    }`}
                >
                  {myData?.ready ? (
                    <>
                      <Check className="w-6 h-6" /> Aku Siap!
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6" /> Ambil Foto
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
