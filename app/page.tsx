'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { generateRoomCode } from '@/lib/utils';
import Webcam from 'react-webcam';

import { Loader2, Camera, RefreshCcw, Check, UserPlus, Download, MessageSquare, Send, X } from 'lucide-react';

function getLocalUid() {
  if (typeof window === 'undefined') return 'temp-uid';
  let uid = localStorage.getItem('pb_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pb_uid', uid);
  }
  return uid;
}

export default function App() {
  const [user, setUser] = useState<{uid: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUser({ uid: getLocalUid() });
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFEED6]">
        <Loader2 className="animate-spin w-8 h-8 text-zinc-400" />
      </div>
    );
  }

  if (!user) return null;

  return <MainApp user={user} />;
}

function MainApp({ user }: { user: {uid: string} }) {
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('2-frames');

  const createRoom = async () => {
    setCreating(true);
    setError('');
    let code = '';
    let success = false;
    
    // Coba buat kode unik
    for (let i = 0; i < 5; i++) {
      code = generateRoomCode();
      const ref = doc(db, 'rooms', code);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          createdAt: serverTimestamp(),
          status: 'waiting',
          layout: selectedLayout,
          overlayBackground: '#ffffff',
          messages: [],
          countdownStartAt: null,
          host: {
            uid: user.uid,
            connected: true,
            ready: false,
            photoUrl: null,
            photoReady: false
          },
          guest: {
            uid: null,
            connected: false,
            ready: false,
            photoUrl: null,
            photoReady: false
          }
        });
        success = true;
        break;
      }
    }
    
    setCreating(false);
    if (success) {
      setRole('host');
      setRoomCode(code);
    } else {
      setError('Gagal membuat room, coba lagi.');
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = joinInput.trim();
    if (code.length < 4) return;
    
    const ref = doc(db, 'rooms', code);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      setError('Kode tidak ditemukan.');
      return;
    }
    
    const data = snap.data();
    if (data.status !== 'waiting') {
      setError('Room sudah penuh atau sedang berjalan.');
      return;
    }
    
    // Gabung sebagai guest
    await updateDoc(ref, {
      'guest.uid': user.uid,
      'guest.connected': true,
      status: 'both_connected'
    });
    
    setRole('guest');
    setRoomCode(code);
  };

  if (roomCode && role) {
    return <PhotoboothRoom roomCode={roomCode} role={role} onLeave={() => { setRoomCode(''); setRole(null); }} />;
  }

  if (isConfiguring) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FFEED6] p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-zinc-100 max-w-sm w-full">
          <h2 className="text-xl font-bold mb-6 text-center">Pilih Layout Frame</h2>
          
          <div className="flex flex-col gap-3 mb-8">
            <button 
              onClick={() => setSelectedLayout('2-frames')}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${selectedLayout === '2-frames' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}
            >
              <div className="font-semibold mb-1">2 Frames</div>
              <div className="text-xs text-zinc-500">2 kali foto, gaya strip photobooth</div>
            </button>
            <button 
              onClick={() => setSelectedLayout('3-frames')}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${selectedLayout === '3-frames' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}
            >
              <div className="font-semibold mb-1">3 Frames</div>
              <div className="text-xs text-zinc-500">3 kali foto, gaya strip photobooth</div>
            </button>
            <button 
              onClick={() => setSelectedLayout('4-frames')}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${selectedLayout === '4-frames' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}
            >
              <div className="font-semibold mb-1">4 Frames</div>
              <div className="text-xs text-zinc-500">4 kali foto, gaya strip photobooth</div>
            </button>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setIsConfiguring(false)}
              className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-medium hover:bg-zinc-200 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={createRoom}
              disabled={creating}
              className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buat Room"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FFEED6] p-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-zinc-100 max-w-sm w-full relative">
        <img src="https://upload.wikimedia.org/wikipedia/en/5/53/Snoopy_Peanuts.png" alt="Snoopy" className="w-16 h-16 absolute -top-12 left-1/2 -translate-x-1/2 object-contain drop-shadow-sm" />
        <h1 className="text-2xl font-bold mb-8 mt-4 text-center text-zinc-900 leading-tight">Untuk Ghina <br/><span className="text-zinc-500 font-medium text-lg">Dari Aghna</span></h1>
        
        <button 
          onClick={() => setIsConfiguring(true)}
          className="w-full py-4 mb-6 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          Buat Sesi Baru
        </button>

        <div className="relative flex items-center py-2 mb-6">
          <div className="flex-grow border-t border-zinc-200"></div>
          <span className="flex-shrink-0 mx-4 text-zinc-400 text-sm">atau</span>
          <div className="flex-grow border-t border-zinc-200"></div>
        </div>

        <form onSubmit={joinRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Kode Room</label>
            <input 
              type="text" 
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              placeholder="Contoh: 1234"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all text-center text-xl tracking-widest uppercase"
              maxLength={6}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button 
            type="submit"
            disabled={joinInput.length < 4}
            className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            Gabung Sesi
          </button>
        </form>
      </div>
    </div>
  );
}

