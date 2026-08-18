'use client';

import React, { useRef, useState, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return { h: 0, s: 0, l: 100 };

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

const PRESET_PALETTES = [
  { name: 'Putih', hex: '#FFFFFF' },
  { name: 'Hitam', hex: '#000000' },
  { name: 'Abu-Abu', hex: '#E4E4E7' },
  { name: 'Pink', hex: '#FBCFE8' },
  { name: 'Merah', hex: '#FB7185' },
  { name: 'Biru', hex: '#BAE6FD' },
  { name: 'Hijau', hex: '#DCFCE7' },
  { name: 'Kuning', hex: '#FEF3C7' },
  { name: 'Ungu', hex: '#E9D5FF' },
  { name: 'Peach', hex: '#FFEDD5' },
];

export default function ColorPicker({
  color,
  onChange,
  showOpacity = false,
  opacity = 1,
  onOpacityChange,
}: ColorPickerProps) {
  const hsl = hexToHsl(color);
  const satValRef = useRef<HTMLDivElement>(null);
  const [isDraggingSat, setIsDraggingSat] = useState(false);

  const updateColorFromHsl = (newH: number, newS: number, newL: number) => {
    const newHex = hslToHex(newH, newS, newL);
    onChange(newHex);
  };

  const handleSatAreaMove = (e: MouseEvent | React.MouseEvent) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = 100 - (y / rect.height) * 100;

    const l = (v / 100) * (1 - s / 200) * 100;
    const newS = l === 0 || l === 100 ? 0 : ((v - l) / Math.min(l, 100 - l)) * 100;

    updateColorFromHsl(hsl.h, Math.round(newS), Math.round(l));
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingSat) handleSatAreaMove(e);
    };
    const onMouseUp = () => setIsDraggingSat(false);

    if (isDraggingSat) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingSat, hsl.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^#?([0-9A-F]{3}){1,2}$/i.test(val)) {
      const fullHex = val.startsWith('#') ? val : `#${val}`;
      onChange(fullHex);
    }
  };

  const pureHueHex = hslToHex(hsl.h, 100, 50);

  return (
    <div className="w-full space-y-3 select-none">
      {/* 2D Area */}
      <div
        ref={satValRef}
        onMouseDown={(e) => {
          setIsDraggingSat(true);
          handleSatAreaMove(e);
        }}
        className="relative w-full h-24 rounded-lg cursor-crosshair overflow-hidden border border-zinc-300"
        style={{ backgroundColor: pureHueHex }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

        <div
          className="absolute w-3.5 h-3.5 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${hsl.s}%`,
            top: `${100 - hsl.l}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Hue Slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase">
          <span>Hue</span>
          <span>{hsl.h}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={hsl.h}
          onChange={(e) => updateColorFromHsl(parseInt(e.target.value), hsl.s, hsl.l)}
          className="w-full h-2 rounded appearance-none cursor-pointer"
          style={{
            background:
              'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
          }}
        />
      </div>

      {/* Opacity Slider */}
      {showOpacity && onOpacityChange && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase">
            <span>Opacity</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-200 rounded appearance-none cursor-pointer accent-black"
          />
        </div>
      )}

      {/* Hex Bar */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded border border-zinc-300 shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 flex items-center bg-zinc-50 border border-zinc-300 rounded-lg px-2 py-1">
          <span className="text-xs font-mono font-bold text-zinc-400 mr-1">#</span>
          <input
            type="text"
            defaultValue={color.replace('#', '').toUpperCase()}
            key={color}
            onChange={handleHexChange}
            maxLength={6}
            className="w-full bg-transparent text-xs font-mono font-bold text-zinc-900 focus:outline-none uppercase"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="pt-2 border-t border-zinc-200">
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_PALETTES.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => onChange(p.hex)}
              className={`h-6 rounded border ${
                color.toLowerCase() === p.hex.toLowerCase()
                  ? 'border-black ring-1 ring-black'
                  : 'border-zinc-300'
              }`}
              style={{ backgroundColor: p.hex }}
              title={p.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
