'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { generateRoomCode } from '@/lib/utils';
import Webcam from 'react-webcam';

import { 
  Camera, 
  RefreshCcw, 
  Check, 
  UserPlus, 
  Users, 
  Download, 
  MessageSquare, 
  Send, 
  X, 
  Copy, 
  Sparkles, 
  Trash2, 
  Edit3, 
  ArrowRight
} from 'lucide-react';

function getLocalUid() {
  if (typeof window === 'undefined') return 'temp-uid';
  let uid = localStorage.getItem('pb_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pb_uid', uid);
  }
  return uid;
}

function getLocalName() {
  if (typeof window === 'undefined') return '@aghna';
  let name = localStorage.getItem('pb_name');
  if (!name) {
    name = '@aghna';
    localStorage.setItem('pb_name', name);
  } else if (!name.startsWith('@')) {
    name = '@' + name.replace(/^@+/, '').trim();
    localStorage.setItem('pb_name', name);
  }
  return name;
}

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // AudioContext blocked
  }
}

interface FriendItem {
  uid: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'in_booth';
  lastSeen?: number;
  currentRoomCode?: string | null;
}

interface IncomingInvite {
  id: string;
  fromUid: string;
  fromName: string;
  roomCode: string;
  layout: string;
  status: string;
  createdAt?: unknown;
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-sm">
        Memuat...
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
  const [selectedLayout, setSelectedLayout] = useState<'2-frames' | '3-frames' | '4-frames'>('3-frames');

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