const filterOptions = [
  { id: 'normal', name: 'Normal', style: 'none' },
  { id: 'bw', name: 'B&W', style: 'grayscale(100%) contrast(110%)' },
  { id: 'noir', name: 'Noir', style: 'grayscale(100%) contrast(150%) brightness(90%)' },
  { id: 'vintage', name: 'Vintage', style: 'sepia(50%) contrast(120%) saturate(120%) hue-rotate(-15deg)' },
  { id: 'film', name: 'Film', style: 'contrast(120%) saturate(110%) sepia(20%) brightness(95%) hue-rotate(5deg)' },
  { id: 'retro', name: 'Retro', style: 'sepia(40%) saturate(150%) hue-rotate(-20deg) contrast(120%) brightness(90%)' },
  { id: 'warm', name: 'Warm', style: 'sepia(30%) saturate(140%) hue-rotate(-10deg) contrast(110%)' },
  { id: 'cool', name: 'Cool', style: 'saturate(110%) hue-rotate(15deg) contrast(105%) brightness(105%)' },
  { id: 'fade', name: 'Fade', style: 'contrast(85%) brightness(110%) saturate(80%) sepia(10%)' },
];

const getFilterCSS = (fid: string) => filterOptions.find(f => f.id === fid)?.style || 'none';

