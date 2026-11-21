'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  arrayUnion,
} from '@/lib/store';
import { FRAME_GAP, PADDING_BOTTOM, PADDING_TOP, PADDING_X, getFrameCount } from '@/lib/photoLayout';
import { PRESET_OVERLAYS } from '@/lib/templates';
import { filterOptions, getFilterCSS, swatchTextColor } from '@/lib/photoFilters';
import { compressScreenshot } from '@/lib/imageUtils';
import SupportCard from '@/components/SupportCard';
import Webcam from 'react-webcam';
import { FriendItem, RoomData, CustomOverlayData } from './types';
import { timestampToMillis, playNotificationSound, ROOM_TTL_MS } from './shared';
import {
  Camera,
  RefreshCcw,
  Check,
  Users,
  Download,
  MessageSquare,
  Send,
  X,
  Copy,
  Trash2,
  UserPlus,
  Edit3
} from 'lucide-react';

export default function PhotoboothRoom({ 
  roomCode, 
  role, 
  userName, 
  userUid, 
  friends, 
  onAddFriend, 
  onLeave 
}: { 
  roomCode: string; 
  role: 'host' | 'guest'; 
  userName: string; 
  userUid: string; 
  friends: FriendItem[]; 
  onAddFriend: (friend: FriendItem) => void; 
  onLeave: () => void; 
}) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [customOverlays, setCustomOverlays] = useState<CustomOverlayData[]>([]);
  // Photos live outside the room document so realtime updates stay small.
  const [photos, setPhotos] = useState<{ host: string[]; guest: string[] }>({ host: [], guest: [] });
  const roomRef = useRef<RoomData | null>(null);
  const customOverlaysRef = useRef<CustomOverlayData[]>([]);
  const photosRef = useRef<{ host: string[]; guest: string[] }>({ host: [], guest: [] });
  const imageCacheRef = useRef<Map<string, Promise<HTMLImageElement | null>>>(new Map());
  
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    customOverlaysRef.current = customOverlays;
  }, [customOverlays]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!roomCode) return;
    const unsubs = (['host', 'guest'] as const).map((who) =>
      onSnapshot(doc(db, 'room_photos', `${roomCode}__${who}`), (snap) => {
        const urls = (snap.data().urls as string[] | undefined) || [];
        setPhotos((prev) => (prev[who] === urls ? prev : { ...prev, [who]: urls }));
      })
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [roomCode]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'overlays'), (snap) => {
      const data: CustomOverlayData[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as CustomOverlayData));
      const savedIds = new Set(data.map((o) => o.id));
      PRESET_OVERLAYS.forEach((preset) => {
        if (!savedIds.has(preset.id)) data.push(preset);
      });
      setCustomOverlays(data);
    });
    return unsub;
  }, []);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Chat
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const prevMsgCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const [partnerAdded, setPartnerAdded] = useState(false);

  const allMessages = room?.messages || [];
  const unreadCount = isChatOpen ? 0 : Math.max(0, allMessages.length - lastReadCount);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView();
    }
  }, [room?.messages?.length, room?.host?.isTyping, room?.guest?.isTyping, isChatOpen]);

  useEffect(() => {
    const msgs = room?.messages || [];
    if (msgs.length > prevMsgCountRef.current) {
      const newMsgs = msgs.slice(prevMsgCountRef.current);
      const partnerMsgs = newMsgs.filter((m) => m.senderId !== userUid);

      if (!isChatOpen && partnerMsgs.length > 0) {
        playNotificationSound();
      }
      prevMsgCountRef.current = msgs.length;
    }
  }, [room?.messages, isChatOpen, userUid]);

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setLastReadCount(room?.messages?.length || 0);
  };
  
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    
    if (roomCode) {
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        updateDoc(doc(db, 'rooms', roomCode), {
          [`${role}.isTyping`]: true
        });
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        typingActiveRef.current = false;
        updateDoc(doc(db, 'rooms', roomCode), {
          [`${role}.isTyping`]: false
        });
      }, 2000);
    }
  };
  
  const otherRole = role === 'host' ? 'guest' : 'host';

  const capturePhoto = useCallback(() => {
    const webcam = webcamRef.current;
    const currentRoom = roomRef.current;
    if (!webcam || !currentRoom) return;

    const currentPhotos = photosRef.current[role] || [];
    const poseIndex = currentRoom.poseIndex || 0;
    // The countdown can re-run while snapshots arrive; never store two
    // photos for the same pose.
    if (currentPhotos.length > poseIndex) return;

    const imageSrc = webcam.getScreenshot();
    if (!imageSrc) return;

    compressScreenshot(imageSrc).then((photo) => {
      const latestRoom = roomRef.current;
      if (!latestRoom) return;
      const latestPhotos = photosRef.current[role] || [];
      const latestPose = latestRoom.poseIndex || 0;
      if (latestPhotos.length > latestPose) return;

      const newPhotos = [...latestPhotos, photo];
      const requiredPoses = getFrameCount(latestRoom.layout);

      setDoc(doc(db, 'room_photos', `${roomCode}__${role}`), { urls: newPhotos }).catch((err) => console.error('Gagal menyimpan foto:', err));
      updateDoc(doc(db, 'rooms', roomCode), {
        [`${role}.photoReady`]: newPhotos.length >= requiredPoses
      }).catch((err) => console.error('Gagal menyimpan foto:', err));
    });
  }, [roomCode, role]);

  const compositePhotos = useCallback(() => {
    const currentRoom = roomRef.current;
    const currentPhotos = photosRef.current;
    if (!canvasRef.current || !currentRoom) return;
    if (!currentPhotos.host.length || !currentPhotos.guest.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 750; 
    canvas.height = 1050; 
    
    const loadImages = (urls: string[]) => {
       return Promise.all(urls.map(url => {
           if (!url) return Promise.resolve<HTMLImageElement | null>(null);
           const cache = imageCacheRef.current;
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
       }));
    };

    const bgTheme = currentRoom.overlayBackground || '#ffffff';
    let themeAssetsUrl: string[] = [];
    const customMatch = customOverlaysRef.current.find(o => o.hex === bgTheme);

    if (customMatch && customMatch.icon) {
      themeAssetsUrl = [customMatch.icon];
    }

    const customLayers = (customMatch && customMatch.layers && Array.isArray(customMatch.layers)) ? customMatch.layers : [];
    const layerUrls = customLayers.map((l) => l.src || '');

    Promise.all([
        loadImages(currentPhotos.host),
        loadImages(currentPhotos.guest),
        loadImages(themeAssetsUrl),
        loadImages(layerUrls)
    ]).then(([hostImgs, guestImgs, themeImgs, layerImgs]) => {
         const baseColor = customMatch?.baseColor || bgTheme;
         const gradient = customMatch?.gradient;

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
         
         const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
             if (!img.naturalWidth || !img.naturalHeight) return;
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

         const framesCount = getFrameCount(currentRoom.layout);
         const hostFilter = currentRoom.host.filter || 'normal';
         const guestFilter = currentRoom.guest.filter || 'normal';
         
         const gap = FRAME_GAP;
         const totalGaps = gap * (framesCount - 1);
         const paddingX = PADDING_X;
         const paddingTop = PADDING_TOP;
         const paddingBottom = PADDING_BOTTOM;
         
         const availableHeight = canvas.height - paddingTop - paddingBottom - totalGaps;
         const rowHeight = availableHeight / framesCount;
         const photoWidth = (canvas.width - (paddingX * 2)) / 2;
         
         for (let i = 0; i < framesCount; i++) {
             const y = paddingTop + i * (rowHeight + gap);
             
             const hostImg = hostImgs[i];
             const guestImg = guestImgs[i];

             ctx.filter = getFilterCSS(hostFilter);
             if (hostImg) drawCover(hostImg, paddingX,  y, photoWidth, rowHeight);
             
             ctx.filter = getFilterCSS(guestFilter);
             if (guestImg) drawCover(guestImg, paddingX + photoWidth, y, photoWidth, rowHeight);
         }

         ctx.filter = 'none';
         const baseColorLower = String(baseColor).toLowerCase();
         const textColor = baseColorLower === '#000000' ? '#ffffff' : '#18181b';
         const subColor = baseColorLower === '#000000' ? '#a1a1aa' : '#71717a';
         
         ctx.fillStyle = textColor;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         
         const dateStr = (() => {
             const custom = currentRoom.footerDate;
             if (custom && /^\d{4}-\d{2}-\d{2}$/.test(custom)) {
                 const [y, m, d] = custom.split('-');
                 return `${d}.${m}.${y}`;
             }
             return new Date().toLocaleDateString('id-ID', {
                 day: '2-digit',
                 month: '2-digit',
                 year: 'numeric'
             }).replace(/\//g, '.');
         })();
         const showDate = currentRoom.showFooterDate !== false;
         const footerTitle = ((currentRoom.footerName || '').trim() || customMatch?.name || 'FOTOYUK').toUpperCase();

         if (customMatch && themeImgs[0]) {
             const iconWidth = 70;
             const iconHeight = themeImgs[0].height * (iconWidth / themeImgs[0].width);
             ctx.drawImage(themeImgs[0], canvas.width / 2 - iconWidth / 2, canvas.height - 100, iconWidth, iconHeight);
         }

         ctx.fillStyle = textColor;
         ctx.font = customMatch
             ? 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif'
             : 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
         ctx.fillText(footerTitle, canvas.width / 2, canvas.height - (customMatch ? 45 : 50));

         ctx.fillStyle = subColor;
         ctx.font = '500 12px monospace';
         ctx.fillText(showDate ? `${dateStr} • ${roomCode.toUpperCase()}` : roomCode.toUpperCase(), canvas.width / 2, canvas.height - (customMatch ? 20 : 25));

         // Draw custom designed layers on top
         customLayers.forEach((layer, idx) => {
             if (layer.hidden) return;
             ctx.save();
             if (layer.opacity !== undefined && layer.opacity !== null) {
                 ctx.globalAlpha = Number(layer.opacity);
             }
             ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
             ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);

             if (layer.type === 'text' && layer.text) {
                 ctx.fillStyle = layer.color || '#18181B';
                 const fontSize = layer.fontSize || 32;
                 const fontFamily = layer.fontFamily || 'sans-serif';
                 ctx.font = `bold ${fontSize}px ${fontFamily}`;
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(layer.text, 0, 0);
             } else {
                 const img = layerImgs[idx];
                 if (img && img.complete && img.naturalWidth > 0) {
                     ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
                 }
             }
             ctx.restore();
         });
    });
  }, [roomCode]);

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

  // Real-time Room Listener
  useEffect(() => {
    const ref = doc(db, 'rooms', roomCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RoomData;
        setRoom(data);
        
        if (role === 'host' && (data.status === 'both_connected' || data.status === 'ready')) {
          if (data.host.ready && data.guest.ready) {
            updateDoc(ref, {
              status: 'countdown',
              countdownStartAt: Date.now() + 3500,
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

  // Expiry check
  useEffect(() => {
    if (!room?.createdAt || typeof room.createdAt.toDate !== 'function') return;
    
    const createdAtTime = room.createdAt.toDate().getTime();
    const expiryTime = createdAtTime + ROOM_TTL_MS;
    
    const checkExpiry = () => {
      if (Date.now() >= expiryTime) {
        alert("Sesi berakhir karena melewati batas waktu.");
        onLeave();
      }
    };
    
    checkExpiry();
    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
  }, [room?.createdAt, onLeave]);

  // Countdown timer
  useEffect(() => {
    if (room?.status === 'countdown' && room.countdownStartAt) {
      const interval = setInterval(() => {
        const remaining = room.countdownStartAt! - Date.now();
        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(0);
          capturePhoto();
          
          if (role === 'host') {
             const requiredPoses = getFrameCount(room.layout);
             const currentPose = (room.poseIndex || 0) + 1;
             if (currentPose < requiredPoses) {
                 updateDoc(doc(db, 'rooms', roomCode), {
                     poseIndex: currentPose,
                     countdownStartAt: Date.now() + 3500,
                 });
             } else {
                 setTimeout(() => {
                     updateDoc(doc(db, 'rooms', roomCode), {
                         status: 'captured'
                     });
                 }, 500);
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
    if (room?.status === 'captured') {
        const timer = setTimeout(() => {
            compositePhotos();
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [room?.status, photos.host, photos.guest, room?.host?.filter, room?.guest?.filter, room?.overlayBackground, room?.footerName, room?.footerDate, room?.showFooterDate, compositePhotos]);

  const toggleReady = () => {
    if (!room) return;
    const currentReady = room[role]?.ready;
    updateDoc(doc(db, 'rooms', roomCode), {
      [`${role}.ready`]: !currentReady
    });
  };

  const changeFilter = (filterId: string) => {
    setRoom((prev) => (prev ? { ...prev, [role]: { ...prev[role], filter: filterId } } : prev));
    updateDoc(doc(db, 'rooms', roomCode), {
      [`${role}.filter`]: filterId
    });
  };

  const changeOverlayBackground = (color: string) => {
    if (role === 'host') {
      setRoom((prev) => (prev ? { ...prev, overlayBackground: color } : prev));
      updateDoc(doc(db, 'rooms', roomCode), { overlayBackground: color });
    }
  };

  const updateFooter = (patch: { footerName?: string; footerDate?: string; showFooterDate?: boolean }) => {
    setRoom((prev) => (prev ? { ...prev, ...patch } : prev));
    updateDoc(doc(db, 'rooms', roomCode), patch);
  };

  const resetSession = () => {
    imageCacheRef.current.clear();
    setDoc(doc(db, 'room_photos', `${roomCode}__host`), { urls: [] });
    setDoc(doc(db, 'room_photos', `${roomCode}__guest`), { urls: [] });
    updateDoc(doc(db, 'rooms', roomCode), {
        status: 'both_connected',
        'host.ready': false,
        'guest.ready': false,
        'host.photoReady': false,
        'guest.photoReady': false,
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
    typingActiveRef.current = false;
    
    const newMessage = {
      text: chatInput.trim(),
      senderId: userUid,
      senderName: userName,
      role: role,
      timestamp: Date.now()
    };
    
    updateDoc(doc(db, 'rooms', roomCode), {
      messages: arrayUnion(newMessage),
      [`${role}.isTyping`]: false
    });
    setChatInput('');
  };

  const handleSavePartnerAsFriend = () => {
    const partnerData = room?.[otherRole];
    if (partnerData?.uid) {
      onAddFriend({
        uid: partnerData.uid,
        name: partnerData.name || (otherRole === 'host' ? 'Host' : 'Guest')
      });
      setPartnerAdded(true);
      setTimeout(() => setPartnerAdded(false), 2000);
    }
  };

  const downloadPhoto = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `fotoyuk-${roomCode}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setSupportVisible(true);
  };

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-sm">
        Menghubungkan ke room...
      </div>
    );
  }

  const isCaptured = room.status === 'captured';
  const myData = room[role];
  const otherData = room[otherRole];
  const partnerName = otherData?.name || (otherRole === 'host' ? 'Host' : 'Guest');
  const isPartnerAlreadyFriend = otherData?.uid && friends.some(f => f.uid === otherData.uid);
  
  let statusText = 'Menunggu peserta terhubung...';
  if (cameraError) {
    statusText = 'Kamera tidak tersedia. Izinkan akses kamera untuk melanjutkan.';
  } else if (!cameraReady) {
    statusText = 'Menyiapkan kamera...';
  } else if (room.status === 'both_connected' || room.status === 'ready') {
    if (!otherData?.connected) {
      statusText = `${partnerName} terputus.`;
    } else if (myData?.ready && !otherData?.ready) {
      statusText = `Menunggu ${partnerName} siap...`;
    } else if (!myData?.ready && otherData?.ready) {
      statusText = `${partnerName} sudah siap.`;
    } else {
      statusText = 'Kedua peserta siap.';
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col justify-between">
      
      {/* Top Header Bar */}
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border border-zinc-200">
            <span>{roomCode}</span>
            <button
              onClick={() => navigator.clipboard.writeText(roomCode)}
              className="text-zinc-400 hover:text-black"
              title="Salin Kode"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          <span className="text-xs font-semibold text-zinc-600">
            {role}: {userName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {otherData?.connected && otherData?.uid && !isPartnerAlreadyFriend && (
            <button
              onClick={handleSavePartnerAsFriend}
              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1"
            >
              {partnerAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <UserPlus className="w-3 h-3" />}
              <span>{partnerAdded ? 'Berteman' : 'Tambah Teman'}</span>
            </button>
          )}

          <button 
            onClick={onLeave} 
            className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        
        {isCaptured ? (
          /* RESULT VIEW */
          <div className="w-full max-w-sm flex flex-col items-center space-y-4">
            
            {/* Canvas Output */}
            <div className="w-full aspect-[5/7] bg-white rounded-[20px] p-2.5 ring-1 ring-zinc-200 shadow-[0_24px_48px_-32px_rgba(9,9,11,0.55)]">
              <canvas ref={canvasRef} className="w-full h-full object-contain rounded-xl" />
            </div>

            {/* Filter Pills */}
            <div className="w-full space-y-1.5">
              <span className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Filter kamu</span>
              <div className="w-full flex overflow-x-auto bg-white p-1.5 rounded-2xl border border-zinc-200 gap-1.5">
                {filterOptions.map(f => (
                  <button
                    key={f.id}
                    onClick={() => changeFilter(f.id)}
                    aria-pressed={(myData?.filter || 'normal') === f.id}
                    className={`px-3.5 h-8 text-xs font-semibold rounded-xl shrink-0 transition-colors duration-200 cursor-pointer ${
                      (myData?.filter || 'normal') === f.id 
                        ? 'bg-zinc-900 text-white' 
                        : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Background / Custom Overlays (Host Only) */}
            {role === 'host' && (
              <div className="w-full space-y-1.5">
                <span className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Tema frame · host</span>
                <div className="w-full flex overflow-x-auto bg-white p-2 rounded-2xl border border-zinc-200 gap-2 items-center">
                  {[
                    { id: 'white', hex: '#ffffff', icon: undefined, label: undefined, baseColor: '#ffffff' },
                    { id: 'black', hex: '#000000', icon: undefined, label: undefined, baseColor: '#000000' },
                    { id: 'zinc', hex: '#f4f4f5', icon: undefined, label: undefined, baseColor: '#f4f4f5' },
                    { id: 'pink', hex: '#fbcfe8', icon: undefined, label: undefined, baseColor: '#fbcfe8' },
                    { id: 'blue', hex: '#bfdbfe', icon: undefined, label: undefined, baseColor: '#bfdbfe' },
                    ...customOverlays
                      .filter(o => !o.layout || o.layout === room.layout)
                      .map(o => ({
                        id: o.id,
                        hex: o.hex,
                        icon: o.icon,
                        label: o.label || o.name?.slice(0, 4),
                        baseColor: o.baseColor
                      }))
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => changeOverlayBackground(bg.hex)}
                      aria-pressed={(room.overlayBackground || '#ffffff') === bg.hex}
                      title={bg.label || bg.hex}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 cursor-pointer ${
                        (room.overlayBackground || '#ffffff') === bg.hex 
                          ? 'border-zinc-900 ring-2 ring-zinc-900/70' 
                          : 'border-zinc-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: bg.hex.startsWith('#') ? bg.hex : (bg.baseColor || '#ffffff') }}
                    >
                      {bg.icon ? (
                        <img src={bg.icon} alt="" className="w-5 h-5 object-contain" />
                      ) : bg.label ? (
                        <span
                          className="text-[8px] font-bold uppercase tracking-wide leading-none"
                          style={{ color: swatchTextColor(bg.baseColor || bg.hex) }}
                        >
                          {bg.label.slice(0, 4)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer text & date (Host Only) */}
            {role === 'host' && (
              <div className="w-full rounded-2xl border border-zinc-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Teks & tanggal</span>
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={room.showFooterDate !== false}
                      onChange={(e) => updateFooter({ showFooterDate: e.target.checked })}
                      className="w-3.5 h-3.5 accent-zinc-900 cursor-pointer"
                    />
                    Tanggal
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    defaultValue={room.footerName || ''}
                    placeholder="Nama di foto"
                    maxLength={28}
                    aria-label="Nama pada foto"
                    onBlur={(e) => updateFooter({ footerName: e.target.value.trim() })}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="h-9 px-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-semibold focus:outline-none focus:border-zinc-900 focus:bg-white"
                  />
                  <input
                    type="date"
                    value={room.footerDate || ''}
                    disabled={room.showFooterDate === false}
                    aria-label="Tanggal pada foto"
                    onChange={(e) => updateFooter({ footerDate: e.target.value })}
                    className="h-9 px-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-semibold focus:outline-none focus:border-zinc-900 focus:bg-white disabled:opacity-40"
                  />
                </div>
              </div>
            )}

            {/* Download and Retake */}
            <div className="flex gap-2 w-full">
              <button 
                onClick={downloadPhoto}
                className="flex-1 h-12 bg-zinc-900 hover:bg-black text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Simpan Foto</span>
              </button>

              <button 
                onClick={resetSession}
                className="px-4 h-12 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Ulang</span>
              </button>
            </div>

            {supportVisible && <SupportCard />}
          </div>
        ) : (
          /* CAMERA VIEW */
          <div className="w-full max-w-sm flex flex-col items-center space-y-4">
            <div 
              className="relative w-full rounded-2xl overflow-hidden bg-black border border-zinc-300"
              style={{
                aspectRatio: room?.layout === '4-frames' ? '276 / 156' : room?.layout === '3-frames' ? '276 / 216' : '276 / 336'
              }}
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
                  mirrored={true}
                  forceScreenshotSourceSize={true}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.8}
                  videoConstraints={{ facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={(err) => { setCameraReady(false); setCameraError(typeof err === 'string' ? err : err.message || 'Error kamera'); }}
                  className="w-full h-full object-cover" 
                  style={{ filter: getFilterCSS(myData?.filter || 'normal') }}
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

              {/* Countdown Numbers */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-7xl font-bold font-mono text-white">{countdown}</span>
                </div>
              )}

              {/* Flash Frame */}
              {countdown === 0 && (
                <div className="absolute inset-0 bg-white" />
              )}

              {/* Pose Indicator */}
              {countdown !== null && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <span className="bg-black/70 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md">
                    Pose {(room.poseIndex || 0) + 1} / {getFrameCount(room?.layout)}
                  </span>
                </div>
              )}
            </div>

            {/* Status & Ready Button */}
            {countdown === null && (
              <div className="w-full space-y-2 text-center">
                <p className="text-xs font-medium text-zinc-500">{statusText}</p>
                
                <button
                  onClick={toggleReady}
                  disabled={!otherData?.connected || Boolean(cameraError) || !cameraReady}
                  className={`w-full h-12 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer ${
                    !otherData?.connected || cameraError || !cameraReady
                      ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                      : myData?.ready
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-black hover:bg-zinc-800 text-white'
                  }`}
                >
                  {myData?.ready ? <Check className="w-4 h-4" /> : null}
                  <span>{myData?.ready ? 'Kamu Sudah Siap' : 'Saya Siap Foto'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Chat Drawer / Widget */}
      <div className="fixed bottom-4 right-4 z-40">
        {isChatOpen ? (
          <div className="w-72 h-80 bg-white rounded-xl border border-zinc-300 shadow-md flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <span className="text-xs font-bold text-zinc-800">Obrolan</span>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-zinc-400 hover:text-black p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(!room.messages || room.messages.length === 0) && (
                <div className="text-center py-8 text-xs text-zinc-400">
                  Belum ada pesan.
                </div>
              )}

              {room.messages?.map((msg, i) => {
                const isMe = msg.senderId === userUid;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-medium max-w-[85%] ${
                      isMe ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-800'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-zinc-400 mt-0.5 capitalize">
                      {msg.senderName || msg.role}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-2 border-t border-zinc-200 flex gap-1.5 bg-white">
              <input
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder="Ketik pesan..."
                className="flex-1 bg-zinc-50 rounded-lg px-2.5 py-1.5 text-xs border border-zinc-200 focus:outline-none focus:border-black"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="p-2 bg-black text-white rounded-lg disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={handleOpenChat}
            className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-md relative"
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

    </div>
  );
}
