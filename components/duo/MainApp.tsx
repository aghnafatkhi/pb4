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
import { generateRoomCode } from '@/lib/utils';
import { PRESET_OVERLAYS } from '@/lib/templates';
import SoloStudio from '@/components/SoloStudio';
import SupportCard from '@/components/SupportCard';
import PhotoboothRoom from './PhotoboothRoom';
import { FriendItem, IncomingInvite } from './types';
import { getLocalUid, getLocalName, timestampToMillis, playNotificationSound, ROOM_TTL_MS } from './shared';
import {
  ArrowLeft,
  Camera,
  Check,
  RefreshCcw,
  UserPlus,
  Users,
  Download,
  MessageSquare,
  Send,
  X,
  Copy,
  Trash2,
  Edit3
} from 'lucide-react';

export default function MainApp({ user }: { user: {uid: string} }) {
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<'2-frames' | '3-frames' | '4-frames'>('3-frames');
  const [boothMode, setBoothMode] = useState<'solo' | 'duo'>('duo');
  const [soloActive, setSoloActive] = useState(false);

  // Solo only prints 2R (2 poses) or 4R (4 poses in a 2×2 grid).
  const switchMode = (next: 'solo' | 'duo') => {
    setBoothMode(next);
    if (next === 'solo' && selectedLayout === '3-frames') {
      setSelectedLayout('2-frames');
    }
  };

  // User Profile & Friend System States
  const [userName, setUserName] = useState<string>(() => getLocalName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>(() => getLocalName());
  const [friends, setFriends] = useState<FriendItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(`pb_friends_${user.uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [friendsData, setFriendsData] = useState<Record<string, FriendItem>>({});
  const lastFriendsJsonRef = useRef<string>('');
  const lastInviteSoundRef = useRef<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pasteLinkInput, setPasteLinkInput] = useState('');
  const [linkAddError, setLinkAddError] = useState('');
  const [linkAddSuccess, setLinkAddSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'booth' | 'friends'>('booth');
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [pendingFriendModal, setPendingFriendModal] = useState<{ uid: string; name: string } | null>(null);
  const [sendingInviteTo, setSendingInviteTo] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState<number>(0);

  // Time updater for presence
  useEffect(() => {
    const timer = setTimeout(() => {
      setNowTime(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 8000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Sync user presence to Firestore
  useEffect(() => {
    const name = getLocalName();
    const userDocRef = doc(db, 'users', user.uid);
    setDoc(userDocRef, {
      uid: user.uid,
      name: name,
      lastSeen: Date.now(),
      status: 'online',
      currentRoomCode: null
    }, { merge: true });

    const heartbeat = setInterval(() => {
      updateDoc(userDocRef, {
        lastSeen: Date.now(),
        status: 'online'
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(heartbeat);
  }, [user.uid]);

  // Check URL query params for ?add=@nickname&u=uid
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const addParam = params.get('add');
      const uidParam = params.get('u');

      if (addParam && uidParam && uidParam !== user.uid) {
        let cleanName = decodeURIComponent(addParam).trim();
        if (!cleanName.startsWith('@')) cleanName = '@' + cleanName;
        
        setTimeout(() => {
          setPendingFriendModal({
            uid: uidParam,
            name: cleanName
          });
        }, 100);
      }
    } catch {
      // Ignored
    }
  }, [user.uid]);

  // Read ?mode=solo|duo from the landing page CTAs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mode = new URLSearchParams(window.location.search).get('mode');
    setTimeout(() => {
      if (mode === 'solo') {
        setBoothMode('solo');
        setSelectedLayout('2-frames');
        setSoloActive(true);
      } else if (mode === 'duo') {
        setBoothMode('duo');
        setActiveTab('booth');
      }
    }, 0);
  }, []);

  // Listen to User Profile changes
  useEffect(() => {
    const userDocRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.friends && Array.isArray(data.friends)) {
          // Presence heartbeats rewrite the user doc every 15s; only update
          // local friend state when the list actually changed.
          const nextJson = JSON.stringify(data.friends);
          if (nextJson !== lastFriendsJsonRef.current) {
            lastFriendsJsonRef.current = nextJson;
            setFriends(data.friends);
            localStorage.setItem(`pb_friends_${user.uid}`, nextJson);
          }
        }
      }
    });
    return unsub;
  }, [user.uid]);

  // Real-time listener for friends' live status
  useEffect(() => {
    if (friends.length === 0) return;
    const unsubs: (() => void)[] = [];

    friends.forEach((friend) => {
      const fRef = doc(db, 'users', friend.uid);
      const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as FriendItem;
          setFriendsData((prev) => ({
            ...prev,
            [friend.uid]: {
              ...friend,
              name: data.name || friend.name,
              status: data.status || 'offline',
              lastSeen: data.lastSeen,
              currentRoomCode: data.currentRoomCode || null
            }
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [friends]);

  // Real-time listener for incoming invites
  useEffect(() => {
    if (roomCode) return;

    const q = query(
      collection(db, 'invites'), 
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const pending: IncomingInvite[] = [];
      snap.forEach((d) => {
        const invite = { id: d.id, ...d.data() } as IncomingInvite;
        const createdAt = timestampToMillis(invite.createdAt);
        // Rooms live for 15 minutes, so ignore invites that can no longer be joined.
        if (createdAt && now - createdAt > ROOM_TTL_MS) return;
        pending.push(invite);
      });

      if (pending.length > 0) {
        pending.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
        const latest = pending[0];
        setIncomingInvite(latest);
        if (latest.id !== lastInviteSoundRef.current) {
          lastInviteSoundRef.current = latest.id;
          playNotificationSound();
        }
      } else {
        setIncomingInvite(null);
      }
    });

    return unsub;
  }, [user.uid, roomCode]);

  const saveUserName = async () => {
    if (!tempName.trim()) return;
    let newName = tempName.trim();
    if (!newName.startsWith('@')) {
      newName = '@' + newName.replace(/^@+/, '');
    }
    setUserName(newName);
    localStorage.setItem('pb_name', newName);
    setIsEditingName(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: newName
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getMyFriendLink = () => {
    if (typeof window === 'undefined') return '';
    const cleanNick = userName.startsWith('@') ? userName.substring(1) : userName;
    return `${window.location.origin}/studio?add=${encodeURIComponent(cleanNick)}&u=${user.uid}`;
  };

  const copyMyFriendLink = () => {
    const link = getMyFriendLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const confirmAddFriendFromModal = async () => {
    if (!pendingFriendModal) return;
    const target = pendingFriendModal;

    if (target.uid === user.uid) {
      alert('Ini link profil kamu sendiri.');
      setPendingFriendModal(null);
      return;
    }

    if (friends.some(f => f.uid === target.uid)) {
      alert(`${target.name} sudah ada di daftar teman.`);
      setPendingFriendModal(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      return;
    }

    const newFriendList: FriendItem[] = [
      ...friends,
      {
        uid: target.uid,
        name: target.name
      }
    ];

    setFriends(newFriendList);
    localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(newFriendList));
    await updateDoc(doc(db, 'users', user.uid), {
      friends: newFriendList
    }).catch(() => {});

    setPendingFriendModal(null);
    setActiveTab('friends');
    setLinkAddSuccess(`Berhasil menambahkan ${target.name}!`);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handlePasteFriendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkAddError('');
    setLinkAddSuccess('');

    const input = pasteLinkInput.trim();
    if (!input) return;

    try {
      let url: URL;
      try {
        url = new URL(input);
      } catch {
        setLinkAddError('Format link tidak valid.');
        return;
      }

      const addParam = url.searchParams.get('add');
      const uidParam = url.searchParams.get('u');

      if (!uidParam) {
        setLinkAddError('Link tidak valid.');
        return;
      }

      if (uidParam === user.uid) {
        setLinkAddError('Ini link profil kamu sendiri.');
        return;
      }

      if (friends.some(f => f.uid === uidParam)) {
        setLinkAddError('Sudah ada di daftar teman.');
        return;
      }

      const targetSnap = await getDoc(doc(db, 'users', uidParam));
      let targetName = addParam ? (addParam.startsWith('@') ? addParam : `@${addParam}`) : '@Teman';
      
      if (targetSnap.exists()) {
        const tData = targetSnap.data();
        if (tData.name) targetName = tData.name;
      }

      const newFriendList: FriendItem[] = [
        ...friends,
        {
          uid: uidParam,
          name: targetName
        }
      ];

      setFriends(newFriendList);
      localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(newFriendList));
      await updateDoc(doc(db, 'users', user.uid), {
        friends: newFriendList
      });

      setLinkAddSuccess(`Berhasil menambahkan ${targetName}!`);
      setPasteLinkInput('');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Coba lagi';
      setLinkAddError('Gagal: ' + errorMsg);
    }
  };

  const removeFriend = async (friendUid: string) => {
    const updated = friends.filter(f => f.uid !== friendUid);
    setFriends(updated);
    localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(updated));
    await updateDoc(doc(db, 'users', user.uid), {
      friends: updated
    }).catch(() => {});
  };

  const createRoom = async () => {
    setCreating(true);
    setError('');
    try {
      let code = '';
      let success = false;

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
            hostUid: user.uid,
            guestUid: null,
            host: {
              uid: user.uid,
              name: userName,
              connected: true,
              ready: false,
              photoUrl: null,
              photoReady: false
            },
            guest: {
              uid: null,
              name: null,
              connected: false,
              ready: false,
              photoUrl: null,
              photoReady: false
            }
          });

          updateDoc(doc(db, 'users', user.uid), {
            status: 'in_booth',
            currentRoomCode: code
          }).catch(() => {});

          success = true;
          break;
        }
      }

      if (success) {
        setRole('host');
        setRoomCode(code);
      } else {
        setError('Gagal membuat room. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setError('Gagal membuat room. Periksa koneksi lalu coba lagi.');
    } finally {
      setCreating(false);
    }
  };

  const inviteFriendToPhotobooth = async (friend: FriendItem) => {
    setSendingInviteTo(friend.uid);
    try {
      let code = '';
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
            hostUid: user.uid,
            guestUid: friend.uid,
            host: {
              uid: user.uid,
              name: userName,
              connected: true,
              ready: false,
              photoUrl: null,
              photoReady: false
            },
            guest: {
              uid: friend.uid,
              name: friend.name,
              connected: false,
              ready: false,
              photoUrl: null,
              photoReady: false
            }
          });

          const inviteDocRef = doc(collection(db, 'invites'));
          await setDoc(inviteDocRef, {
            fromUid: user.uid,
            fromName: userName,
            toUid: friend.uid,
            roomCode: code,
            layout: selectedLayout,
            status: 'pending',
            createdAt: serverTimestamp()
          });

          updateDoc(doc(db, 'users', user.uid), {
            status: 'in_booth',
            currentRoomCode: code
          }).catch(() => {});

          setRole('host');
          setRoomCode(code);
          break;
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error';
      alert('Gagal mengirim ajakan: ' + errorMsg);
    } finally {
      setSendingInviteTo(null);
    }
  };

  const joinFriendRoom = async (friendRoomCode: string) => {
    if (!friendRoomCode) return;
    setError('');
    try {
      const ref = doc(db, 'rooms', friendRoomCode);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError('Room sudah tidak ada.');
        return;
      }
      const data = snap.data();
      if (data.status !== 'waiting') {
        setError('Room sedang berjalan.');
        return;
      }
      if (data.host?.uid === user.uid) {
        setError('Itu room kamu sendiri.');
        return;
      }
      if (data.host?.connected === false) {
        setError('Host sudah keluar dari room.');
        return;
      }
      if (data.guest?.uid && data.guest.uid !== user.uid) {
        setError('Room sudah diisi peserta lain.');
        return;
      }

      await updateDoc(ref, {
        'guest.uid': user.uid,
        'guest.name': userName,
        'guest.connected': true,
        guestUid: user.uid,
        status: 'both_connected'
      });

      updateDoc(doc(db, 'users', user.uid), {
        status: 'in_booth',
        currentRoomCode: friendRoomCode
      }).catch(() => {});

      setRole('guest');
      setRoomCode(friendRoomCode);
    } catch (err) {
      console.error(err);
      setError('Gagal masuk room. Periksa koneksi lalu coba lagi.');
    }
  };

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    try {
      const roomRef = doc(db, 'rooms', incomingInvite.roomCode);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        alert('Sesi photobooth sudah berakhir.');
        setIncomingInvite(null);
        return;
      }

      const data = snap.data();
      const unavailable =
        data.status !== 'waiting' ||
        data.host?.uid === user.uid ||
        data.host?.connected === false ||
        (data.guest?.uid && data.guest.uid !== user.uid);

      if (unavailable) {
        await updateDoc(doc(db, 'invites', incomingInvite.id), { status: 'declined' }).catch(() => {});
        alert('Room ini sudah tidak tersedia.');
        setIncomingInvite(null);
        return;
      }

      await updateDoc(doc(db, 'invites', incomingInvite.id), { status: 'accepted' });

      await updateDoc(roomRef, {
        'guest.uid': user.uid,
        'guest.name': userName,
        'guest.connected': true,
        guestUid: user.uid,
        status: 'both_connected'
      });

      updateDoc(doc(db, 'users', user.uid), {
        status: 'in_booth',
        currentRoomCode: incomingInvite.roomCode
      }).catch(() => {});

      setRole('guest');
      setRoomCode(incomingInvite.roomCode);
      setIncomingInvite(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error';
      alert('Gagal menerima undangan: ' + errorMsg);
    }
  };

  const declineInvite = async () => {
    if (!incomingInvite) return;
    try {
      await updateDoc(doc(db, 'invites', incomingInvite.id), { status: 'declined' });
      setIncomingInvite(null);
    } catch {
      setIncomingInvite(null);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) return;

    try {
      const ref = doc(db, 'rooms', code);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError('Kode room tidak ditemukan.');
        return;
      }

      const data = snap.data();
      if (data.status !== 'waiting') {
        setError('Room sudah penuh atau sedang aktif.');
        return;
      }
      if (data.host?.uid === user.uid) {
        setError('Itu kode room kamu sendiri.');
        return;
      }
      if (data.host?.connected === false) {
        setError('Host sudah keluar dari room.');
        return;
      }
      if (data.guest?.uid && data.guest.uid !== user.uid) {
        setError('Room sudah diisi peserta lain.');
        return;
      }

      await updateDoc(ref, {
        'guest.uid': user.uid,
        'guest.name': userName,
        'guest.connected': true,
        guestUid: user.uid,
        status: 'both_connected'
      });

      updateDoc(doc(db, 'users', user.uid), {
        status: 'in_booth',
        currentRoomCode: code
      }).catch(() => {});

      setRole('guest');
      setRoomCode(code);
    } catch (err) {
      console.error(err);
      setError('Gagal bergabung. Periksa koneksi lalu coba lagi.');
    }
  };

  if (soloActive) {
    return (
      <SoloStudio
        layout={selectedLayout}
        userName={userName}
        onExit={() => {
          setSoloActive(false);
          if (typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
      />
    );
  }

  if (roomCode && role) {
    return (
      <PhotoboothRoom 
        roomCode={roomCode} 
        role={role} 
        userName={userName}
        userUid={user.uid}
        friends={friends}
        onAddFriend={(f) => {
          if (!friends.some(item => item.uid === f.uid)) {
            const updated = [...friends, f];
            setFriends(updated);
            localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(updated));
            updateDoc(doc(db, 'users', user.uid), { friends: updated }).catch(() => {});
          }
        }}
        onLeave={() => { 
          setRoomCode(''); 
          setRole(null); 
          updateDoc(doc(db, 'users', user.uid), {
            status: 'online',
            currentRoomCode: null
          }).catch(() => {});
        }} 
      />
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ background: 'radial-gradient(1200px 600px at 50% -20%, #ffffff 0%, #f4f4f5 55%, #ededef 100%)' }}
    >
      
      {/* Modal Tambah Teman */}
      {pendingFriendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Tambah Teman</h3>
            <p className="text-xs text-zinc-600 mb-5">
              Tambahkan <span className="font-bold text-zinc-900">{pendingFriendModal.name}</span> ke daftar teman?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPendingFriendModal(null);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                }}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
              >
                Batal
              </button>
              <button
                onClick={confirmAddFriendFromModal}
                className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undangan Masuk Photobooth */}
      {incomingInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera className="w-5 h-5 text-zinc-900" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">Ajakan Foto</h3>
            <p className="text-xs text-zinc-600 mb-2">
              <span className="font-bold text-zinc-900">{incomingInvite.fromName}</span> mengajak kamu foto bareng.
            </p>
            <div className="text-xs font-mono text-zinc-500 mb-5 bg-zinc-100 py-1.5 rounded-md">
              Room {incomingInvite.roomCode}
            </div>
            <div className="flex gap-2">
              <button
                onClick={declineInvite}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
              >
                Tolak
              </button>
              <button
                onClick={acceptInvite}
                className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
              >
                Terima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="relative w-full max-w-md">
        <div className="rounded-[28px] bg-white border border-zinc-200/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_28px_60px_-30px_rgba(9,9,11,0.45)] p-5 sm:p-6">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 pb-5 border-b border-zinc-100">
          <div className="min-w-0">
            <h1 className="text-[19px] font-bold text-zinc-900 tracking-tight leading-none">Fotoyuk</h1>
            <p className="text-[11px] text-zinc-500 mt-1.5">Photobooth online — solo atau berdua.</p>
            <div className="flex items-center gap-1.5 mt-2.5">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-zinc-300 focus:outline-none focus:border-zinc-900 w-28"
                    maxLength={20}
                    autoFocus
                  />
                  <button onClick={saveUserName} className="p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-black" aria-label="Simpan nama">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200" aria-label="Batal ganti nama">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-2.5 pr-1">
                  <span className="text-[11px] font-semibold text-zinc-700">{userName}</span>
                  <button 
                    onClick={() => {
                      setTempName(userName);
                      setIsEditingName(true);
                    }} 
                    className="text-zinc-400 hover:text-zinc-900 p-1 rounded-full hover:bg-white"
                    title="Ganti nama"
                    aria-label="Ganti nama"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <span className="w-10 h-10 shrink-0 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
            <Camera className="w-4.5 h-4.5" />
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-100 p-1 rounded-2xl my-4">
          <button
            onClick={() => setActiveTab('booth')}
            className={`flex-1 h-9 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
              activeTab === 'booth'
                ? 'bg-white text-zinc-900 font-bold shadow-[0_1px_2px_rgba(9,9,11,0.08)]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Sesi Foto</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 h-9 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-white text-zinc-900 font-bold shadow-[0_1px_2px_rgba(9,9,11,0.08)]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Teman ({friends.length})</span>
          </button>
        </div>

        {/* TAB 1: Sesi Foto */}
        {activeTab === 'booth' && (
          <div className="space-y-4">
            
            {/* Mode Picker: Solo / Berdua */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-2 tracking-[0.14em]">
                Mode Foto
              </label>
              <div className="flex bg-zinc-100 p-1 rounded-2xl" role="tablist" aria-label="Mode foto">
                <button
                  type="button"
                  role="tab"
                  aria-selected={boothMode === 'solo'}
                  onClick={() => switchMode('solo')}
                  className={`flex-1 h-9 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
                    boothMode === 'solo'
                      ? 'bg-white text-zinc-900 font-bold shadow-[0_1px_2px_rgba(9,9,11,0.08)]'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Solo</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={boothMode === 'duo'}
                  onClick={() => switchMode('duo')}
                  className={`flex-1 h-9 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
                    boothMode === 'duo'
                      ? 'bg-white text-zinc-900 font-bold shadow-[0_1px_2px_rgba(9,9,11,0.08)]'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Berdua</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                {boothMode === 'solo'
                  ? 'Sendiri, hasilnya kertas 2R atau 4R. Tanpa koneksi ke peserta lain.'
                  : 'Foto bareng lewat kode room. Hasil sinkron di dua layar.'}
              </p>
            </div>

            {/* Layout Frame Picker */}
            {boothMode === 'solo' ? (
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-2 tracking-[0.14em]">
                  Ukuran Kertas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '2-frames', label: '2R', note: '2 pose · 2,5 × 3,5 in' },
                    { id: '4-frames', label: '4R', note: '4 foto · grid 2×2' },
                  ].map((item) => {
                    const active = selectedLayout === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedLayout(item.id as '2-frames' | '4-frames')}
                        aria-pressed={active}
                        className={`rounded-xl border px-3 pt-2.5 pb-2.5 text-left transition-all duration-200 cursor-pointer ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'
                        }`}
                      >
                        <div className="h-12 flex items-center justify-center" aria-hidden="true">
                          {item.id === '2-frames' ? (
                            <div className="w-full flex flex-col gap-1.5 px-1">
                              <span className={`h-3 rounded-[3px] ${active ? 'bg-white/85' : 'bg-zinc-300'}`} />
                              <span className={`h-3 rounded-[3px] ${active ? 'bg-white/55' : 'bg-zinc-200'}`} />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              {[0, 1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className={`block h-4 w-7 rounded-[3px] ${active ? (i % 2 === 0 ? 'bg-white/85' : 'bg-white/55') : i % 2 === 0 ? 'bg-zinc-300' : 'bg-zinc-200'}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="flex items-baseline justify-between gap-2 mt-2">
                          <span className="text-[13px] font-bold">{item.label}</span>
                          <span className={`text-[9px] font-medium ${active ? 'text-white/60' : 'text-zinc-400'}`}>
                            {item.note}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Foto kamera 4:3 dimuat utuh, jadi wajah tidak terpotong.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-2 tracking-[0.14em]">
                  Format Frame
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '2-frames', label: '2 Pose', poses: 2 },
                    { id: '3-frames', label: '3 Pose', poses: 3 },
                    { id: '4-frames', label: '4 Pose', poses: 4 },
                  ].map((item) => {
                    const active = selectedLayout === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedLayout(item.id as '2-frames' | '3-frames' | '4-frames')}
                        aria-pressed={active}
                        className={`group rounded-xl border px-2 pt-2 pb-2 transition-all duration-200 cursor-pointer ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'
                        }`}
                      >
                        <div className="h-12 flex flex-col justify-center gap-1 px-0.5" aria-hidden="true">
                          {Array.from({ length: item.poses }).map((_, i) => (
                            <div key={i} className="flex gap-1">
                              <span className={`h-1.5 flex-1 rounded-[2px] ${active ? 'bg-white/85' : 'bg-zinc-300'}`} />
                              <span className={`h-1.5 flex-1 rounded-[2px] ${active ? 'bg-white/45' : 'bg-zinc-200'}`} />
                            </div>
                          ))}
                        </div>
                        <span className="block text-[11px] font-bold mt-1.5">{item.label}</span>
                        <span className={`block text-[9px] font-medium ${active ? 'text-white/60' : 'text-zinc-400'}`}>
                          {item.poses * 2} foto
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Action */}
            {boothMode === 'solo' ? (
              <button
                onClick={() => setSoloActive(true)}
                className="w-full h-12 bg-zinc-900 hover:bg-black text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 transition-colors duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_20px_-12px_rgba(9,9,11,0.7)] cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Mulai Foto Solo</span>
              </button>
            ) : (
              <button
                onClick={createRoom}
                disabled={creating}
                className="w-full h-12 bg-zinc-900 hover:bg-black text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_20px_-12px_rgba(9,9,11,0.7)] cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{creating ? 'Membuat Sesi...' : 'Mulai Sesi Baru'}</span>
              </button>
            )}

            {boothMode === 'duo' && (
              <>
                {/* Divider */}
                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-zinc-200"></div>
                  <span className="flex-shrink-0 mx-3 text-zinc-400 text-[10px] uppercase font-bold tracking-[0.14em]">
                    atau gabung kode
                  </span>
                  <div className="flex-grow border-t border-zinc-200"></div>
                </div>

                {/* Input Gabung Kode */}
                <form onSubmit={joinRoom} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                      placeholder="KODE"
                      maxLength={6}
                      inputMode="text"
                      aria-label="Kode room"
                      className="flex-1 h-12 px-3 rounded-2xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-zinc-900 focus:bg-white text-center text-base font-mono font-semibold tracking-[0.4em] uppercase placeholder:tracking-[0.2em] placeholder:text-zinc-400"
                    />
                    <button
                      type="submit"
                      disabled={joinInput.length < 4}
                      className="px-6 h-12 bg-white border border-zinc-300 hover:border-zinc-900 hover:text-zinc-900 text-zinc-700 rounded-2xl text-xs font-bold disabled:opacity-40 transition-colors duration-200 cursor-pointer"
                    >
                      Gabung
                    </button>
                  </div>
                  {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}
                </form>

                {/* Quick Friend Invites if any */}
                {friends.length > 0 && (
                  <div className="pt-3 border-t border-zinc-100">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.14em] mb-2">
                      Ajak Cepat
                    </span>
                    <div className="space-y-1.5">
                      {friends.slice(0, 3).map((f) => {
                        const dynamicData = friendsData[f.uid] || f;
                        const isOnline = Boolean(dynamicData.lastSeen && nowTime && (nowTime - dynamicData.lastSeen < 45000));
                        const isInBooth = Boolean(dynamicData.status === 'in_booth' && dynamicData.currentRoomCode);
                        const displayName = dynamicData.name || f.name;

                        return (
                          <div key={f.uid} className="flex items-center justify-between gap-2 p-2 pl-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isInBooth ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-300'
                              }`} />
                              <span className="text-xs font-bold text-zinc-800 truncate">{displayName}</span>
                              <span className="text-[10px] text-zinc-400 shrink-0">
                                {isInBooth ? 'Di booth' : isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>

                            {isInBooth ? (
                              <button
                                onClick={() => joinFriendRoom(dynamicData.currentRoomCode!)}
                                className="px-3 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                              >
                                Masuk
                              </button>
                            ) : (
                              <button
                                onClick={() => inviteFriendToPhotobooth(f)}
                                disabled={sendingInviteTo === f.uid}
                                className="px-3 h-7 bg-zinc-900 hover:bg-black text-white rounded-lg text-[10px] font-bold disabled:opacity-50 shrink-0 cursor-pointer"
                              >
                                {sendingInviteTo === f.uid ? '...' : 'Ajak'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: Daftar Teman */}
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {/* Salin Link Profil */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-xs font-bold text-zinc-800 mb-1">Link Profil</span>
              <p className="text-[11px] text-zinc-500 mb-2.5">
                Kirim link ke teman agar mereka bisa langsung terhubung.
              </p>
              <button
                type="button"
                onClick={copyMyFriendLink}
                className="w-full py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin' : 'Salin Link Profil'}</span>
              </button>
            </div>

            {/* Tempel Link Teman */}
            <form onSubmit={handlePasteFriendLink} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={pasteLinkInput}
                  onChange={(e) => setPasteLinkInput(e.target.value)}
                  placeholder="Tempel link teman di sini..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-zinc-50 border border-zinc-200 focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  disabled={!pasteLinkInput.trim()}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  Tambah
                </button>
              </div>
              {linkAddError && <p className="text-red-600 text-xs font-medium">{linkAddError}</p>}
              {linkAddSuccess && <p className="text-emerald-600 text-xs font-medium">{linkAddSuccess}</p>}
            </form>

            {/* List Teman */}
            <div className="space-y-2 pt-2">
              <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Daftar Teman ({friends.length})
              </span>

              {friends.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  Belum ada teman terhubung.
                </div>
              ) : (
                friends.map((friend) => {
                  const dynamic = friendsData[friend.uid] || friend;
                  const isOnline = Boolean(dynamic.lastSeen && nowTime && (nowTime - dynamic.lastSeen < 45000));
                  const isInBooth = Boolean(dynamic.status === 'in_booth' && dynamic.currentRoomCode);

                  return (
                    <div 
                      key={friend.uid} 
                      className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isInBooth ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-zinc-900">{dynamic.name || friend.name}</div>
                          <div className="text-[10px] text-zinc-400">
                            {isInBooth ? 'Di photobooth' : isOnline ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isInBooth ? (
                          <button
                            onClick={() => joinFriendRoom(dynamic.currentRoomCode!)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                          >
                            Masuk
                          </button>
                        ) : (
                          <button
                            onClick={() => inviteFriendToPhotobooth(friend)}
                            disabled={sendingInviteTo === friend.uid}
                            className="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white rounded text-[11px] font-bold disabled:opacity-50"
                          >
                            {sendingInviteTo === friend.uid ? '...' : 'Ajak'}
                          </button>
                        )}

                        <button
                          onClick={() => removeFriend(friend.uid)}
                          className="p-1 text-zinc-400 hover:text-red-600 rounded"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-400">
          Solo jadi kertas 2R atau 4R. Berdua pakai kode room.
        </p>
      </div>
    </div>
  );
}
