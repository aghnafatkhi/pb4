// Ready-to-use frame templates. Coordinates follow the 750×1050 canvas and
// only decorate the footer band / photo corners, so they work on every layout.

import { STICKER_LIBRARY } from './stickerAssets';

type TemplateLayer = {
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
};

export interface PresetOverlay {
  id: string;
  name: string;
  hex: string;
  label: string;
  baseColor: string;
  gradient?: {
    enabled: boolean;
    color2: string;
    direction: 'to-b' | 'to-r' | 'to-br' | 'to-tr';
  };
  layers: TemplateLayer[];
}

const stickerSrc = (id: string) => STICKER_LIBRARY.find((s) => s.id === id)?.svg ?? '';

const img = (
  id: string,
  x: number,
  y: number,
  width: number,
  rotation = 0,
  height = width,
): TemplateLayer => ({
  type: 'image',
  src: stickerSrc(id),
  x,
  y,
  width,
  height,
  rotation,
  opacity: 1,
});

const txt = (
  text: string,
  y: number,
  fontSize: number,
  color: string,
  fontFamily = 'monospace',
): TemplateLayer => ({
  type: 'text',
  text,
  x: 275,
  y,
  width: 200,
  height: fontSize + 12,
  fontSize,
  color,
  fontFamily,
  rotation: 0,
  opacity: 1,
});

export const PRESET_OVERLAYS: PresetOverlay[] = [
  {
    id: 'tpl-modern-mono',
    name: 'Modern Mono',
    hex: '#FAFAF9',
    label: 'Modern',
    baseColor: '#FAFAF9',
    layers: [
      img('minimal-doodle-stars', 30, 936, 82, -8),
      img('minimal-doodle-stars', 640, 938, 66, 10),
      txt('EST. 2026', 936, 13, '#A1A1AA'),
    ],
  },
  {
    id: 'tpl-y2k-dream',
    name: 'Y2K Dream',
    hex: '#EEF2FF',
    label: 'Y2K',
    baseColor: '#EEF2FF',
    gradient: { enabled: true, color2: '#E0E7FF', direction: 'to-br' },
    layers: [
      img('retro-starburst-y2k', 26, 932, 92, -10),
      img('retro-pixel-heart', 646, 944, 62, 8),
      img('retro-smiley-flower', 642, 8, 94, 10),
    ],
  },
  {
    id: 'tpl-party-pop',
    name: 'Party Pop',
    hex: '#FFFBEB',
    label: 'Party',
    baseColor: '#FFFBEB',
    gradient: { enabled: true, color2: '#FEF3C7', direction: 'to-b' },
    layers: [
      img('party-balloons', 26, 930, 94, -6),
      img('party-popper', 640, 936, 86, 8),
      img('party-confetti-ribbon', 636, 6, 102, 6),
    ],
  },
  {
    id: 'tpl-cute-picnic',
    name: 'Cute Picnic',
    hex: '#FFF1F2',
    label: 'Cute',
    baseColor: '#FFF1F2',
    gradient: { enabled: true, color2: '#FFE4E6', direction: 'to-br' },
    layers: [
      img('cute-bow-ribbon', 28, 934, 90, -8),
      img('cute-cherry', 650, 942, 64, 10),
      img('cute-cloud-star', 642, 8, 92, 6),
    ],
  },
  {
    id: 'tpl-analog-film',
    name: 'Analog Film',
    hex: '#F7F3EC',
    label: 'Film',
    baseColor: '#F7F3EC',
    gradient: { enabled: true, color2: '#EFE7DA', direction: 'to-b' },
    layers: [
      img('retro-film-strip', 28, 940, 176, -3, 50),
      img('retro-vintage-badge', 626, 932, 96, 8),
      img('retro-polaroid-mini', 648, 10, 88, 8),
      txt('★ ANALOG MOMENTS ★', 936, 12, '#92400E'),
    ],
  },
];
