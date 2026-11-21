// Helper lokal dipakai komponen mode berdua.

export function timestampToMillis(value: unknown): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === 'number' ? value : 0;
}

export function getLocalUid() {
  if (typeof window === 'undefined') return 'temp-uid';
  let uid = localStorage.getItem('pb_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pb_uid', uid);
  }
  return uid;
}

export function getLocalName() {
  if (typeof window === 'undefined') return '@tamu';
  let name = localStorage.getItem('pb_name');
  if (!name) {
    name = '@tamu';
    localStorage.setItem('pb_name', name);
  } else if (!name.startsWith('@')) {
    name = '@' + name.replace(/^@+/, '').trim();
    localStorage.setItem('pb_name', name);
  }
  return name;
}

export function playNotificationSound() {
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
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // AudioContext blocked
  }
}

// Masa berlaku sesi berdua sebelum dianggap kadaluarsa.
export const ROOM_TTL_MS = 15 * 60 * 1000;
