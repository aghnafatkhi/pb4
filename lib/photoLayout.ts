export type FrameLayout = '2-frames' | '3-frames' | '4-frames';

export const CANVAS_WIDTH = 750;
export const CANVAS_HEIGHT = 1050;
export const FRAME_GAP = 24;
export const PADDING_X = 28;
export const PADDING_TOP = 28;
export const PADDING_BOTTOM = 120;

export function getFrameCount(layout?: string | null): number {
  return layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
}

export interface PhotoSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export function getPhotoSlots(layout?: string | null): PhotoSlot[] {
  const frames = getFrameCount(layout);
  const totalGaps = FRAME_GAP * (frames - 1);
  const rowHeight = (CANVAS_HEIGHT - PADDING_TOP - PADDING_BOTTOM - totalGaps) / frames;
  const photoWidth = (CANVAS_WIDTH - PADDING_X * 2) / 2;

  const slots: PhotoSlot[] = [];
  for (let i = 0; i < frames; i++) {
    const y = PADDING_TOP + i * (rowHeight + FRAME_GAP);
    slots.push({
      id: `left-${i}`,
      x: PADDING_X,
      y,
      width: photoWidth,
      height: rowHeight,
      label: `FOTO ${i + 1} (HOST)`,
    });
    slots.push({
      id: `right-${i}`,
      x: PADDING_X + photoWidth,
      y,
      width: photoWidth,
      height: rowHeight,
      label: `FOTO ${i + 1} (GUEST)`,
    });
  }
  return slots;
}

// Solo prints use real photo paper sizes so faces keep their 4:3 camera shape:
// 2R (5:7) holds two stacked shots, 4R landscape (3:2) holds a 2×2 grid.
export type SoloLayout = '2-frames' | '4-frames';

export interface SoloPaper {
  id: '2R' | '4R';
  name: string;
  size: string;
  width: number;
  height: number;
  columns: number;
  rows: number;
  padding: number;
  gap: number;
  footer: number;
}

export const SOLO_PAPERS: Record<SoloLayout, SoloPaper> = {
  '2-frames': {
    id: '2R',
    name: '2R',
    size: '2,5 × 3,5 in',
    width: 750,
    height: 1050,
    columns: 1,
    rows: 2,
    padding: 20,
    gap: 16,
    footer: 84,
  },
  '4-frames': {
    id: '4R',
    name: '4R',
    size: '4 × 6 in',
    width: 1125,
    height: 750,
    columns: 2,
    rows: 2,
    padding: 24,
    gap: 16,
    footer: 92,
  },
};

export function getSoloPaper(layout?: string | null): SoloPaper {
  return layout === '4-frames' ? SOLO_PAPERS['4-frames'] : SOLO_PAPERS['2-frames'];
}

export function getSoloFrameCount(layout?: string | null): number {
  const paper = getSoloPaper(layout);
  return paper.columns * paper.rows;
}
