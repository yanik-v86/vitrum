import React, { useRef, useEffect, useCallback } from 'react';
import { getState, setState, subscribe, PatternIcon, PatternState } from '../store/useStore';

type DragMode = { mode: 'move'; id: string; ox: number; oy: number }
  | { mode: 'resize'; id: string; startDist: number; startSize: number }
  | { mode: 'rotate'; id: string; startAngle: number; startRot: number };

let interaction: DragMode | null = null;
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
  if (s.transparentBg) { drawChecker(ctx, 0, 0, w, h); return; }
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

// Hit-test helpers (all in canvas coords)
function hitResize(x: number, y: number, ic: PatternIcon): boolean {
  const rad = -(ic.rotation * Math.PI) / 180;
  const dx = x - ic.x, dy = y - ic.y;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  const half = ic.size / 2;
  return lx > half - 6 && lx < half + 10 && ly > half - 6 && ly < half + 10;
}

function hitRotate(x: number, y: number, ic: PatternIcon): boolean {
  const rad = -(ic.rotation * Math.PI) / 180;
  const dx = x - ic.x, dy = y - ic.y;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) < 10 && ly < -ic.size / 2 - 6 && ly > -ic.size / 2 - 28;
}

const colorCanvas = document.createElement('canvas');
const colorCtx = colorCanvas.getContext('2d')!;

// Fixed-stroke: patch stroke-width per target size, cache by size bucket
const fixedSvgCache = new Map<string, string>(); // key: src|bucket → patched SVG string
const fixedImgCache = new Map<string, HTMLImageElement>(); // key: src|bucket → Image

function getFixedStrokeImg(src: string, targetSize: number): HTMLImageElement {
  const bucket = Math.round(targetSize / 4) * 4; // round to nearest 4px
  const key = src + '|' + bucket;
  const cached = fixedImgCache.get(key);
  if (cached) return cached;

  // Decode and patch SVG: scale stroke-width inversely with size
  let svgText: string;
  if (src.startsWith('data:image/svg+xml;base64,')) {
    svgText = atob(src.split(',')[1]);
  } else {
    fixedImgCache.set(key, imgCache.get(src)!);
    return imgCache.get(src)!;
  }

  // viewBox is 24x24, original stroke-width is 2
  // At target size `bucket`, we want stroke to render as 2px
  // So stroke-width should be: 2 * 24 / bucket
  const scale = 24 / Math.max(bucket, 1);
  const newSw = Math.max(0.5, 2 * scale);

  const patched = svgText
    .replace(/stroke-width="[^"]*"/g, `stroke-width="${newSw.toFixed(2)}"`)
    .replace(/stroke-width='[^']*'/g, `stroke-width="${newSw.toFixed(2)}"`);

  const dataUrl = 'data:image/svg+xml;base64,' + btoa(patched);
  const i = new Image();
  i.src = dataUrl;
  fixedImgCache.set(key, i);
  return i;
}

function drawIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, ic: PatternIcon, s: PatternState) {
  ctx.save();
  ctx.globalAlpha = ic.opacity;
  ctx.translate(ic.x, ic.y);
  ctx.rotate((ic.rotation * Math.PI) / 180);
  const half = ic.size / 2;
  const drawImg = s.fixedStroke ? getFixedStrokeImg(img.src, ic.size) : img;
  if (s.useIconColor) {
    const w = Math.ceil(ic.size), h = Math.ceil(ic.size);
    if (colorCanvas.width !== w || colorCanvas.height !== h) { colorCanvas.width = w; colorCanvas.height = h; }
    colorCtx.clearRect(0, 0, w, h);
    colorCtx.drawImage(drawImg, 0, 0, w, h);
    colorCtx.globalCompositeOperation = 'source-in';
    colorCtx.fillStyle = s.iconColor;
    colorCtx.fillRect(0, 0, w, h);
    colorCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(colorCanvas, -half, -half);
  } else {
    ctx.drawImage(drawImg, -half, -half, ic.size, ic.size);
  }
  ctx.restore();
}

function drawChecker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const sz = 10;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let row = 0; row * sz < h; row++) {
    for (let col = 0; col * sz < w; col++) {
      ctx.fillStyle = ((col + row) % 2 === 0) ? '#cccccc' : '#ffffff';
      ctx.fillRect(x + col * sz, y + row * sz, sz, sz);
    }
  }
  ctx.restore();
}