function PhotoboothRoom({ roomCode, role, onLeave }: { roomCode: string, role: 'host'|'guest', onLeave: () => void }) {
  const [room, setRoom] = useState<any>(null);
  const roomRef = useRef<any>(null);
  
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room?.messages?.length, room?.host?.isTyping, room?.guest?.isTyping, isChatOpen]);
  
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    
    if (roomCode) {
      updateDoc(doc(db, 'rooms', roomCode), {
        [`${role}.isTyping`]: true
      });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        updateDoc(doc(db, 'rooms', roomCode), {
          [`${role}.isTyping`]: false
        });
      }, 2000);
    }
  };
  
  const otherRole = role === 'host' ? 'guest' : 'host';

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      // Ambil screenshot full resolution, biarkan drawCover yang crop.
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const currentRoom = roomRef.current;
        const currentPhotos = currentRoom?.[role]?.photoUrls || [];
        const newPhotos = [...currentPhotos, imageSrc];
        
        const layout = currentRoom?.layout || '2-frames';
        const requiredPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
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
    
    // Set aspect ratio 2R portrait (750x1050) -> 2.5 : 3.5 inches at 300 DPI
    canvas.width = 750; 
    canvas.height = 1050; 
    
    const loadImages = (urls: string[]) => {
       return Promise.all(urls.map(url => {
           return new Promise<HTMLImageElement>((resolve) => {
               const img = new Image();
               img.crossOrigin = 'anonymous';
               img.onload = () => resolve(img);
               img.onerror = () => resolve(img); // resolve anyway to not break Promise.all
               img.src = url;
           });
       }));
    };

    const bgTheme = currentRoom.overlayBackground || '#ffffff';
    let themeAssetsUrl: string[] = [];
    if (bgTheme === 'theme-snoopy') {
        themeAssetsUrl = ['https://upload.wikimedia.org/wikipedia/en/5/53/Snoopy_Peanuts.png'];
    } else if (bgTheme === 'theme-ghibli') {
        themeAssetsUrl = ['https://upload.wikimedia.org/wikipedia/commons/8/86/Studio_Ghibli_portal_logo.png'];
    } else if (bgTheme === 'theme-miles') {
        themeAssetsUrl = ['https://upload.wikimedia.org/wikipedia/en/5/5d/Miles_Morales_%28Earth-616%29_from_Miles_Morales_Spider-Man_Vol_1_10_001.png'];
    } else if (bgTheme === 'theme-gwen') {
        themeAssetsUrl = ['https://upload.wikimedia.org/wikipedia/en/5/52/Spider-Gwen.png'];
    }

    Promise.all([
        loadImages(currentRoom.host.photoUrls),
        loadImages(currentRoom.guest.photoUrls),
        loadImages(themeAssetsUrl)
    ]).then(([hostImgs, guestImgs, themeImgs]) => {
         let baseColor = bgTheme;
         if (bgTheme === 'theme-snoopy') baseColor = '#ffffff';
         if (bgTheme === 'theme-ghibli') baseColor = '#dcfce7'; // light green
         if (bgTheme === 'theme-brat') baseColor = '#8ACE00';
         if (bgTheme === 'theme-miles') baseColor = '#18181b'; // dark zinc
         if (bgTheme === 'theme-gwen') baseColor = '#fbcfe8'; // light pink

         ctx.fillStyle = baseColor;
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
             ctx.translate(x, y);
             ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
             ctx.restore();
         };

         const layout = currentRoom.layout || '2-frames';
         const framesCount = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
         const hostFilter = currentRoom.host.filter || 'normal';
         const guestFilter = currentRoom.guest.filter || 'normal';
         
         const gap = 30;
         const totalGaps = gap * (framesCount - 1);
         const paddingX = 30;
         const paddingTop = 30;
         const paddingBottom = 150;
         
         const availableHeight = canvas.height - paddingTop - paddingBottom - totalGaps;
         const rowHeight = availableHeight / framesCount;
         const photoWidth = (canvas.width - (paddingX * 2)) / 2; // host and guest share row width
         
         for (let i = 0; i < framesCount; i++) {
             const y = paddingTop + i * (rowHeight + gap);
             
             ctx.filter = getFilterCSS(hostFilter);
             if (hostImgs[i]) drawCover(hostImgs[i], paddingX,  y, photoWidth, rowHeight);
             
             ctx.filter = getFilterCSS(guestFilter);
             if (guestImgs[i]) drawCover(guestImgs[i], paddingX + photoWidth, y, photoWidth, rowHeight);
         }

         // Draw elegant, minimalist photobooth branding at the bottom
         ctx.filter = 'none';
         const textColor = baseColor.toLowerCase() === '#000000' ? '#ffffff' : '#18181b';
         const subColor = baseColor.toLowerCase() === '#000000' ? '#a1a1aa' : '#71717a';
         
         ctx.fillStyle = textColor;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         
         const dateStr = new Date().toLocaleDateString('id-ID', {
             day: '2-digit',
             month: '2-digit',
             year: 'numeric'
         }).replace(/\//g, '.');

         if (bgTheme === 'theme-snoopy') {
             if (themeImgs[0]) {
                 // Draw snoopy at the bottom center
                 const snoopyWidth = 80;
                 const snoopyHeight = themeImgs[0].height * (snoopyWidth / themeImgs[0].width);
                 ctx.drawImage(themeImgs[0], canvas.width / 2 - snoopyWidth / 2, canvas.height - 140, snoopyWidth, snoopyHeight);
                 
                 // Draw snoopy overlapping the top right frame slightly
                 const topSnoopyWidth = 60;
                 const topSnoopyHeight = themeImgs[0].height * (topSnoopyWidth / themeImgs[0].width);
                 ctx.save();
                 ctx.translate(canvas.width - paddingX - 10, paddingTop - 10);
                 ctx.rotate(15 * Math.PI / 180);
                 ctx.drawImage(themeImgs[0], -topSnoopyWidth/2, -topSnoopyHeight/2, topSnoopyWidth, topSnoopyHeight);
                 ctx.restore();

                 // Draw snoopy overlapping the left middle frame slightly
                 const midSnoopyWidth = 50;
                 const midSnoopyHeight = themeImgs[0].height * (midSnoopyWidth / themeImgs[0].width);
                 ctx.save();
                 ctx.translate(paddingX + 10, canvas.height / 2);
                 ctx.rotate(-15 * Math.PI / 180);
                 ctx.drawImage(themeImgs[0], -midSnoopyWidth/2, -midSnoopyHeight/2, midSnoopyWidth, midSnoopyHeight);
                 ctx.restore();
             }
             ctx.fillStyle = '#000000';
             ctx.font = 'bold 24px "Courier New", Courier, monospace';
             ctx.fillText('S N O O P Y  P H O T O S', canvas.width / 2, canvas.height - 50);
         } else if (bgTheme === 'theme-ghibli') {
             if (themeImgs[0]) {
                 const ghibliWidth = 120;
                 const ghibliHeight = themeImgs[0].height * (ghibliWidth / themeImgs[0].width);
                 ctx.drawImage(themeImgs[0], canvas.width / 2 - ghibliWidth / 2, canvas.height - 110, ghibliWidth, ghibliHeight);
             }
             ctx.fillStyle = '#475569';
             ctx.font = '500 14px "Georgia", serif';
             ctx.fillText(`${dateStr}  ~  #${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 35);
         } else if (bgTheme === 'theme-miles') {
             if (themeImgs[0]) {
                 const mWidth = 100;
                 const mHeight = themeImgs[0].height * (mWidth / themeImgs[0].width);
                 // Draw on bottom right
                 ctx.drawImage(themeImgs[0], canvas.width - mWidth - 20, canvas.height - mHeight - 20, mWidth, mHeight);
                 
                 // Draw overlapping top left
                 const topMWidth = 80;
                 const topMHeight = themeImgs[0].height * (topMWidth / themeImgs[0].width);
                 ctx.save();
                 ctx.translate(paddingX + 20, paddingTop + 20);
                 ctx.rotate(-20 * Math.PI / 180);
                 ctx.drawImage(themeImgs[0], -topMWidth/2, -topMHeight/2, topMWidth, topMHeight);
                 ctx.restore();
             }
             ctx.fillStyle = '#ef4444'; // Red text
             ctx.font = 'bold 28px sans-serif';
             ctx.fillText('M I L E S', canvas.width / 2, canvas.height - 80);
             ctx.fillStyle = '#ffffff';
             ctx.font = '500 16px sans-serif';
             ctx.fillText(`${dateStr}  •  #${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 50);
         } else if (bgTheme === 'theme-gwen') {
             if (themeImgs[0]) {
                 const gWidth = 100;
                 const gHeight = themeImgs[0].height * (gWidth / themeImgs[0].width);
                 // Draw on bottom left
                 ctx.drawImage(themeImgs[0], 20, canvas.height - gHeight - 20, gWidth, gHeight);
                 
                 // Draw overlapping top right
                 const topGWidth = 80;
                 const topGHeight = themeImgs[0].height * (topGWidth / themeImgs[0].width);
                 ctx.save();
                 ctx.translate(canvas.width - paddingX - 20, paddingTop + 20);
                 ctx.rotate(15 * Math.PI / 180);
                 ctx.drawImage(themeImgs[0], -topGWidth/2, -topGHeight/2, topGWidth, topGHeight);
                 ctx.restore();
             }
             ctx.fillStyle = '#0ea5e9'; // Cyan text
             ctx.font = 'bold 28px sans-serif';
             ctx.fillText('G W E N', canvas.width / 2, canvas.height - 80);
             ctx.fillStyle = '#ffffff';
             ctx.font = '500 16px sans-serif';
             ctx.fillText(`${dateStr}  •  #${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 50);
         } else if (bgTheme === 'theme-brat') {
             ctx.font = 'normal 48px Arial, Helvetica, sans-serif';
             // add blur effect
             ctx.filter = 'blur(1px)';
             ctx.fillText('brat', canvas.width / 2, canvas.height - 75);
             ctx.filter = 'none';
         } else {
             // Title: elegant style with wide tracking
             ctx.font = 'bold 24px "Courier New", Courier, monospace';
             ctx.fillText('P H O T O B O O T H', canvas.width / 2, canvas.height - 90);
             
             // Date & Room Code: clean utility text
             ctx.fillStyle = subColor;
             ctx.font = '500 16px sans-serif';
             ctx.fillText(`${dateStr}  •  #${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 50);
         }
    });
  }, [roomCode]);

  // 1. Sinkronisasi Koneksi (Cleanup on disconnect)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const ref = doc(db, 'rooms', roomCode);
      updateDoc(ref, {
        [`${role}.connected`]: false,
        [`${role}.ready`]: false,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomCode, role]);

  // 2. Real-time Listener (The Single Source of Truth)
  useEffect(() => {
    const ref = doc(db, 'rooms', roomCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoom(data);
        
        // Host trigger countdown jika kedua ready
        if (role === 'host' && (data.status === 'both_connected' || data.status === 'ready')) {
          if (data.host.ready && data.guest.ready && data.status !== 'countdown') {
            updateDoc(ref, {
              status: 'countdown',
              countdownStartAt: Date.now() + 4000, // 4 detik dari sekarang untuk buffer jaringan
              poseIndex: 0
            });
          }
        }
      } else {
        alert("Sesi telah berakhir.");
        onLeave();
      }
    });
    return unsub;
  }, [roomCode, role, onLeave]);

  // Session Expiry Check
  useEffect(() => {
    if (!room?.createdAt || typeof room.createdAt.toDate !== 'function') return;
    
    const createdAtTime = room.createdAt.toDate().getTime();
    const expiryTime = createdAtTime + 15 * 60 * 1000; // 15 minutes
    
    const checkExpiry = () => {
      if (Date.now() >= expiryTime) {
        alert("Session Expired: Room is older than 15 minutes.");
        onLeave();
      }
    };
    
    checkExpiry();
    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
  }, [room?.createdAt, onLeave]);

  // 3. Countdown Tersinkronisasi
  useEffect(() => {
    if (room?.status === 'countdown' && room.countdownStartAt) {
      const interval = setInterval(() => {
        const remaining = room.countdownStartAt - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(0);
          capturePhoto();
          
          if (role === 'host') {
             const layout = room.layout || '2-frames';
             const requiredPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
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
  }, [room?.status, room?.countdownStartAt, room?.poseIndex, capturePhoto, role, room?.layout, roomCode]);
  
  // 4. Compositing saat kedua foto siap
  useEffect(() => {
    if (room?.status === 'countdown' || room?.status === 'captured') {
        if (room.host.photoReady && room.guest.photoReady && room.status !== 'captured') {
            compositePhotos();
            if (role === 'host') {
                updateDoc(doc(db, 'rooms', roomCode), { status: 'captured' });
            }
        }
        
        if (room.status === 'captured') {
            compositePhotos();
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room?.host?.photoReady, 
    room?.guest?.photoReady, 
    room?.status, 
    role,
    room?.host?.filter,
    room?.guest?.filter,
    room?.overlayBackground,
    compositePhotos,
    roomCode
  ]);

  const toggleReady = () => {
    if (!room) return;
    const currentReady = room[role].ready;
    updateDoc(doc(db, 'rooms', roomCode), {
      [`${role}.ready`]: !currentReady,
      status: 'ready'
    });
  };

  const changeLayout = (newLayout: string) => {
    if (role === 'host') {
      updateDoc(doc(db, 'rooms', roomCode), { layout: newLayout });
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


  const resetSession = () => {
    updateDoc(doc(db, 'rooms', roomCode), {
        status: 'both_connected',
        'host.ready': false,
        'guest.ready': false,
        'host.photoReady': false,
        'guest.photoReady': false,
        'host.photoUrls': [],
        'guest.photoUrls': [],
        poseIndex: 0,
        countdownStartAt: null
    });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomCode) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    const newMessage = {
      text: chatInput.trim(),
      senderId: getLocalUid(),
      role: role,
      timestamp: Date.now()
    };
    
    updateDoc(doc(db, 'rooms', roomCode), {
      messages: [...(room?.messages || []), newMessage],
      [`${role}.isTyping`]: false
    });
    setChatInput('');
  };

  const downloadPhoto = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `photobooth-${roomCode}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (!room) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FFEED6]"><Loader2 className="animate-spin w-8 h-8 text-zinc-900" /></div>;
  }

  const isCaptured = room.status === 'captured';
  const myData = room[role];
  const otherData = room[otherRole];
  
  let statusText = 'Menunggu peserta lain...';
  if (room.status === 'both_connected' || room.status === 'ready') {
    if (!otherData.connected) {
      statusText = 'Peserta lain terputus.';
    } else if (myData.ready && !otherData.ready) {
      statusText = 'Menunggu peserta lain ready...';
    } else if (!myData.ready && otherData.ready) {
      statusText = 'Peserta lain sudah ready!';
    } else {
      statusText = 'Kedua peserta terhubung';
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#FFEED6] text-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/40 backdrop-blur-md border-b border-white/20">
        <div className="flex items-center gap-3">
          <img src="https://upload.wikimedia.org/wikipedia/en/5/53/Snoopy_Peanuts.png" alt="Snoopy" className="w-8 h-8 object-contain drop-shadow-sm" />
          <div className="bg-white/60 px-3 py-1.5 rounded-lg text-sm font-mono tracking-widest border border-white/50 shadow-sm">
            {roomCode}
          </div>
          <span className="text-xs text-zinc-500 capitalize font-medium">{role}</span>
        </div>
        <button onClick={onLeave} className="text-zinc-600 hover:text-zinc-900 px-3 py-1 text-sm font-medium transition-colors">
          Keluar
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
        
        {/* State: Captured */}
        {isCaptured ? (
          <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-full aspect-[5/7] bg-white rounded-lg p-2 shadow-2xl relative mb-8">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>
            
            <div className="w-full flex overflow-x-auto bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm gap-2 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {filterOptions.map(f => (
                <button
                  key={f.id}
                  onClick={() => changeFilter(f.id)}
                  className={`flex-none px-4 py-2 text-xs font-medium rounded-xl transition-colors ${
                    (myData.filter || 'normal') === f.id 
                      ? 'bg-[#FFEED6] text-zinc-900 border border-zinc-200 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {role === 'host' && (
              <div className="w-full flex overflow-x-auto bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm gap-2 mb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {[
                  {id: 'white', hex: '#ffffff'}, 
                  {id: 'black', hex: '#000000'}, 
                  {id: 'cream', hex: '#FFEED6'},
                  {id: 'pink', hex: '#fbcfe8'},
                  {id: 'blue', hex: '#bfdbfe'},
                  {id: 'snoopy', hex: 'theme-snoopy', icon: 'https://upload.wikimedia.org/wikipedia/en/5/53/Snoopy_Peanuts.png'},
                  {id: 'ghibli', hex: 'theme-ghibli', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Studio_Ghibli_portal_logo.png'},
                  {id: 'brat', hex: 'theme-brat', label: 'brat'},
                  {id: 'miles', hex: 'theme-miles', icon: 'https://upload.wikimedia.org/wikipedia/en/5/5d/Miles_Morales_%28Earth-616%29_from_Miles_Morales_Spider-Man_Vol_1_10_001.png'},
                  {id: 'gwen', hex: 'theme-gwen', icon: 'https://upload.wikimedia.org/wikipedia/en/5/52/Spider-Gwen.png'}
                ].map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => changeOverlayBackground(bg.hex)}
                    className={`flex-none w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 overflow-hidden ${
                      (room.overlayBackground || '#ffffff') === bg.hex 
                        ? 'border-zinc-900 scale-110 shadow-md' 
                        : 'border-zinc-200'
                    }`}
                    style={{ backgroundColor: bg.hex.startsWith('#') ? bg.hex : (bg.id === 'brat' ? '#8ACE00' : '#ffffff') }}
                  >
                    {bg.icon && <img src={bg.icon} alt={bg.id} className="w-full h-full object-contain p-1" />}
                    {bg.label && <span className="text-[10px] font-bold font-sans tracking-tighter text-black">{bg.label}</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={downloadPhoto}
                className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-100 text-black rounded-full font-bold shadow-xl active:scale-95 transition-transform"
              >
                <Download className="w-5 h-5" />
                Download Foto
              </button>

              <button 
                onClick={resetSession}
                className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-800 text-white rounded-full font-bold shadow-xl active:scale-95 transition-transform"
              >
                <RefreshCcw className="w-5 h-5" />
                Retake Foto
              </button>
            </div>
          </div>
        ) : (
          /* State: Camera / Waiting */
          <div className="w-full max-w-sm flex flex-col relative items-center">
            <div className="relative w-full max-h-[65vh] rounded-3xl overflow-hidden bg-black border border-zinc-800 shadow-2xl transition-all duration-500" style={{
               aspectRatio: room?.layout === '4-frames' ? '276 / 156' : room?.layout === '3-frames' ? '276 / 216' : '276 / 336'
            }}>
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-zinc-100">
                  <Camera className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-zinc-900 font-medium mb-2">Akses Kamera Ditolak</p>
                  <p className="text-zinc-500 text-sm">{cameraError}</p>
                </div>
              ) : (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored={true}
                  forceScreenshotSourceSize={true}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  onUserMediaError={(err) => setCameraError(typeof err === 'string' ? err : err.message || 'Gagal mengakses kamera.')}
                  className="w-full h-full object-cover" 
                  style={{ filter: getFilterCSS(myData.filter || 'normal') }}
                />
              )}
              
              {/* Overlay Countdown */}
              {countdown !== null && countdown > 0 && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 animate-in fade-in">
                  <span className="text-8xl font-bold text-white drop-shadow-2xl animate-pulse">{countdown}</span>
                </div>
              )}
              
              {/* Flash effect when countdown reaches 0 */}
              {countdown === 0 && (
                <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-1000"></div>
              )}
              
              {/* Overlay Poses Indicator */}
              {countdown !== null && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-10">
                   <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md font-bold shadow-lg">
                     Foto {(room.poseIndex || 0) + 1} / {room?.layout === '4-frames' ? 4 : room?.layout === '3-frames' ? 3 : 2}
                   </div>
                </div>
              )}
              
              {/* Other user status overlay */}
              {(!otherData.connected || otherData.ready) && countdown === null && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                   {!otherData.connected && (
                     <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                       <Loader2 className="w-3 h-3 animate-spin" /> Menunggu...
                     </div>
                   )}
                   {otherData.connected && otherData.ready && (
                     <div className="bg-green-500/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg ml-auto">
                       <Check className="w-3 h-3" /> Partner Ready
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* Controls */}
            {countdown === null && (
              <div className="mt-6 flex flex-col items-center gap-4">
                
                <p className="text-zinc-500 text-sm h-5 font-medium">{statusText}</p>
                
                <button
                  onClick={toggleReady}
                  disabled={!otherData.connected}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2
                    ${!otherData.connected 
                      ? 'bg-zinc-200 text-zinc-400' 
                      : myData.ready 
                        ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                >
                  {myData.ready ? (
                    <>
                      <Check className="w-5 h-5" /> Siap!
                    </>
                  ) : (
                    "Saya Siap"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Chat */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {isChatOpen && (
          <div className="w-80 h-96 bg-white rounded-2xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="p-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-700">Chat</span>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {room.messages?.map((msg: any, i: number) => {
                const isMe = msg.senderId === getLocalUid();
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-zinc-900 text-white rounded-tr-sm' : 'bg-zinc-100 text-zinc-800 rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 capitalize">{msg.role}</span>
                  </div>
                );
              })}
              {room[otherRole]?.isTyping && (
                <div className="flex flex-col items-start animate-in fade-in">
                  <div className="px-4 py-3 rounded-2xl bg-zinc-100 rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 capitalize">{otherRole} is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-2 border-t border-zinc-100 flex gap-2 bg-white">
              <input
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder="Ketik pesan..."
                className="flex-1 bg-zinc-50 rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="p-2 bg-zinc-900 text-white rounded-xl disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
        
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="w-12 h-12 bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