  // Listen to User Profile changes
  useEffect(() => {
    const userDocRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.friends && Array.isArray(data.friends)) {
          setFriends(data.friends);
          localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(data.friends));
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
      const pending: IncomingInvite[] = [];
      snap.forEach((d) => {
        pending.push({ id: d.id, ...d.data() } as IncomingInvite);
      });

      if (pending.length > 0) {
        const latest = pending[pending.length - 1];
        setIncomingInvite(latest);
        playNotificationSound();
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
    return `${window.location.origin}/?add=${encodeURIComponent(cleanNick)}&u=${user.uid}`;
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
    
    setCreating(false);
    if (success) {
      setRole('host');
      setRoomCode(code);
    } else {
      setError('Gagal membuat room. Silakan coba lagi.');
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

    await updateDoc(ref, {
      'guest.uid': user.uid,
      'guest.name': userName,
      'guest.connected': true,
      status: 'both_connected'
    });

    updateDoc(doc(db, 'users', user.uid), {
      status: 'in_booth',
      currentRoomCode: friendRoomCode
    }).catch(() => {});

    setRole('guest');
    setRoomCode(friendRoomCode);
  };

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    try {
      const inviteRef = doc(db, 'invites', incomingInvite.id);
      await updateDoc(inviteRef, { status: 'accepted' });

      const roomRef = doc(db, 'rooms', incomingInvite.roomCode);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        alert('Sesi photobooth sudah berakhir.');
        setIncomingInvite(null);
        return;
      }

      await updateDoc(roomRef, {
        'guest.uid': user.uid,
        'guest.name': userName,
        'guest.connected': true,
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
    
    await updateDoc(ref, {
      'guest.uid': user.uid,
      'guest.name': userName,
      'guest.connected': true,
      status: 'both_connected'
    });

    updateDoc(doc(db, 'users', user.uid), {
      status: 'in_booth',
      currentRoomCode: code
    }).catch(() => {});
    
    setRole('guest');
    setRoomCode(code);
  };

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
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
      
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
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-xs">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-5 border-b border-zinc-100">
          <div>
            <h1 className="text-base font-bold text-zinc-900 tracking-tight">Photobooth Abuy</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="px-2 py-0.5 text-xs font-semibold rounded border border-zinc-300 focus:outline-none w-28"
                    maxLength={20}
                    autoFocus
                  />
                  <button onClick={saveUserName} className="p-1 bg-black text-white rounded hover:bg-zinc-800">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="p-1 bg-zinc-100 text-zinc-600 rounded">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-zinc-500">{userName}</span>
                  <button 
                    onClick={() => {
                      setTempName(userName);
                      setIsEditingName(true);
                    }} 
                    className="text-zinc-400 hover:text-zinc-900 p-0.5"
                    title="Ganti nama"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-100 p-1 rounded-xl my-5">
          <button
            onClick={() => setActiveTab('booth')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'booth'
                ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Sesi Foto</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'friends'
                ? 'bg-white text-zinc-900 font-bold shadow-2xs'
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
            
            {/* Layout Frame Picker */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-2 tracking-wider">
                Format Frame
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '2-frames', label: '2 Pose' },
                  { id: '3-frames', label: '3 Pose' },
                  { id: '4-frames', label: '4 Pose' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLayout(item.id as '2-frames' | '3-frames' | '4-frames')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center ${
                      selectedLayout === item.id
                        ? 'border-black bg-black text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Buat Room Button */}
            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full py-3 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>{creating ? 'Membuat Sesi...' : 'Mulai Sesi Baru'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink-0 mx-3 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
                  placeholder="KODE ROOM"
                  maxLength={6}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-black text-center text-sm font-mono tracking-widest uppercase bg-zinc-50"
                />
                <button
                  type="submit"
                  disabled={joinInput.length < 4}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold disabled:opacity-40"
                >
                  Gabung
                </button>
              </div>
              {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}
            </form>

            {/* Quick Friend Invites if any */}
            {friends.length > 0 && (
              <div className="pt-3 border-t border-zinc-100">
                <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Ajak Cepat
                </span>
                <div className="space-y-1.5">
                  {friends.slice(0, 3).map((f) => {
                    const dynamicData = friendsData[f.uid] || f;
                    const isOnline = Boolean(dynamicData.lastSeen && nowTime && (nowTime - dynamicData.lastSeen < 45000));
                    const isInBooth = Boolean(dynamicData.status === 'in_booth' && dynamicData.currentRoomCode);

                    return (
                      <div key={f.uid} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            isInBooth ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`} />
                          <span className="text-xs font-bold text-zinc-800">{dynamicData.name || f.name}</span>
                          <span className="text-[10px] text-zinc-400">
                            {isInBooth ? 'Di booth' : isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        {isInBooth ? (
                          <button
                            onClick={() => joinFriendRoom(dynamicData.currentRoomCode!)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                          >
                            Masuk
                          </button>
                        ) : (
                          <button
                            onClick={() => inviteFriendToPhotobooth(f)}
                            disabled={sendingInviteTo === f.uid}
                            className="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white rounded text-[10px] font-bold disabled:opacity-50"
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

interface RoomData {
  status: string;
  layout?: string;
  overlayBackground?: string;
  countdownStartAt?: number | null;
  poseIndex?: number;
  messages?: Array<{ text: string; senderId: string; senderName: string; role: string; timestamp: number }>;
  createdAt?: { toDate: () => Date };
  host: {
    uid: string;
    name: string;
    connected: boolean;
    ready: boolean;
    filter?: string;
    photoUrls?: string[];
    isTyping?: boolean;
  };
  guest: {
    uid: string | null;
    name: string | null;
    connected: boolean;
    ready: boolean;
    filter?: string;
    photoUrls?: string[];
    isTyping?: boolean;
  };
}

interface CustomOverlayData {
  id: string;
  name?: string;
  hex: string;
  icon?: string;
  label?: string;
  baseColor?: string;
  layers?: Array<{
    hidden?: boolean;
    opacity?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    type: 'text' | 'image';
    text?: string;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    src?: string;
  }>;
}

function PhotoboothRoom({ 
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
  const roomRef = useRef<RoomData | null>(null);
  const customOverlaysRef = useRef<CustomOverlayData[]>([]);
  
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    customOverlaysRef.current = customOverlays;
  }, [customOverlays]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'overlays'), (snap) => {
      const data: CustomOverlayData[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as CustomOverlayData));
      setCustomOverlays(data);
    });
    return unsub;
  }, []);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Chat
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const prevMsgCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    
    canvas.width = 750; 
    canvas.height = 1050; 
    
    const loadImages = (urls: string[]) => {
       return Promise.all(urls.map(url => {
           return new Promise<HTMLImageElement>((resolve) => {
               const img = new Image();
               img.crossOrigin = 'anonymous';
               img.onload = () => resolve(img);
               img.onerror = () => resolve(img);
               img.src = url;
           });
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
        loadImages(currentRoom.host.photoUrls),
        loadImages(currentRoom.guest.photoUrls),
        loadImages(themeAssetsUrl),
        loadImages(layerUrls)
    ]).then(([hostImgs, guestImgs, themeImgs, layerImgs]) => {
         let baseColor = bgTheme;
         if (customMatch && customMatch.baseColor) baseColor = customMatch.baseColor;

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
         
         const gap = 24;
         const totalGaps = gap * (framesCount - 1);
         const paddingX = 28;
         const paddingTop = 28;
         const paddingBottom = 120;
         
         const availableHeight = canvas.height - paddingTop - paddingBottom - totalGaps;
         const rowHeight = availableHeight / framesCount;
         const photoWidth = (canvas.width - (paddingX * 2)) / 2;
         
         for (let i = 0; i < framesCount; i++) {
             const y = paddingTop + i * (rowHeight + gap);
             
             ctx.filter = getFilterCSS(hostFilter);
             if (hostImgs[i]) drawCover(hostImgs[i], paddingX,  y, photoWidth, rowHeight);
             
             ctx.filter = getFilterCSS(guestFilter);
             if (guestImgs[i]) drawCover(guestImgs[i], paddingX + photoWidth, y, photoWidth, rowHeight);
         }

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

         if (customMatch) {
             if (themeImgs[0]) {
                 const iconWidth = 70;
                 const iconHeight = themeImgs[0].height * (iconWidth / themeImgs[0].width);
                 ctx.drawImage(themeImgs[0], canvas.width / 2 - iconWidth / 2, canvas.height - 100, iconWidth, iconHeight);
             }
             ctx.fillStyle = textColor;
             ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
             ctx.fillText((customMatch.name || '').toUpperCase(), canvas.width / 2, canvas.height - 45);
             ctx.fillStyle = subColor;
             ctx.font = '500 12px monospace';
             ctx.fillText(`${dateStr} • ${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 20);
         } else {
             ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
             ctx.fillText('PHOTOBOOTH ABUY', canvas.width / 2, canvas.height - 50);
             
             ctx.fillStyle = subColor;
             ctx.font = '500 13px monospace';
             ctx.fillText(`${dateStr} • ${roomCode.toUpperCase()}`, canvas.width / 2, canvas.height - 25);
         }

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
    const expiryTime = createdAtTime + 15 * 60 * 1000;
    
    const checkExpiry = () => {
      if (Date.now() >= expiryTime) {
        alert("Room expired.");
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
             const layout = room.layout || '2-frames';
             const requiredPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
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
  }, [room?.status, room?.host?.photoUrls, room?.guest?.photoUrls, room?.host?.filter, room?.guest?.filter, room?.overlayBackground, compositePhotos]);

  const toggleReady = () => {
    if (!room) return;
    const currentReady = room[role]?.ready;
    updateDoc(doc(db, 'rooms', roomCode), {
      [`${role}.ready`]: !currentReady
    });
  };

  const changeFilter = (filterId: string) => {
    updateDoc(doc(db, 'rooms', roomCode), {
      [`${role}.filter`]: filterId
    });
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
      senderId: userUid,
      senderName: userName,
      role: role,
      timestamp: Date.now()
    };
    
    updateDoc(doc(db, 'rooms', roomCode), {
      messages: [...(room?.messages || []), newMessage],
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
    link.download = `photobooth-${roomCode}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
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
  if (room.status === 'both_connected' || room.status === 'ready') {
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
            <div className="w-full aspect-[5/7] bg-white rounded-xl p-2 border border-zinc-300 shadow-xs">
              <canvas ref={canvasRef} className="w-full h-full object-contain rounded" />
            </div>

            {/* Filter Pills */}
            <div className="w-full flex overflow-x-auto bg-white p-1.5 rounded-xl border border-zinc-200 gap-1.5">
              {filterOptions.map(f => (
                <button
                  key={f.id}
                  onClick={() => changeFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                    (myData?.filter || 'normal') === f.id 
                      ? 'bg-black text-white' 
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Background / Custom Overlays (Host Only) */}
            {role === 'host' && (
              <div className="w-full flex overflow-x-auto bg-white p-1.5 rounded-xl border border-zinc-200 gap-1.5 items-center">
                {[
                  { id: 'white', hex: '#ffffff', icon: undefined, label: undefined, baseColor: '#ffffff' },
                  { id: 'black', hex: '#000000', icon: undefined, label: undefined, baseColor: '#000000' },
                  { id: 'zinc', hex: '#f4f4f5', icon: undefined, label: undefined, baseColor: '#f4f4f5' },
                  { id: 'pink', hex: '#fbcfe8', icon: undefined, label: undefined, baseColor: '#fbcfe8' },
                  { id: 'blue', hex: '#bfdbfe', icon: undefined, label: undefined, baseColor: '#bfdbfe' },
                  ...customOverlays.map(o => ({
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
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                      (room.overlayBackground || '#ffffff') === bg.hex 
                        ? 'border-black ring-1 ring-black' 
                        : 'border-zinc-300'
                    }`}
                    style={{ backgroundColor: bg.hex.startsWith('#') ? bg.hex : (bg.baseColor || '#ffffff') }}
                  >
                    {bg.icon && <img src={bg.icon} alt="" className="w-5 h-5 object-contain" />}
                    {!bg.icon && bg.label && <span className="text-[9px] font-bold text-black">{bg.label}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Download and Retake */}
            <div className="flex gap-2 w-full">
              <button 
                onClick={downloadPhoto}
                className="flex-1 py-3 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Simpan Foto</span>
              </button>

              <button 
                onClick={resetSession}
                className="px-4 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Ulang</span>
              </button>
            </div>
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
                  videoConstraints={{ facingMode: "user" }}
                  onUserMediaError={(err) => setCameraError(typeof err === 'string' ? err : err.message || 'Error kamera')}
                  className="w-full h-full object-cover" 
                  style={{ filter: getFilterCSS(myData?.filter || 'normal') }}
                />
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
                    Pose {(room.poseIndex || 0) + 1} / {room?.layout === '4-frames' ? 4 : room?.layout === '3-frames' ? 3 : 2}
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
                  disabled={!otherData?.connected}
                  className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
                    !otherData?.connected
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
