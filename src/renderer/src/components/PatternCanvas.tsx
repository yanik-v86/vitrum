import React, { useRef, useEffect, useCallback } from 'react';
import { getState, setState, subscribe, PatternIcon, PatternState } from '../store/useStore';

let drag: { id: string; ox: number; oy: number } | null = null;
const imgCache = new Map<string, HTMLImageElement>();

function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => { imgCache.set(src, i); ok(i); };
    i.onerror = () => fail(Error('img'));
    i.src = src;
  });
}

function fillBg(ctx: CanvasRenderingContext2D, w: number, h: number, s: PatternState) {
  if (s.useGradient && s.backgroundGradient.length >= 2) {
    const rad = (s.gradientAngle * Math.PI) / 180;
    const len = Math.max(w, h) * 1.5;
    const g = ctx.createLinearGradient(
      w / 2 - Math.cos(rad) * len, h / 2 - Math.sin(rad) * len,
      w / 2 + Math.cos(rad) * len, h / 2 + Math.sin(rad) * len
    );
    s.backgroundGradient.forEach(st => g.addColorStop(Math.max(0, Math.min(1, st.position / 100)), st.color));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = s.backgroundColor;
  }
  ctx.fillRect(0, 0, w, h);
}

// Offscreen canvas for building one tile
let tileCanvas: HTMLCanvasElement | null = null;
let tileCtx: CanvasRenderingContext2D | null = null;

function getTileCanvas(w: number, h: number) {
  if (!tileCanvas) { tileCanvas = document.createElement('canvas'); tileCtx = tileCanvas.getContext('2d'); }
  if (tileCanvas.width !== w || tileCanvas.height !== h) { tileCanvas.width = w; tileCanvas.height = h; }
  return tileCtx!;
}

function doRender(canvas: HTMLCanvasElement, vw: number, vh: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || vw < 1 || vh < 1) return;
  if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }

  const s = getState();
  const z = s.viewportZoom, cw = s.canvasWidth, ch = s.canvasHeight;
  const ox = (vw - cw * z) / 2, oy = (vh - ch * z) / 2;

  // 1) Build tile: background + icons on offscreen canvas
  const tc = getTileCanvas(cw, ch);
  fillBg(tc, cw, ch, s);
  for (const ic of s.icons) {
    const img = imgCache.get(ic.dataUrl);
    if (!img) continue;
    tc.save();
    tc.globalAlpha = ic.opacity;
    tc.translate(ic.x, ic.y);
    tc.rotate((ic.rotation * Math.PI) / 180);
    tc.drawImage(img, -ic.size / 2, -ic.size / 2, ic.size, ic.size);
    tc.restore();
  }

  // 2) Tile the viewport
  const pat = ctx.createPattern(tileCanvas!, 'repeat');
  if (pat) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(z, z);
    ctx.fillStyle = pat;
    ctx.fillRect(-ox / z, -oy / z, vw / z, vh / z);
    ctx.restore();
  }

  // 3) Draw the editing canvas on top with selection rings
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(z, z);
  for (const ic of s.icons) {
    ctx.save();
    ctx.translate(ic.x, ic.y);
    ctx.strokeStyle = ic.id === s.selectedIconId ? '#7c5cff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = ic.id === s.selectedIconId ? 2 / z : 1 / z;
    ctx.setLineDash(ic.id === s.selectedIconId ? [] : [4 / z, 4 / z]);
    ctx.beginPath();
    ctx.arc(0, 0, ic.size / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();

  // 4) Canvas border
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, cw * z, ch * z);
}

export function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sz = useRef({ w: 800, h: 600 });

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (c) doRender(c, sz.current.w, sz.current.h);
  }, []);

  // ResizeObserver + immediate first render
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.ceil(e.contentRect.width), h = Math.ceil(e.contentRect.height);
        if (w > 0 && h > 0) { sz.current = { w, h }; redraw(); }
      }
    });
    ro.observe(el);
    // Force an immediate render so the canvas is never blank
    redraw();
    return () => ro.disconnect();
  }, [redraw]);

  // Subscribe to all state changes
  useEffect(() => subscribe(() => {
    ensurePlacedIcons().then(redraw);
    redraw();
  }), [redraw]);

  // Load placed icon images on an interval
  useEffect(() => {
    const interval = setInterval(() => {
      const s = getState();
      for (const ic of s.icons) {
        if (!imgCache.has(ic.dataUrl)) {
          loadImg(ic.dataUrl).then(redraw).catch(() => {});
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [redraw]);

  // ── Input handlers ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const s = getState();
    const d = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    setState({ viewportZoom: Math.round(Math.max(0.1, Math.min(5, s.viewportZoom + d)) * 100) / 100 });
  }, []);

  function toPat(cx: number, cy: number) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const s = getState(), z = s.viewportZoom;
    return { x: (cx - r.left - r.width / 2) / z + s.canvasWidth / 2, y: (cy - r.top - r.height / 2) / z + s.canvasHeight / 2 };
  }

  const md = useCallback((e: React.MouseEvent) => {
    const { x, y } = toPat(e.clientX, e.clientY);
    for (let i = getState().icons.length - 1; i >= 0; i--) {
      const ic = getState().icons[i];
      if ((x - ic.x) ** 2 + (y - ic.y) ** 2 < (ic.size / 2 + 8) ** 2) {
        drag = { id: ic.id, ox: x - ic.x, oy: y - ic.y };
        setState({ selectedIconId: ic.id });
        return;
      }
    }
    setState({ selectedIconId: null });
  }, []);

  const mm = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const { x, y } = toPat(e.clientX, e.clientY);
    setState({ icons: getState().icons.map(ic => ic.id === drag!.id ? { ...ic, x: x - drag!.ox, y: y - drag!.oy } : ic) });
  }, []);

  const mu = useCallback(() => { drag = null; }, []);

  const drop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const d = JSON.parse(e.dataTransfer.getData('application/json'));
      const { x, y } = toPat(e.clientX, e.clientY);
      const st = getState();
      const ic: PatternIcon = {
        id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: d.name, dataUrl: d.dataUrl, x, y,
        size: st.iconSize, rotation: st.iconRotation, opacity: st.iconOpacity,
      };
      setState({ icons: [...st.icons, ic], selectedIconId: ic.id });
    } catch {}
  }, []);

  const s = getState();
  return (
    <div className="canvas-area" ref={wrapRef} onWheel={handleWheel}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        onDrop={drop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onMouseDown={md} onMouseMove={mm} onMouseUp={mu} onMouseLeave={mu} />
      <div className="canvas-overlay">
        {s.canvasWidth}x{s.canvasHeight} {Math.round(s.viewportZoom * 100)}%
        {s.icons.length > 0 ? ` ${s.icons.length} icons` : 'Click an icon to place it'}
      </div>
    </div>
  );
}

// Helper to ensure placed icons are loaded
async function ensurePlacedIcons() {
  const s = getState();
  for (const ic of s.icons) {
    if (!imgCache.has(ic.dataUrl)) {
      try { await loadImg(ic.dataUrl); } catch {}
    }
  }
}
