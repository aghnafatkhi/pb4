// Collection of clean, transparent SVG sticker assets for the Photobooth Studio Editor
// All assets are standalone SVG Data URLs with transparent backgrounds and sharp vectors.

export interface StickerItem {
  id: string;
  name: string;
  category: 'cute' | 'retro' | 'party' | 'photobooth' | 'minimal' | 'decorative';
  svg: string; // SVG string or data URL
}

const createSvgDataUrl = (svgContent: string): string => {
  const cleaned = svgContent
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><');
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
};

export const STICKER_LIBRARY: StickerItem[] = [
  // CUTE & SPARKLES
  {
    id: 'cute-sparkle-4',
    name: 'Sparkle Bintang',
    category: 'cute',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <path d="M50 0 C50 30 70 50 100 50 C70 50 50 70 50 100 C50 70 30 50 0 50 C30 50 50 30 50 0 Z" fill="#FBBF24"/>
        <path d="M50 15 C50 35 65 50 85 50 C65 50 50 65 50 85 C50 65 35 50 15 50 C35 50 50 35 50 15 Z" fill="#FDE68A"/>
      </svg>
    `)
  },
  {
    id: 'cute-heart-duo',
    name: 'Duo Love',
    category: 'cute',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" fill="none">
        <path d="M35 15 C20 0 0 10 0 35 C0 60 35 85 35 85 C35 85 70 60 70 35 C70 10 50 0 35 15 Z" fill="#F43F5E" />
        <path d="M80 30 C70 20 55 25 55 42 C55 60 80 75 80 75 C80 75 105 60 105 42 C105 25 90 20 80 30 Z" fill="#FDA4AF" opacity="0.9" />
      </svg>
    `)
  },
  {
    id: 'cute-bow',
    name: 'Pita Pastel Pink',
    category: 'cute',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" fill="none">
        <path d="M60 45 C45 20 10 25 15 55 C20 75 45 60 60 55 C75 60 100 75 105 55 C110 25 75 20 60 45 Z" fill="#FB7185" stroke="#E11D48" stroke-width="3"/>
        <path d="M50 50 C35 70 25 95 30 100 C38 100 52 75 58 58" fill="#F43F5E" stroke="#E11D48" stroke-width="3"/>
        <path d="M70 50 C85 70 95 95 90 100 C82 100 68 75 62 58" fill="#F43F5E" stroke="#E11D48" stroke-width="3"/>
        <ellipse cx="60" cy="50" rx="12" ry="10" fill="#E11D48"/>
      </svg>
    `)
  },
  {
    id: 'cute-flower-daisy',
    name: 'Bunga Daisy',
    category: 'cute',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="20" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="80" cy="50" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="50" cy="80" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="20" cy="50" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="28" cy="28" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="72" cy="28" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="72" cy="72" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="28" cy="72" r="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="50" cy="50" r="16" fill="#FBBF24" stroke="#D97706" stroke-width="2"/>
      </svg>
    `)
  },
  {
    id: 'cute-cat-paw',
    name: 'Telapak Kucing',
    category: 'cute',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <ellipse cx="50" cy="65" rx="26" ry="20" fill="#FDA4AF" stroke="#F43F5E" stroke-width="3"/>
        <circle cx="25" cy="38" r="10" fill="#FDA4AF" stroke="#F43F5E" stroke-width="2.5"/>
        <circle cx="42" cy="26" r="11" fill="#FDA4AF" stroke="#F43F5E" stroke-width="2.5"/>
        <circle cx="58" cy="26" r="11" fill="#FDA4AF" stroke="#F43F5E" stroke-width="2.5"/>
        <circle cx="75" cy="38" r="10" fill="#FDA4AF" stroke="#F43F5E" stroke-width="2.5"/>
      </svg>
    `)
  },

  // RETRO & Y2K
  {
    id: 'retro-starburst-y2k',
    name: 'Y2K Starburst',
    category: 'retro',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <path d="M50 0 L58 35 L95 20 L68 48 L100 65 L64 68 L70 100 L46 72 L20 95 L32 62 L0 50 L35 40 L10 10 L44 28 Z" fill="#818CF8" stroke="#312E81" stroke-width="2"/>
        <circle cx="50" cy="50" r="12" fill="#C7D2FE"/>
      </svg>
    `)
  },
  {
    id: 'retro-pixel-heart',
    name: 'Pixel Heart 8-bit',
    category: 'retro',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
        <path d="M3 2h3v2h-3zM10 2h3v2h-3zM1 4h7v2h-7zM8 4h7v2h-7zM1 6h14v2h-14zM2 8h12v2h-12zM3 10h10v2h-10zM5 12h6v2h-6zM7 14h2v2h-2z" fill="#EF4444"/>
        <path d="M3 4h2v2h-2zM4 6h1v2h-1z" fill="#FCA5A5"/>
      </svg>
    `)
  },
  {
    id: 'retro-smiley-flower',
    name: 'Retro Smiley',
    category: 'retro',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" fill="#FCD34D" stroke="#18181B" stroke-width="4"/>
        <ellipse cx="36" cy="40" rx="5" ry="8" fill="#18181B"/>
        <ellipse cx="64" cy="40" rx="5" ry="8" fill="#18181B"/>
        <path d="M32 60 C38 75 62 75 68 60" stroke="#18181B" stroke-width="4" stroke-linecap="round" fill="none"/>
      </svg>
    `)
  },
  {
    id: 'retro-vintage-badge',
    name: 'Vintage Stamp Badge',
    category: 'retro',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="50" fill="#FEF08A" stroke="#B45309" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="60" cy="60" r="40" fill="#FFFBEB" stroke="#B45309" stroke-width="1.5"/>
        <text x="60" y="55" font-family="monospace" font-size="12" font-weight="900" fill="#B45309" text-anchor="middle" letter-spacing="2">MEMORIES</text>
        <text x="60" y="72" font-family="sans-serif" font-size="10" font-weight="700" fill="#D97706" text-anchor="middle">★ SPECIAL ★</text>
      </svg>
    `)
  },

  // PARTY & CELEBRATION
  {
    id: 'party-confetti-ribbon',
    name: 'Pita Konfeti',
    category: 'party',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <path d="M10 20 Q 30 5, 50 30 T 90 20" stroke="#EC4899" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M15 70 Q 40 90, 65 60 T 95 80" stroke="#3B82F6" stroke-width="5" stroke-linecap="round" fill="none"/>
        <circle cx="25" cy="45" r="4" fill="#F59E0B"/>
        <circle cx="75" cy="40" r="5" fill="#10B981"/>
        <circle cx="50" cy="75" r="3.5" fill="#8B5CF6"/>
        <rect x="80" y="60" width="8" height="8" rx="2" transform="rotate(30 80 60)" fill="#EF4444"/>
      </svg>
    `)
  },
  {
    id: 'party-hat',
    name: 'Topi Ulang Tahun',
    category: 'party',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <polygon points="50,15 15,85 85,85" fill="#6366F1" stroke="#312E81" stroke-width="3"/>
        <circle cx="50" cy="12" r="8" fill="#FBBF24"/>
        <path d="M26 62 Q 50 70, 74 62" stroke="#F43F5E" stroke-width="4" fill="none"/>
        <path d="M38 38 Q 50 44, 62 38" stroke="#34D399" stroke-width="4" fill="none"/>
        <circle cx="50" cy="76" r="4" fill="#FBBF24"/>
      </svg>
    `)
  },
  {
    id: 'party-disco-sparkle',
    name: 'Disco Sparkle Gold',
    category: 'party',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="35" fill="#F59E0B" stroke="#78350F" stroke-width="3"/>
        <line x1="50" y1="15" x2="50" y2="85" stroke="#FEF3C7" stroke-width="2"/>
        <line x1="15" y1="50" x2="85" y2="50" stroke="#FEF3C7" stroke-width="2"/>
        <line x1="25" y1="25" x2="75" y2="75" stroke="#FEF3C7" stroke-width="2"/>
        <line x1="25" y1="75" x2="75" y2="25" stroke="#FEF3C7" stroke-width="2"/>
        <circle cx="50" cy="50" r="8" fill="#FFFFFF"/>
      </svg>
    `)
  },

  // PHOTOBOOTH & VINTAGE PROPS
  {
    id: 'photobooth-film-cam',
    name: 'Kamera Vintage',
    category: 'photobooth',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" fill="none">
        <rect x="15" y="30" width="90" height="60" rx="10" fill="#27272A" stroke="#09090B" stroke-width="4"/>
        <path d="M40 30 L45 20 L75 20 L80 30 Z" fill="#3F3F46" stroke="#09090B" stroke-width="3"/>
        <circle cx="60" cy="60" r="20" fill="#71717A" stroke="#09090B" stroke-width="4"/>
        <circle cx="60" cy="60" r="12" fill="#18181B"/>
        <circle cx="55" cy="55" r="4" fill="#FFFFFF"/>
        <circle cx="88" cy="45" r="5" fill="#EF4444"/>
      </svg>
    `)
  },
  {
    id: 'photobooth-washi-tape',
    name: 'Washi Tape Strip',
    category: 'photobooth',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40" fill="none">
        <polygon points="5,5 135,5 130,35 0,35" fill="#FEF08A" opacity="0.85" stroke="#CA8A04" stroke-width="1.5" stroke-dasharray="4 2"/>
        <line x1="20" y1="8" x2="35" y2="32" stroke="#EAB308" stroke-width="2"/>
        <line x1="50" y1="8" x2="65" y2="32" stroke="#EAB308" stroke-width="2"/>
        <line x1="80" y1="8" x2="95" y2="32" stroke="#EAB308" stroke-width="2"/>
        <line x1="110" y1="8" x2="125" y2="32" stroke="#EAB308" stroke-width="2"/>
      </svg>
    `)
  },
  {
    id: 'photobooth-timestamp',
    name: 'Stempel Tanggal Retro',
    category: 'photobooth',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 50" fill="none">
        <rect x="5" y="5" width="130" height="40" rx="6" fill="#18181B" stroke="#3F3F46" stroke-width="2"/>
        <text x="70" y="26" font-family="'Courier New', monospace" font-size="13" font-weight="bold" fill="#F43F5E" text-anchor="middle" letter-spacing="1">REC ● 00:00:24</text>
        <text x="70" y="40" font-family="'Courier New', monospace" font-size="9" font-weight="bold" fill="#A1A1AA" text-anchor="middle">LIVE PHOTOBOOTH</text>
      </svg>
    `)
  },
  {
    id: 'photobooth-badge-label',
    name: 'Badge "PHOTOBOOTH"',
    category: 'photobooth',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 50" fill="none">
        <rect x="4" y="6" width="152" height="38" rx="19" fill="#F43F5E" stroke="#881337" stroke-width="3"/>
        <text x="80" y="30" font-family="sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">PHOTOBOOTH</text>
      </svg>
    `)
  },

  // MINIMAL & DECORATIVE
  {
    id: 'minimal-botanical-branch',
    name: 'Daun Minimalis',
    category: 'minimal',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <path d="M20 90 Q 40 50, 80 15" stroke="#065F46" stroke-width="3" stroke-linecap="round" fill="none"/>
        <path d="M50 40 C65 30 70 45 50 40 Z" fill="#10B981"/>
        <path d="M60 25 C75 15 80 30 60 25 Z" fill="#10B981"/>
        <path d="M38 58 C25 45 40 40 38 58 Z" fill="#34D399"/>
        <path d="M28 75 C15 65 30 60 28 75 Z" fill="#34D399"/>
      </svg>
    `)
  },
  {
    id: 'minimal-doodle-stars',
    name: 'Bintang Doodle Trio',
    category: 'minimal',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <!-- Star 1 -->
        <path d="M30 10 L35 25 L50 30 L35 35 L30 50 L25 35 L10 30 L25 25 Z" fill="#18181B"/>
        <!-- Star 2 -->
        <path d="M75 40 L78 52 L90 55 L78 58 L75 70 L72 58 L60 55 L72 52 Z" fill="#18181B"/>
        <!-- Star 3 -->
        <path d="M45 65 L47 73 L55 75 L47 77 L45 85 L43 77 L35 75 L43 73 Z" fill="#18181B"/>
      </svg>
    `)
  },
  {
    id: 'decorative-corner-ribbon',
    name: 'Corner Frame Ribbon',
    category: 'decorative',
    svg: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <path d="M10 90 L10 20 C10 14.477 14.477 10 20 10 L90 10" stroke="#18181B" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="20" cy="20" r="6" fill="#F43F5E"/>
        <circle cx="45" cy="10" r="3" fill="#18181B"/>
        <circle cx="10" cy="45" r="3" fill="#18181B"/>
      </svg>
    `)
  }
];