function doRender(canvas: HTMLCanvasElement, vw: number, vh: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx || vw < 1 || vh < 1) return;
  if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
  ctx.clearRect(0, 0, vw, vh);

  const s = getState();
  const z = s.viewportZoom, cw = s.canvasWidth, ch = s.canvasHeight;
  const ox = (vw - cw * z) / 2, oy = (vh - ch * z) / 2;

  // 1) Build tile
  const tc = getTileCanvas(cw, ch);
  fillBg(tc, cw, ch, s);
  for (const ic of s.icons) {
    const img = imgCache.get(ic.dataUrl);
    if (!img) continue;
    drawIcon(tc, img, ic, s);
  }

  // 2) Tile viewport by drawing the tile in a grid (avoids createPattern ghosting)
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(z, z);
  const startX = Math.floor(-ox / z / cw) * cw;
  const startY = Math.floor(-oy / z / ch) * ch;
  const endX = startX + Math.ceil(vw / z / cw) * cw + cw;
  const endY = startY + Math.ceil(vh / z / ch) * ch + ch;
  for (let ty = startY; ty < endY; ty += ch) {
    for (let tx = startX; tx < endX; tx += cw) {
      ctx.drawImage(tileCanvas!, tx, ty);
    }
  }
  ctx.restore();

  // 3) Selection rings + handles
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(z, z);
  const sel = s.icons.find(ic => ic.id === s.selectedIconId);
  for (const ic of s.icons) {
    const isSel = ic.id === s.selectedIconId;
    ctx.save();
    ctx.translate(ic.x, ic.y);
    ctx.strokeStyle = isSel ? '#7c5cff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = isSel ? 2 / z : 1 / z;
    ctx.setLineDash(isSel ? [] : [4 / z, 4 / z]);
    ctx.beginPath();
    ctx.arc(0, 0, ic.size / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Handles for selected icon
    if (isSel) {
      const rad = (ic.rotation * Math.PI) / 180;
      const half = ic.size / 2;
      ctx.save();
      ctx.translate(ic.x, ic.y);
      ctx.rotate(rad);

      // Resize handle (bottom-right corner)
      const rhx = half, rhy = half;
      ctx.fillStyle = '#7c5cff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.arc(rhx, rhy, 5 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotate handle (top center, connected by line)
      const ryx = 0, ryy = -half - 16 / z;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(ryx, ryy);
      ctx.stroke();
      ctx.fillStyle = '#7c5cff';
      ctx.beginPath();
      ctx.arc(ryx, ryy, 5 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / z;
      ctx.stroke();

      ctx.restore();
    }
  }
  ctx.restore();

  // 4) Canvas border — dark outline + light inner for visibility on any background
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 1, oy - 1, cw * z + 2, ch * z + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, cw * z, ch * z);
}

