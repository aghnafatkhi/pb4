'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ArrowLeft, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Copy, 
  Trash2, 
  Save, 
  Upload, 
  Plus, 
  Layers, 
  Sparkles, 
  Palette, 
  Type, 
  FolderHeart, 
  AlignHorizontalJustifyCenter, 
  AlignVerticalJustifyCenter, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUp, 
  ChevronsDown, 
  RotateCw, 
  Search, 
  X, 
  Check
} from 'lucide-react';
import Link from 'next/link';
import ColorPicker from '@/components/ColorPicker';
import { STICKER_LIBRARY, StickerItem } from '@/lib/stickerAssets';

export interface CanvasLayer {
  id: string;
  type: 'image' | 'text';
  name: string;
  src?: string; // URL or SVG Data URL for image
  text?: string; // Content for text layer
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
}

export interface CustomOverlay {
  id: string;
  name: string;
  hex: string;
  icon?: string;
  label?: string;
  baseColor: string; // Background color
  gradient?: {
    enabled: boolean;
    color2: string;
    direction: 'to-b' | 'to-r' | 'to-br' | 'to-tr';
  };
  layers?: CanvasLayer[];
  layout?: '2-frames' | '3-frames' | '4-frames';
}

type ActiveTab = 'templates' | 'assets' | 'upload' | 'text' | 'background' | 'layers' | null;

