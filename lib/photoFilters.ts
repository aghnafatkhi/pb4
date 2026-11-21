export const filterOptions = [
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

export const getFilterCSS = (filterId: string) =>
  filterOptions.find((f) => f.id === filterId)?.style || 'none';

export function swatchTextColor(color: string) {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return '#18181b';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#18181b' : '#ffffff';
}