export function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sz = useRef({ w: 800, h: 600 });
  const [, tick] = React.useState(0);

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
    redraw();
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => subscribe(() => {
    ensurePlacedIcons().then(redraw);
    redraw();
    tick(n => n + 1);
  }), [redraw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = getState();
        if (s.selectedIconId) {
          setState({ icons: s.icons.filter(ic => ic.id !== s.selectedIconId), selectedIconId: null });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // ── Coord conversion ──
  function toPat(cx: number, cy: number) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const s = getState(), z = s.viewportZoom;
    return { x: (cx - r.left - r.width / 2) / z + s.canvasWidth / 2, y: (cy - r.top - r.height / 2) / z + s.canvasHeight / 2 };
  }

  // ── Cursor tracking ──
  const updateCursor = useCallback((e: React.MouseEvent) => {
    if (interaction) return;
    const { x, y } = toPat(e.clientX, e.clientY);
    const s = getState();
    const el = wrapRef.current;
    if (!el) return;
    const sel = s.icons.find(ic => ic.id === s.selectedIconId);
    if (sel && hitResize(x, y, sel)) { el.style.cursor = 'nwse-resize'; return; }
    if (sel && hitRotate(x, y, sel)) { el.style.cursor = 'crosshair'; return; }
    for (let i = s.icons.length - 1; i >= 0; i--) {
      const ic = s.icons[i];
      if ((x - ic.x) ** 2 + (y - ic.y) ** 2 < (ic.size / 2 + 8) ** 2) { el.style.cursor = 'grab'; return; }
    }
    el.style.cursor = 'default';
  }, []);

  // ── Mouse handlers ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const s = getState();
    const d = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    setState({ viewportZoom: Math.round(Math.max(0.1, Math.min(5, s.viewportZoom + d)) * 100) / 100 });
  }, []);

  const md = useCallback((e: React.MouseEvent) => {
    const { x, y } = toPat(e.clientX, e.clientY);
    const s = getState();

    // Check resize handle on selected icon
    const sel = s.icons.find(ic => ic.id === s.selectedIconId);
    if (sel && hitResize(x, y, sel)) {
      const dx = x - sel.x, dy = y - sel.y;
      interaction = { mode: 'resize', id: sel.id, startDist: Math.hypot(dx, dy), startSize: sel.size };
      return;
    }
    // Check rotate handle on selected icon
    if (sel && hitRotate(x, y, sel)) {
      const angle = Math.atan2(y - sel.y, x - sel.x);
      interaction = { mode: 'rotate', id: sel.id, startAngle: angle, startRot: sel.rotation };
      return;
    }
    // Check icon body (pick topmost)
    for (let i = s.icons.length - 1; i >= 0; i--) {
      const ic = s.icons[i];
      if ((x - ic.x) ** 2 + (y - ic.y) ** 2 < (ic.size / 2 + 8) ** 2) {
        interaction = { mode: 'move', id: ic.id, ox: x - ic.x, oy: y - ic.y };
        setState({ selectedIconId: ic.id });
        if (wrapRef.current) wrapRef.current.style.cursor = 'grabbing';
        return;
      }
    }
    setState({ selectedIconId: null });
  }, []);

  const mm = useCallback((e: React.MouseEvent) => {
    const { x, y } = toPat(e.clientX, e.clientY);
    if (!interaction) { updateCursor(e); return; }

    if (interaction.mode === 'move') {
      setState({ icons: getState().icons.map(ic => ic.id === interaction!.id ? { ...ic, x: x - interaction!.ox, y: y - interaction!.oy } : ic) });
    } else if (interaction.mode === 'resize') {
      const ic = getState().icons.find(i => i.id === interaction!.id);
      if (ic) {
        const dx = x - ic.x, dy = y - ic.y;
        const dist = Math.hypot(dx, dy);
        const scale = dist / (interaction!.startDist || 1);
        const newSize = Math.max(8, Math.round(interaction!.startSize * scale));
        setState({ icons: getState().icons.map(i => i.id === interaction!.id ? { ...i, size: newSize } : i) });
      }
    } else if (interaction.mode === 'rotate') {
      const ic = getState().icons.find(i => i.id === interaction!.id);
      if (ic) {
        const angle = Math.atan2(y - ic.y, x - ic.x);
        const deg = ((angle - interaction!.startAngle) * 180) / Math.PI;
        const rot = Math.round(interaction!.startRot + deg);
        setState({ icons: getState().icons.map(i => i.id === interaction!.id ? { ...i, rotation: rot } : i) });
      }
    }
  }, [updateCursor]);

  const mu = useCallback(() => {
    interaction = null;
    if (wrapRef.current) wrapRef.current.style.cursor = 'default';
  }, []);

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
  const zoomPct = Math.round(s.viewportZoom * 100);
  return (
    <div className="canvas-area" ref={wrapRef} onWheel={handleWheel}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        onDrop={drop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onMouseDown={md} onMouseMove={mm} onMouseUp={mu} onMouseLeave={mu} />
      <div className="canvas-overlay">
        {s.canvasWidth}x{s.canvasHeight}
        {s.icons.length > 0 ? ` ${s.icons.length} icons` : 'Click an icon to place it'}
      </div>
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => { const z = getState().viewportZoom; setState({ viewportZoom: Math.round(Math.max(0.1, z - 0.1) * 100) / 100 }); }}>&minus;</button>
        <span className="zoom-label">{zoomPct}%</span>
        <button className="zoom-btn" onClick={() => { const z = getState().viewportZoom; setState({ viewportZoom: Math.round(Math.min(5, z + 0.1) * 100) / 100 }); }}>+</button>
        <button className="zoom-btn" onClick={() => setState({ viewportZoom: 1 })}>1:1</button>
        <button className="zoom-btn" onClick={() => {
          const st = getState();
          const areaW = window.innerWidth - 510;
          const areaH = window.innerHeight - 60;
          const fit = Math.min(1, areaW / st.canvasWidth, areaH / st.canvasHeight);
          setState({ viewportZoom: Math.round(fit * 100) / 100 });
        }}>Fit</button>
      </div>
    </div>
  );
}

async function ensurePlacedIcons() {
  const s = getState();
  for (const ic of s.icons) {
    if (!imgCache.has(ic.dataUrl)) {
      try { await loadImg(ic.dataUrl); } catch {}
    }
  }
}