function generateUniqueId(prefix: string = 'layer'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export default function AdminPage() {
  const [overlays, setOverlays] = useState<CustomOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Editor workspace state (Virtual coordinate space: 750 × 1050 px)
  const [themeName, setThemeName] = useState('Desain Photobooth 1');
  const [baseColor, setBaseColor] = useState('#FFFFFF');
  const [gradientSettings, setGradientSettings] = useState<{
    enabled: boolean;
    color2: string;
    direction: 'to-b' | 'to-r' | 'to-br' | 'to-tr';
  }>({
    enabled: false,
    color2: '#FFEED6',
    direction: 'to-b',
  });
  const [layout, setLayout] = useState<'2-frames' | '3-frames' | '4-frames'>('3-frames');
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // UI & Tool States
  const [activeTab, setActiveTab] = useState<ActiveTab>('assets');
  const [previewMode, setPreviewMode] = useState(false);
  const [zoom, setZoom] = useState(0.48); // Scale factor
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Asset Library Filter State
  const [assetCategory, setAssetCategory] = useState<string>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [userUploads, setUserUploads] = useState<{ id: string; name: string; src: string }[]>([]);

  // History Manager for Undo/Redo
  const [history, setHistory] = useState<CanvasLayer[][]>(() => [[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Interactive Drag & Transform State
  const [activeDrag, setActiveDrag] = useState<{
    type: 'move' | 'rotate' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br';
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initWidth: number;
    initHeight: number;
    initRotation: number;
  } | null>(null);

  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  // Photo slots guide calculator matching the photobooth layout
  const getPhotoSlots = (currentLayout: string) => {
    const framesCount = currentLayout === '4-frames' ? 4 : currentLayout === '3-frames' ? 3 : 2;
    const gap = 30;
    const totalGaps = gap * (framesCount - 1);
    const paddingX = 30;
    const paddingTop = 30;
    const paddingBottom = 150;

    const canvasHeight = 1050;
    const canvasWidth = 750;

    const availableHeight = canvasHeight - paddingTop - paddingBottom - totalGaps;
    const rowHeight = availableHeight / framesCount;
    const photoWidth = (canvasWidth - paddingX * 2) / 2;

    const slots = [];
    for (let i = 0; i < framesCount; i++) {
      const y = paddingTop + i * (rowHeight + gap);
      slots.push({ id: `left-${i}`, x: paddingX, y, width: photoWidth, height: rowHeight, label: `FOTO ${i + 1} (HOST)` });
      slots.push({ id: `right-${i}`, x: paddingX + photoWidth, y, width: photoWidth, height: rowHeight, label: `FOTO ${i + 1} (GUEST)` });
    }
    return slots;
  };

  // History updater helper
  const updateLayersWithHistory = (newLayers: CanvasLayer[]) => {
    setLayers(newLayers);
    setHistory((prev) => {
      const slice = prev.slice(0, historyIndex + 1);
      return [...slice, JSON.parse(JSON.stringify(newLayers))];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setLayers(JSON.parse(JSON.stringify(history[prevIdx])));
      setSelectedLayerId(null);
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setLayers(JSON.parse(JSON.stringify(history[nextIdx])));
      setSelectedLayerId(null);
    }
  };

  // Layer Operations
  const handleBringForward = () => {
    if (!selectedLayerId) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerId);
    if (idx !== -1 && idx < layers.length - 1) {
      const updated = [...layers];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      updateLayersWithHistory(updated);
    }
  };

  const handleSendBackward = () => {
    if (!selectedLayerId) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerId);
    if (idx > 0) {
      const updated = [...layers];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      updateLayersWithHistory(updated);
    }
  };

  const handleBringToFront = () => {
    if (!selectedLayerId) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerId);
    if (idx !== -1 && idx < layers.length - 1) {
      const item = layers[idx];
      const updated = [...layers.filter((_, i) => i !== idx), item];
      updateLayersWithHistory(updated);
    }
  };

  const handleSendToBack = () => {
    if (!selectedLayerId) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerId);
    if (idx > 0) {
      const item = layers[idx];
      const updated = [item, ...layers.filter((_, i) => i !== idx)];
      updateLayersWithHistory(updated);
    }
  };

  const handleToggleLock = (layerId: string) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l));
    updateLayersWithHistory(updated);
  };

  const handleToggleHide = (layerId: string) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, hidden: !l.hidden } : l));
    updateLayersWithHistory(updated);
  };

  const handleDeleteLayer = (layerId: string) => {
    const updated = layers.filter((l) => l.id !== layerId);
    updateLayersWithHistory(updated);
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const handleDuplicateLayer = (layerId: string) => {
    const orig = layers.find((l) => l.id === layerId);
    if (!orig) return;
    const dup: CanvasLayer = {
      ...orig,
      id: generateUniqueId('layer'),
      name: `${orig.name} (Copy)`,
      x: Math.min(550, orig.x + 25),
      y: Math.min(850, orig.y + 25),
      locked: false,
    };
    const updated = [...layers, dup];
    updateLayersWithHistory(updated);
    setSelectedLayerId(dup.id);
  };

  const handleAlignCenterX = () => {
    if (!selectedLayerId) return;
    const updated = layers.map((l) =>
      l.id === selectedLayerId ? { ...l, x: Math.round(375 - l.width / 2) } : l
    );
    updateLayersWithHistory(updated);
  };

  const handleAlignCenterY = () => {
    if (!selectedLayerId) return;
    const updated = layers.map((l) =>
      l.id === selectedLayerId ? { ...l, y: Math.round(525 - l.height / 2) } : l
    );
    updateLayersWithHistory(updated);
  };

  // Firestore Real-time Listener for saved overlays
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'overlays'), (snap) => {
      const data: CustomOverlay[] = [];
      snap.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as CustomOverlay);
      });
      setOverlays(data);
    });
    return unsub;
  }, []);

  // Load an existing overlay design into the editor
  const handleLoadOverlay = (overlay: CustomOverlay) => {
    setSelectedOverlayId(overlay.id);
    setThemeName(overlay.name || 'Desain Photobooth');
    setBaseColor(overlay.baseColor || '#FFFFFF');
    if (overlay.gradient) {
      setGradientSettings(overlay.gradient);
    } else {
      setGradientSettings({ enabled: false, color2: '#FFEED6', direction: 'to-b' });
    }
    setLayout(overlay.layout || '3-frames');
    const loadedLayers = overlay.layers || [];
    setLayers(loadedLayers);
    setHistory([JSON.parse(JSON.stringify(loadedLayers))]);
    setHistoryIndex(0);
    setSelectedLayerId(null);
  };

  // Reset workspace for a new design
  const handleNewDesign = () => {
    setSelectedOverlayId(null);
    setThemeName('Desain Photobooth Baru');
    setBaseColor('#FFFFFF');
    setGradientSettings({ enabled: false, color2: '#FFEED6', direction: 'to-b' });
    setLayout('3-frames');
    setLayers([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedLayerId(null);
  };

  // Add a graphic sticker from library to canvas
  const handleAddSticker = (sticker: StickerItem) => {
    const newL: CanvasLayer = {
      id: generateUniqueId('layer'),
      type: 'image',
      name: sticker.name,
      src: sticker.svg,
      x: 275,
      y: 425,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
    };
    const updated = [...layers, newL];
    updateLayersWithHistory(updated);
    setSelectedLayerId(newL.id);
  };

  // Add text layer to canvas
  const handleAddText = (presetType: 'title' | 'subtitle' | 'badge' | 'script') => {
    let text = 'Photobooth';
    let fontSize = 36;
    let fontFamily = 'sans-serif';
    let width = 280;
    let height = 60;
    let color = '#18181B';

    if (presetType === 'title') {
      text = 'BEST MOMENTS';
      fontSize = 40;
      fontFamily = 'monospace';
      width = 340;
      height = 70;
    } else if (presetType === 'subtitle') {
      text = 'Sweet Memories ♡ 2026';
      fontSize = 24;
      fontFamily = 'sans-serif';
      width = 300;
      height = 50;
    } else if (presetType === 'badge') {
      text = '★ PHOTOBOOTH ★';
      fontSize = 28;
      fontFamily = 'monospace';
      width = 300;
      height = 55;
      color = '#E11D48';
    } else if (presetType === 'script') {
      text = 'Forever & Always';
      fontSize = 38;
      fontFamily = 'cursive';
      width = 320;
      height = 70;
      color = '#4F46E5';
    }

    const newL: CanvasLayer = {
      id: generateUniqueId('layer'),
      type: 'text',
      name: text,
      text,
      fontFamily,
      fontSize,
      color,
      x: 220,
      y: 480,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
    };
    const updated = [...layers, newL];
    updateLayersWithHistory(updated);
    setSelectedLayerId(newL.id);
  };

  // Handle user uploaded PNG/SVG files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        const uploadItem = {
          id: generateUniqueId('up'),
          name: file.name.replace(/\.[^/.]+$/, ''),
          src: base64,
        };
        setUserUploads((prev) => [uploadItem, ...prev]);

        // Automatically place onto canvas
        const newL: CanvasLayer = {
          id: generateUniqueId('layer'),
          type: 'image',
          name: uploadItem.name,
          src: base64,
          x: 275,
          y: 425,
          width: 200,
          height: 200,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
        };
        const updated = [...layers, newL];
        updateLayersWithHistory(updated);
        setSelectedLayerId(newL.id);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Keyboard Shortcuts (Arrow Nudge, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!selectedLayerId) return;
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (!layer || layer.locked) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteLayer(selectedLayerId);
        return;
      } else return;

      e.preventDefault();
      const updated = layers.map((l) =>
        l.id === selectedLayerId ? { ...l, x: l.x + dx, y: l.y + dy } : l
      );
      updateLayersWithHistory(updated);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, layers, historyIndex, history]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse Drag / Transform Math Engine
  const handleMouseDown = (
    e: React.MouseEvent,
    layer: CanvasLayer,
    type: 'move' | 'rotate' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'
  ) => {
    if (layer.locked && type !== 'rotate') return;
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    setActiveDrag({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initX: layer.x,
      initY: layer.y,
      initWidth: layer.width,
      initHeight: layer.height,
      initRotation: layer.rotation,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDrag || !selectedLayerId) return;
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (!layer || layer.locked) return;

      const dx = e.clientX - activeDrag.startX;
      const dy = e.clientY - activeDrag.startY;

      const scaledDx = dx / zoom;
      const scaledDy = dy / zoom;

      const updatedLayers = [...layers];
      const idx = updatedLayers.findIndex((l) => l.id === selectedLayerId);

      if (activeDrag.type === 'move') {
        let newX = activeDrag.initX + scaledDx;
        let newY = activeDrag.initY + scaledDy;

        let showGuideX = false;
        let showGuideY = false;

        // Snapping Canvas Center (750x1050 midpoint: 375, 525)
        if (Math.abs(newX + layer.width / 2 - 375) < 10) {
          newX = 375 - layer.width / 2;
          showGuideX = true;
        }
        if (Math.abs(newY + layer.height / 2 - 525) < 10) {
          newY = 525 - layer.height / 2;
          showGuideY = true;
        }

        // Snapping Canvas Edges
        if (Math.abs(newX) < 10) {
          newX = 0;
          showGuideX = true;
        }
        if (Math.abs(newX + layer.width - 750) < 10) {
          newX = 750 - layer.width;
          showGuideX = true;
        }
        if (Math.abs(newY) < 10) {
          newY = 0;
          showGuideY = true;
        }
        if (Math.abs(newY + layer.height - 1050) < 10) {
          newY = 1050 - layer.height;
          showGuideY = true;
        }

        // Snapping Photo Slots
        const slots = getPhotoSlots(layout);
        for (const slot of slots) {
          if (Math.abs(newX - slot.x) < 8) {
            newX = slot.x;
            showGuideX = true;
          }
          if (Math.abs(newX + layer.width - (slot.x + slot.width)) < 8) {
            newX = slot.x + slot.width - layer.width;
            showGuideX = true;
          }
          if (Math.abs(newY - slot.y) < 8) {
            newY = slot.y;
            showGuideY = true;
          }
          if (Math.abs(newY + layer.height - (slot.y + slot.height)) < 8) {
            newY = slot.y + slot.height - layer.height;
            showGuideY = true;
          }
        }

        setSnapLines({
          x: showGuideX ? newX + layer.width / 2 : null,
          y: showGuideY ? newY + layer.height / 2 : null,
        });

        updatedLayers[idx] = {
          ...layer,
          x: Math.round(newX),
          y: Math.round(newY),
        };
      } else if (activeDrag.type.startsWith('resize-')) {
        const isRight = activeDrag.type.includes('r');
        const isBottom = activeDrag.type.includes('b');
        const isLeft = activeDrag.type.includes('l');
        const isTop = activeDrag.type.includes('t');

        let newWidth = layer.width;
        let newHeight = layer.height;
        let newX = layer.x;
        let newY = layer.y;

        const aspect = activeDrag.initWidth / activeDrag.initHeight;

        if (isRight && isBottom) {
          newWidth = Math.max(25, activeDrag.initWidth + scaledDx);
          newHeight = Math.round(newWidth / aspect);
        } else if (isLeft && isBottom) {
          const allowedDx = Math.min(scaledDx, activeDrag.initWidth - 25);
          newWidth = activeDrag.initWidth - allowedDx;
          newHeight = Math.round(newWidth / aspect);
          newX = activeDrag.initX + (activeDrag.initWidth - newWidth);
        } else if (isRight && isTop) {
          newWidth = Math.max(25, activeDrag.initWidth + scaledDx);
          newHeight = Math.round(newWidth / aspect);
          newY = activeDrag.initY + (activeDrag.initHeight - newHeight);
        } else if (isLeft && isTop) {
          const allowedDx = Math.min(scaledDx, activeDrag.initWidth - 25);
          newWidth = activeDrag.initWidth - allowedDx;
          newHeight = Math.round(newWidth / aspect);
          newX = activeDrag.initX + (activeDrag.initWidth - newWidth);
          newY = activeDrag.initY + (activeDrag.initHeight - newHeight);
        }

        updatedLayers[idx] = {
          ...layer,
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        };
      } else if (activeDrag.type === 'rotate') {
        const designCanvas = document.getElementById('design-canvas');
        if (designCanvas) {
          const rect = designCanvas.getBoundingClientRect();
          const cX = rect.left + (activeDrag.initX + activeDrag.initWidth / 2) * zoom;
          const cY = rect.top + (activeDrag.initY + activeDrag.initHeight / 2) * zoom;

          const angleRad = Math.atan2(e.clientY - cY, e.clientX - cX);
          let angleDeg = (angleRad * 180) / Math.PI + 90;
          if (angleDeg < 0) angleDeg += 360;

          updatedLayers[idx] = {
            ...layer,
            rotation: Math.round(angleDeg),
          };
        }
      }

      setLayers(updatedLayers);
    };

    const handleMouseUp = () => {
      if (activeDrag && selectedLayerId) {
        const finalState = JSON.parse(JSON.stringify(layers));
        setHistory((prev) => {
          const slice = prev.slice(0, historyIndex + 1);
          return [...slice, finalState];
        });
        setHistoryIndex((prev) => prev + 1);
      }
      setActiveDrag(null);
      setSnapLines({ x: null, y: null });
    };

    if (activeDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, layers, zoom, selectedLayerId, historyIndex, layout]);

  // Save composition to Firestore
  const handleSaveComposition = async () => {
    if (!themeName.trim()) return;
    setSaving(true);

    const firstImageLayer = layers.find((l) => l.type === 'image' && l.src)?.src || '';

    const payload: Omit<CustomOverlay, 'id'> = {
      name: themeName,
      hex: selectedOverlayId
        ? overlays.find((o) => o.id === selectedOverlayId)?.hex || generateUniqueId('theme-custom')
        : generateUniqueId('theme-custom'),
      baseColor,
      gradient: gradientSettings,
      layout,
      layers,
      icon: firstImageLayer || undefined,
      label: undefined,
    };

    try {
      if (selectedOverlayId) {
        await setDoc(doc(db, 'overlays', selectedOverlayId), payload, { merge: true });
      } else {
        const ref = await addDoc(collection(db, 'overlays'), payload);
        setSelectedOverlayId(ref.id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving overlay:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverlayItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'overlays', id));
      if (selectedOverlayId === id) {
        handleNewDesign();
      }
    } catch (err) {
      console.error('Error deleting overlay:', err);
    }
  };

  // Filtered Stickers
  const filteredStickers = STICKER_LIBRARY.filter((s) => {
    const matchCat = assetCategory === 'all' || s.category === assetCategory;
    const matchSearch = !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const photoSlots = getPhotoSlots(layout);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#FFEED6] overflow-hidden select-none font-sans text-zinc-900">
      
      {/* 1. TOP BAR */}
      <header className="h-14 bg-white border-b border-zinc-200/80 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 z-30 shadow-xs">
        
        {/* Left: Back & Theme Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-700 hover:text-zinc-900 shrink-0"
            title="Kembali ke Photobooth"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              className="text-sm sm:text-base font-bold text-zinc-900 bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-400 rounded-lg px-2 py-1 outline-none transition-all truncate max-w-[140px] sm:max-w-[240px]"
              placeholder="Nama Desain"
              title="Klik untuk mengubah nama tema"
            />
          </div>
        </div>

        {/* Center: Layout Segmented Control */}
        <div className="hidden md:flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
          {(['2-frames', '3-frames', '4-frames'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setLayout(fmt)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                layout === fmt
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {fmt === '2-frames' ? '2 Foto' : fmt === '3-frames' ? '3 Foto' : '4 Foto'}
            </button>
          ))}
        </div>

        {/* Right: History, Zoom, Preview & Save */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Undo / Redo */}
          <div className="flex items-center bg-zinc-50 border border-zinc-200/70 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden lg:flex items-center bg-zinc-50 border border-zinc-200/70 rounded-xl px-1.5 py-0.5 text-xs text-zinc-600">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.05))}
              className="p-1 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-md"
              title="Perkecil Kanvas"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-medium px-1.5 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(0.85, z + 0.05))}
              className="p-1 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-md"
              title="Perbesar Kanvas"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.48)}
              className="p-1 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-md ml-0.5"
              title="Reset Ukuran (Fit)"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          {/* Preview Toggle */}
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              previewMode
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
            }`}
            title="Toggle Pratinjau Bersih"
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{previewMode ? 'Edit Mode' : 'Preview'}</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveComposition}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT COMPACT TOOLBAR (VERTICAL DOCK) */}
        <aside className="w-16 bg-white border-r border-zinc-200/80 flex flex-col items-center py-3 gap-2 shrink-0 z-20 shadow-xs">
          
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'templates' ? null : 'templates')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${
              activeTab === 'templates'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Koleksi Desain Tersimpan"
          >
            <FolderHeart className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Koleksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'assets' ? null : 'assets')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${
              activeTab === 'assets'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Sticker & Grafis"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Assets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'upload' ? null : 'upload')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${
              activeTab === 'upload'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Unggah Gambar Sendiri"
          >
            <Upload className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Upload</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'text' ? null : 'text')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${
              activeTab === 'text'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Tambahkan Teks Dekorasi"
          >
            <Type className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Teks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'background' ? null : 'background')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${
              activeTab === 'background'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Warna Background Kanvas"
          >
            <Palette className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Warna</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'layers' ? null : 'layers')}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all relative ${
              activeTab === 'layers'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            title="Daftar Layer Kanvas"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Layers</span>
            {layers.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {layers.length}
              </span>
            )}
          </button>

          <div className="mt-auto pt-2 border-t border-zinc-100 flex flex-col items-center">
            <button
              type="button"
              onClick={handleNewDesign}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
              title="Buat Desain Baru Kosong"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* LEFT CONTEXTUAL FLYOUT DRAWER (OPENS ONLY FOR SELECTED TAB) */}
        {activeTab && (
          <div className="w-80 bg-white border-r border-zinc-200/80 flex flex-col h-full z-10 shadow-lg shrink-0 animate-in slide-in-from-left duration-200">
            
            {/* Flyout Header */}
            <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                {activeTab === 'templates' && 'Desain Tersimpan'}
                {activeTab === 'assets' && 'Sticker & Grafis'}
                {activeTab === 'upload' && 'Unggah Asset'}
                {activeTab === 'text' && 'Tambah Teks'}
                {activeTab === 'background' && 'Latar Belakang'}
                {activeTab === 'layers' && 'Susunan Layer'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="p-1 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
                title="Tutup Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Flyout Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TAB: TEMPLATES / KOLEKSI */}
              {activeTab === 'templates' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleNewDesign}
                    className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Mulai Desain Baru</span>
                  </button>

                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pt-2">
                    Koleksi Kamu ({overlays.length})
                  </div>

                  <div className="space-y-2">
                    {overlays.map((ov) => (
                      <div
                        key={ov.id}
                        onClick={() => handleLoadOverlay(ov)}
                        className={`group p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          selectedOverlayId === ov.id
                            ? 'bg-zinc-50 border-zinc-900 ring-1 ring-zinc-900'
                            : 'bg-white border-zinc-200/70 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl border border-zinc-200 shrink-0 flex items-center justify-center shadow-2xs overflow-hidden"
                            style={{ backgroundColor: ov.baseColor || '#FFFFFF' }}
                          >
                            {ov.layers?.[0]?.src ? (
                              <img
                                src={ov.layers[0].src}
                                alt=""
                                className="w-7 h-7 object-contain"
                              />
                            ) : (
                              <Sparkles className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-900 truncate">
                              {ov.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-medium">
                              {ov.layers?.length || 0} stiker • {ov.layout || '3-frames'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteOverlayItem(ov.id, e)}
                          className="p-1.5 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Tema"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {overlays.length === 0 && (
                      <div className="text-center py-8 text-xs text-zinc-400">
                        Belum ada desain tersimpan.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: ASSETS (REAL SVG/PNG STICKER BROWSER) */}
              {activeTab === 'assets' && (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      placeholder="Cari stiker..."
                      className="w-full bg-zinc-50 border border-zinc-200/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                    />
                  </div>

                  {/* Category Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: 'Semua' },
                      { id: 'cute', label: 'Cute' },
                      { id: 'retro', label: 'Retro' },
                      { id: 'party', label: 'Party' },
                      { id: 'photobooth', label: 'Vintage' },
                      { id: 'minimal', label: 'Minimal' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAssetCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          assetCategory === cat.id
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Stickers Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {filteredStickers.map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        onClick={() => handleAddSticker(sticker)}
                        className="group flex flex-col items-center justify-center p-2 rounded-2xl border border-zinc-200/70 hover:border-zinc-900 hover:bg-zinc-50 transition-all aspect-square relative shadow-2xs"
                        title={`Tambah ${sticker.name}`}
                      >
                        <img
                          src={sticker.svg}
                          alt={sticker.name}
                          className="w-12 h-12 object-contain group-hover:scale-110 transition-transform"
                        />
                        <span className="text-[9px] font-medium text-zinc-500 truncate w-full text-center mt-1 group-hover:text-zinc-900">
                          {sticker.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: UPLOAD ASSET */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  {/* File Upload Zone */}
                  <label className="border-2 border-dashed border-zinc-200 hover:border-zinc-900 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50/50 transition-all block">
                    <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                    <span className="text-xs font-bold text-zinc-800">Unggah Gambar (PNG / SVG)</span>
                    <span className="text-[10px] text-zinc-400 mt-1">Transparan lebih estetik</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Past Uploads */}
                  {userUploads.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        Asset Terunggah ({userUploads.length})
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {userUploads.map((up) => (
                          <button
                            key={up.id}
                            type="button"
                            onClick={() => {
                              const newL: CanvasLayer = {
                                id: generateUniqueId('layer'),
                                type: 'image',
                                name: up.name,
                                src: up.src,
                                x: 275,
                                y: 425,
                                width: 200,
                                height: 200,
                                rotation: 0,
                                opacity: 1,
                                locked: false,
                                hidden: false,
                              };
                              const updated = [...layers, newL];
                              updateLayersWithHistory(updated);
                              setSelectedLayerId(newL.id);
                            }}
                            className="group p-2 rounded-2xl border border-zinc-200 hover:border-zinc-900 flex flex-col items-center justify-center aspect-square"
                          >
                            <img src={up.src} alt={up.name} className="w-12 h-12 object-contain" />
                            <span className="text-[9px] text-zinc-500 truncate w-full text-center mt-1">
                              {up.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: TEXT */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Gaya Tipografi
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddText('title')}
                    className="w-full p-3 rounded-2xl border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 text-left transition-all"
                  >
                    <div className="text-base font-black font-mono tracking-widest text-zinc-900">
                      HEADLINE MONO
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                      Gaya bold vintage photobooth
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddText('subtitle')}
                    className="w-full p-3 rounded-2xl border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 text-left transition-all"
                  >
                    <div className="text-sm font-semibold text-zinc-900">
                      Sweet Memories ♡ 2026
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                      Subteks bersih modern
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddText('badge')}
                    className="w-full p-3 rounded-2xl border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 text-left transition-all"
                  >
                    <div className="text-xs font-black font-mono tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded-md inline-block">
                      ★ PHOTOBOOTH ★
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium mt-1">
                      Label stempel retro
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddText('script')}
                    className="w-full p-3 rounded-2xl border border-zinc-200/80 hover:border-zinc-900 hover:bg-zinc-50 text-left transition-all"
                  >
                    <div className="text-base font-medium italic text-indigo-600 font-serif">
                      Forever & Always
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                      Tulisan tangan estetik
                    </div>
                  </button>
                </div>
              )}

              {/* TAB: BACKGROUND */}
              {activeTab === 'background' && (
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
                    <button
                      type="button"
                      onClick={() => setGradientSettings({ ...gradientSettings, enabled: false })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        !gradientSettings.enabled
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Solid
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradientSettings({ ...gradientSettings, enabled: true })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        gradientSettings.enabled
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Gradient
                    </button>
                  </div>

                  {/* Primary Color Picker */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {gradientSettings.enabled ? 'Warna Awal' : 'Warna Latar'}
                    </div>
                    <ColorPicker color={baseColor} onChange={setBaseColor} />
                  </div>

                  {/* Gradient Secondary Color */}
                  {gradientSettings.enabled && (
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Warna Akhir Gradient
                      </div>
                      <ColorPicker
                        color={gradientSettings.color2}
                        onChange={(c) => setGradientSettings({ ...gradientSettings, color2: c })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB: LAYERS STACK */}
              {activeTab === 'layers' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    <span>Semua Layer ({layers.length})</span>
                    <span>Tumpukan (Atas → Bawah)</span>
                  </div>

                  {layers
                    .slice()
                    .reverse()
                    .map((layer, reverseIdx) => {
                      const actualIdx = layers.length - 1 - reverseIdx;
                      const isSelected = selectedLayerId === layer.id;

                      return (
                        <div
                          key={layer.id}
                          onClick={() => setSelectedLayerId(layer.id)}
                          className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                              : 'bg-white border-zinc-200/70 hover:border-zinc-300 text-zinc-800'
                          }`}
                        >
                          {/* Thumbnail & Title */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/70 flex items-center justify-center shrink-0 overflow-hidden">
                              {layer.type === 'text' ? (
                                <Type className="w-4 h-4 text-zinc-600" />
                              ) : (
                                <img src={layer.src} alt="" className="w-6 h-6 object-contain" />
                              )}
                            </div>
                            <span className="text-xs font-semibold truncate max-w-[110px]">
                              {layer.name}
                            </span>
                          </div>

                          {/* Quick Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Move Up / Down */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (actualIdx < layers.length - 1) {
                                  const updated = [...layers];
                                  const temp = updated[actualIdx];
                                  updated[actualIdx] = updated[actualIdx + 1];
                                  updated[actualIdx + 1] = temp;
                                  updateLayersWithHistory(updated);
                                }
                              }}
                              disabled={actualIdx === layers.length - 1}
                              className={`p-1 rounded-md disabled:opacity-20 ${
                                isSelected ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500'
                              }`}
                              title="Geser ke Atas"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (actualIdx > 0) {
                                  const updated = [...layers];
                                  const temp = updated[actualIdx];
                                  updated[actualIdx] = updated[actualIdx - 1];
                                  updated[actualIdx - 1] = temp;
                                  updateLayersWithHistory(updated);
                                }
                              }}
                              disabled={actualIdx === 0}
                              className={`p-1 rounded-md disabled:opacity-20 ${
                                isSelected ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500'
                              }`}
                              title="Geser ke Bawah"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Visibility */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleHide(layer.id);
                              }}
                              className={`p-1 rounded-md ${
                                isSelected ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500'
                              }`}
                              title={layer.hidden ? 'Tampilkan' : 'Sembunyikan'}
                            >
                              {layer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>

                            {/* Lock */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLock(layer.id);
                              }}
                              className={`p-1 rounded-md ${
                                isSelected ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500'
                              }`}
                              title={layer.locked ? 'Buka Kunci' : 'Kunci'}
                            >
                              {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLayer(layer.id);
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                              title="Hapus Layer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {layers.length === 0 && (
                    <div className="text-center py-8 text-xs text-zinc-400">
                      Belum ada layer di kanvas.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. CENTER PRIMARY CANVAS AREA */}
        <main
          onClick={() => setSelectedLayerId(null)}
          className="flex-1 h-full overflow-auto flex items-center justify-center p-4 sm:p-8 relative"
        >
          {/* Virtual Canvas (750 × 1050 px Scaled by Zoom) */}
          <div
            id="design-canvas"
            className="relative shadow-2xl rounded-2xl overflow-hidden shrink-0 transition-transform origin-center border border-zinc-300/60"
            style={{
              width: 750 * zoom,
              height: 1050 * zoom,
              backgroundColor: baseColor,
              backgroundImage: gradientSettings.enabled
                ? `linear-gradient(${gradientSettings.direction.replace('to-', 'to ')}, ${baseColor}, ${gradientSettings.color2})`
                : undefined,
            }}
          >
            {/* Virtual Coordinate Space Container (750x1050) */}
            <div
              className="absolute inset-0 origin-top-left"
              style={{
                width: 750,
                height: 1050,
                transform: `scale(${zoom})`,
              }}
            >
              {/* Photo Slot Guides (Visible in Edit Mode, Hidden in Preview) */}
              {!previewMode &&
                photoSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="absolute border-2 border-dashed border-zinc-400/40 bg-zinc-900/5 rounded-xl flex items-center justify-center pointer-events-none"
                    style={{
                      left: slot.x,
                      top: slot.y,
                      width: slot.width,
                      height: slot.height,
                    }}
                  >
                    <span className="text-xs font-mono font-bold tracking-widest text-zinc-400/80">
                      {slot.label}
                    </span>
                  </div>
                ))}

              {/* Photobooth Footer Text Guide */}
              <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none">
                <div className="text-xs font-mono font-bold tracking-widest uppercase text-zinc-400/70">
                  {themeName || 'PHOTOBOOTH'}
                </div>
                <div className="text-[10px] text-zinc-400/60 mt-0.5 font-medium">
                  {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
                </div>
              </div>

              {/* Magnetic Alignment Snap Guidelines */}
              {!previewMode && snapLines.x !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-50 pointer-events-none -translate-x-1/2 border-l border-dashed border-rose-500"
                  style={{ left: snapLines.x }}
                />
              )}
              {!previewMode && snapLines.y !== null && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-rose-500 z-50 pointer-events-none -translate-y-1/2 border-t border-dashed border-rose-500"
                  style={{ top: snapLines.y }}
                />
              )}

              {/* Render All Canvas Layers */}
              {layers.map((layer) => {
                if (layer.hidden) return null;
                const isSelected = selectedLayerId === layer.id && !previewMode;

                return (
                  <div
                    key={layer.id}
                    onMouseDown={(e) => handleMouseDown(e, layer, 'move')}
                    className={`absolute select-none cursor-move group ${
                      isSelected ? 'z-40' : 'z-10'
                    }`}
                    style={{
                      left: layer.x,
                      top: layer.y,
                      width: layer.width,
                      height: layer.height,
                      transform: `rotate(${layer.rotation}deg)`,
                      opacity: layer.opacity !== undefined ? layer.opacity : 1,
                    }}
                  >
                    {/* Layer Content: Image or Text */}
                    {layer.type === 'text' ? (
                      <div
                        className="w-full h-full flex items-center justify-center font-bold text-center pointer-events-none"
                        style={{
                          color: layer.color || '#18181B',
                          fontSize: `${layer.fontSize || 32}px`,
                          fontFamily: layer.fontFamily || 'sans-serif',
                          lineHeight: 1.2,
                        }}
                      >
                        {layer.text}
                      </div>
                    ) : (
                      <img
                        src={layer.src}
                        alt={layer.name}
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                    )}

                    {/* Active Selection Bounding Box & Transform Handles */}
                    {isSelected && (
                      <div className="absolute -inset-1 border-2 border-blue-500 rounded-lg pointer-events-none">
                        {/* 4 Corner Resize Handles */}
                        <div
                          onMouseDown={(e) => handleMouseDown(e, layer, 'resize-tl')}
                          className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-xs"
                        />
                        <div
                          onMouseDown={(e) => handleMouseDown(e, layer, 'resize-tr')}
                          className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-xs"
                        />
                        <div
                          onMouseDown={(e) => handleMouseDown(e, layer, 'resize-bl')}
                          className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-xs"
                        />
                        <div
                          onMouseDown={(e) => handleMouseDown(e, layer, 'resize-br')}
                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-xs"
                        />

                        {/* Top Rotation Stalk & Handle */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                          <div
                            onMouseDown={(e) => handleMouseDown(e, layer, 'rotate')}
                            className="w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center shadow-xs hover:scale-110 transition-transform"
                            title="Putar Objek"
                          >
                            <RotateCw className="w-2.5 h-2.5 text-blue-600" />
                          </div>
                          <div className="w-0.5 h-2 bg-blue-500" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* 4. RIGHT CONTEXTUAL INSPECTOR PANEL (Appears When Object or Canvas is Inspected) */}
        {selectedLayer ? (
          <aside className="w-72 bg-white border-l border-zinc-200/80 p-4 flex flex-col gap-4 shrink-0 z-20 shadow-lg overflow-y-auto animate-in slide-in-from-right duration-200">
            
            {/* Inspector Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-[10px] font-bold uppercase text-zinc-600 tracking-wider">
                  {selectedLayer.type === 'text' ? 'Teks' : 'Stiker'}
                </span>
                <input
                  type="text"
                  value={selectedLayer.name}
                  onChange={(e) => {
                    const updated = layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, name: e.target.value } : l
                    );
                    updateLayersWithHistory(updated);
                  }}
                  className="text-xs font-bold text-zinc-900 bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-zinc-300 rounded px-1 py-0.5 outline-none truncate"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDuplicateLayer(selectedLayer.id)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Duplikat (Salin)"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLayer(selectedLayer.id)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Hapus Layer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* If Text Layer: Text Content & Typography Controls */}
            {selectedLayer.type === 'text' && (
              <div className="space-y-3 border-b border-zinc-100 pb-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Konten Teks
                </div>
                <textarea
                  value={selectedLayer.text || ''}
                  onChange={(e) => {
                    const updated = layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, text: e.target.value } : l
                    );
                    updateLayersWithHistory(updated);
                  }}
                  rows={2}
                  className="w-full text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-xl p-2 focus:outline-none focus:border-zinc-900"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold">Font</label>
                    <select
                      value={selectedLayer.fontFamily || 'sans-serif'}
                      onChange={(e) => {
                        const updated = layers.map((l) =>
                          l.id === selectedLayer.id ? { ...l, fontFamily: e.target.value } : l
                        );
                        updateLayersWithHistory(updated);
                      }}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg text-xs p-1.5 mt-1 font-medium focus:outline-none"
                    >
                      <option value="sans-serif">Sans-Serif</option>
                      <option value="monospace">Monospace Retro</option>
                      <option value="serif">Serif Elegant</option>
                      <option value="cursive">Cursive Script</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold">Ukuran Font</label>
                    <input
                      type="number"
                      value={selectedLayer.fontSize || 32}
                      onChange={(e) => {
                        const updated = layers.map((l) =>
                          l.id === selectedLayer.id ? { ...l, fontSize: parseInt(e.target.value) || 20 } : l
                        );
                        updateLayersWithHistory(updated);
                      }}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg text-xs p-1.5 mt-1 font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Text Color Swatches */}
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold">Warna Teks</label>
                  <div className="flex gap-1.5 mt-1.5">
                    {['#18181B', '#FFFFFF', '#E11D48', '#4F46E5', '#D97706', '#059669'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const updated = layers.map((l) =>
                            l.id === selectedLayer.id ? { ...l, color: c } : l
                          );
                          updateLayersWithHistory(updated);
                        }}
                        className={`w-6 h-6 rounded-lg border transition-transform ${
                          selectedLayer.color === c ? 'ring-2 ring-zinc-900 scale-110' : 'border-zinc-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transform Controls (Position & Size) */}
            <div className="space-y-3 border-b border-zinc-100 pb-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Transform
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 mr-2">W</span>
                  <span className="text-xs font-mono font-bold text-zinc-800">{selectedLayer.width}px</span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 mr-2">H</span>
                  <span className="text-xs font-mono font-bold text-zinc-800">{selectedLayer.height}px</span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 mr-2">X</span>
                  <span className="text-xs font-mono font-bold text-zinc-800">{selectedLayer.x}</span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 mr-2">Y</span>
                  <span className="text-xs font-mono font-bold text-zinc-800">{selectedLayer.y}</span>
                </div>
              </div>

              {/* Rotation & Opacity */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                  <span>Rotasi</span>
                  <span className="font-mono">{selectedLayer.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedLayer.rotation}
                  onChange={(e) => {
                    const updated = layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, rotation: parseInt(e.target.value) } : l
                    );
                    updateLayersWithHistory(updated);
                  }}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                />

                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 pt-1">
                  <span>Opacity</span>
                  <span className="font-mono">
                    {Math.round((selectedLayer.opacity !== undefined ? selectedLayer.opacity : 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={selectedLayer.opacity !== undefined ? selectedLayer.opacity : 1}
                  onChange={(e) => {
                    const updated = layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, opacity: parseFloat(e.target.value) } : l
                    );
                    updateLayersWithHistory(updated);
                  }}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                />
              </div>
            </div>

            {/* Quick Alignment Actions */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Perataan (Align)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAlignCenterX}
                  className="flex items-center justify-center gap-1.5 p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700"
                  title="Ratakan Tengah Horizontal"
                >
                  <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                  <span>Tengah X</span>
                </button>
                <button
                  type="button"
                  onClick={handleAlignCenterY}
                  className="flex items-center justify-center gap-1.5 p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700"
                  title="Ratakan Tengah Vertikal"
                >
                  <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                  <span>Tengah Y</span>
                </button>
              </div>
            </div>

            {/* Stacking Order */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Urutan Tumpukan
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleBringForward}
                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Maju</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendBackward}
                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Mundur</span>
                </button>
                <button
                  type="button"
                  onClick={handleBringToFront}
                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                  <span>Paling Depan</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendToBack}
                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                  <span>Paling Belakang</span>
                </button>
              </div>
            </div>

            {/* Lock & Visibility Status */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleToggleLock(selectedLayer.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 mr-1 rounded-xl text-xs font-semibold border transition-all ${
                  selectedLayer.locked
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
              >
                {selectedLayer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{selectedLayer.locked ? 'Terkunci' : 'Kunci'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleHide(selectedLayer.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 ml-1 rounded-xl text-xs font-semibold border transition-all ${
                  selectedLayer.hidden
                    ? 'bg-zinc-800 text-white border-zinc-800'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
              >
                {selectedLayer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{selectedLayer.hidden ? 'Tersembunyi' : 'Sembunyikan'}</span>
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
