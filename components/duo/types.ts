// Tipe data bersama untuk mode berdua (di-poll / realtime dari pb_docs).

export interface FriendItem {
  uid: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'in_booth';
  lastSeen?: number;
  currentRoomCode?: string | null;
}

export interface IncomingInvite {
  id: string;
  fromUid: string;
  fromName: string;
  roomCode: string;
  layout: string;
  status: string;
  createdAt?: unknown;
}

export interface RoomData {
  status: string;
  layout?: string;
  overlayBackground?: string;
  footerName?: string;
  footerDate?: string;
  showFooterDate?: boolean;
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
    photoUrl?: string | null;
    photoReady?: boolean;
    isTyping?: boolean;
  };
  guest: {
    uid: string | null;
    name: string | null;
    connected: boolean;
    ready: boolean;
    filter?: string;
    photoUrl?: string | null;
    photoReady?: boolean;
    isTyping?: boolean;
  };
}

export interface CustomOverlayData {
  id: string;
  name?: string;
  hex: string;
  icon?: string;
  label?: string;
  baseColor?: string;
  layout?: string;
  gradient?: {
    enabled: boolean;
    color2: string;
    direction: 'to-b' | 'to-r' | 'to-br' | 'to-tr';
  };
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

