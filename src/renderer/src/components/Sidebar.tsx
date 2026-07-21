import React, { useCallback, useRef, useEffect } from 'react';
import { getState, setState, subscribe, PatternIcon } from '../store/useStore';

export function Sidebar() {
  const [, tick] = React.useState(0);
  React.useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  const s = getState();
  const selectedIcon = s.icons.find((ic) => ic.id === s.selectedIconId);

  const updateIcon = useCallback((id: string, patch: Partial<PatternIcon>) => {
    setState({ icons: getState().icons.map((ic) => ic.id === id ? { ...ic, ...patch } : ic) });
  }, []);

  return (
    <div className="sidebar">
      {/* Canvas Size */}
      <Section title="Canvas">
        <div className="control-row">
          <span className="control-label">W x H</span>
          <input type="number" value={s.canvasWidth} min={16} max={4096}
            onChange={(e) => setState({ canvasWidth: clamp(Number(e.target.value), 16, 4096) })} />
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>x</span>
          <input type="number" value={s.canvasHeight} min={16} max={4096}
            onChange={(e) => setState({ canvasHeight: clamp(Number(e.target.value), 16, 4096) })} />
        </div>
        <div className="control-row">
          <span className="control-label">Presets</span>
          <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1 }}>
            {[100, 300, 512, 1024].map((sz) => (
              <button key={sz} className="btn" style={{ height: 24, fontSize: 10, padding: '0 8px' }}
                onClick={() => setState({ canvasWidth: sz, canvasHeight: sz })}>
                {sz}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Background */}
      <Section title="Background">
        <div className="toggle-row">
          <span className="control-label">Gradient</span>
          <button className={`toggle ${s.useGradient ? 'active' : ''}`}
            onClick={() => setState({ useGradient: !s.useGradient })} />
        </div>
        <div className="toggle-row">
          <span className="control-label">Transparent</span>
          <button className={`toggle ${s.transparentBg ? 'active' : ''}`}
            onClick={() => setState({ transparentBg: !s.transparentBg })} />
        </div>

        {!s.transparentBg && !s.useGradient ? (
          <div className="control-row">
            <span className="control-label">Color</span>
            <div className="color-swatch" style={{ background: s.backgroundColor }}>
              <input type="color" value={s.backgroundColor}
                onChange={(e) => setState({ backgroundColor: e.target.value })} />
            </div>
          </div>
        ) : (!s.transparentBg && s.useGradient ? (
          <>
            <div className="control-row">
              <span className="control-label">Angle</span>
              <input type="range" min={0} max={360} value={s.gradientAngle}
                onChange={(e) => setState({ gradientAngle: Number(e.target.value) })} />
              <span className="control-value">{s.gradientAngle}&deg;</span>
            </div>
            <GradientEditor />
          </>
        ) : null)}
      </Section>

      {/* Pattern Icons */}
      <Section title="Pattern">
        <Slider label="Size" min={8} max={200} value={s.iconSize}
          onChange={(v) => setState({ iconSize: v })} />
        <Slider label="Spacing" min={16} max={300} value={s.iconSpacing}
          onChange={(v) => setState({ iconSpacing: v })} />
        <Slider label="Opacity" min={0} max={100} value={Math.round(s.iconOpacity * 100)}
          onChange={(v) => setState({ iconOpacity: v / 100 })} unit="%" />
        <Slider label="Rotation" min={-180} max={180} value={s.iconRotation}
          onChange={(v) => setState({ iconRotation: v })} unit="&deg;" />

        <div className="control-row">
          <span className="control-label">Icon Color</span>
          <div className="color-swatch" style={{ background: s.iconColor }}>
            <input type="color" value={s.iconColor}
              onChange={(e) => setState({ iconColor: e.target.value })} />
          </div>
          <button className={`toggle ${s.useIconColor ? 'active' : ''}`}
            onClick={() => setState({ useIconColor: !s.useIconColor })}
            style={{ marginLeft: 'auto' }} />
        </div>

        <PatternPreview />
      </Section>

      {/* Selected Icon */}
      {selectedIcon && (
        <Section title="Selected Icon">
          <Slider label="X" min={0} max={s.canvasWidth} value={Math.round(selectedIcon.x)}
            onChange={(v) => updateIcon(selectedIcon.id, { x: v })} />
          <Slider label="Y" min={0} max={s.canvasHeight} value={Math.round(selectedIcon.y)}
            onChange={(v) => updateIcon(selectedIcon.id, { y: v })} />
          <Slider label="Size" min={8} max={300} value={selectedIcon.size}
            onChange={(v) => updateIcon(selectedIcon.id, { size: v })} />
          <Slider label="Rotation" min={-180} max={180} value={selectedIcon.rotation}
            onChange={(v) => updateIcon(selectedIcon.id, { rotation: v })} unit="&deg;" />
          <Slider label="Opacity" min={0} max={100} value={Math.round(selectedIcon.opacity * 100)}
            onChange={(v) => updateIcon(selectedIcon.id, { opacity: v / 100 })} unit="%" />
          <button className="btn btn-full btn-danger"
            onClick={() => setState({ icons: getState().icons.filter((ic) => ic.id !== selectedIcon.id), selectedIconId: null })}>
            Remove Icon
          </button>
        </Section>
      )}

      {/* Export */}
      <Section title="Export">
        <button className="btn btn-primary btn-full" onClick={handleExport}>Download PNG</button>
        <button className="btn btn-full" onClick={handleExportTile}>Download Tile</button>
      </Section>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, min, max, value, onChange, unit = '' }: {
  label: string; min: number; max: number; value: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="control-value">{value}{unit}</span>
    </div>
  );
}

function GradientEditor() {
  const s = getState();

  const updateStop = (i: number, patch: Partial<{ color: string; position: number }>) => {
    const stops = [...s.backgroundGradient];
    stops[i] = { ...stops[i], ...patch };
    setState({ backgroundGradient: stops });
  };

  const addStop = () => {
    const stops = [...s.backgroundGradient, { color: '#ffffff', position: 50 }];
    stops.sort((a, b) => a.position - b.position);
    setState({ backgroundGradient: stops });
  };

  const removeStop = (i: number) => {
    if (s.backgroundGradient.length <= 2) return;
    setState({ backgroundGradient: s.backgroundGradient.filter((_, idx) => idx !== i) });
  };

  const css = `linear-gradient(${s.gradientAngle}deg, ${s.backgroundGradient.map((st) => `${st.color} ${st.position}%`).join(', ')})`;

  return (
    <div className="gradient-stops">
      <div className="gradient-preview" style={{ background: css }} />
      {s.backgroundGradient.map((stop, i) => (
        <div key={i} className="gradient-stop">
          <div className="color-swatch" style={{ background: stop.color, width: 22, height: 22, flexShrink: 0 }}>
            <input type="color" value={stop.color}
              onChange={(e) => updateStop(i, { color: e.target.value })} />
          </div>
          <input type="range" min={0} max={100} value={stop.position}
            onChange={(e) => updateStop(i, { position: Number(e.target.value) })} style={{ flex: 1 }} />
          <span className="control-value">{stop.position}%</span>
          {s.backgroundGradient.length > 2 && (
            <button className="pack-item-delete" onClick={() => removeStop(i)}>&times;</button>
          )}
        </div>
      ))}
      <button className="btn btn-full" onClick={addStop}>+ Add Stop</button>
    </div>
  );
}

/* ── Export helpers ── */

const exportImgCache = new Map<string, HTMLImageElement>();

function loadExportImg(src: string): Promise<HTMLImageElement> {
  const cached = exportImgCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => { exportImgCache.set(src, i); ok(i); };
    i.src = src;
  });
}

function renderPattern(w: number, h: number): HTMLCanvasElement {
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext('2d')!;
  const s = getState();

  // Background
  if (!s.transparentBg) {
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

  // Icons
  for (const ic of s.icons) {
    const img = exportImgCache.get(ic.dataUrl);
    if (!img) continue;
    ctx.save();
    ctx.globalAlpha = ic.opacity;
    ctx.translate(ic.x, ic.y);
    ctx.rotate((ic.rotation * Math.PI) / 180);
    const half = ic.size / 2;
    if (s.useIconColor) {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = ic.size; colorCanvas.height = ic.size;
      const cc = colorCanvas.getContext('2d')!;
      cc.drawImage(img, 0, 0, ic.size, ic.size);
      cc.globalCompositeOperation = 'source-in';
      cc.fillStyle = s.iconColor;
      cc.fillRect(0, 0, ic.size, ic.size);
      ctx.drawImage(colorCanvas, -half, -half);
    } else {
      ctx.drawImage(img, -half, -half, ic.size, ic.size);
    }
    ctx.restore();
  }
  return tmp;
}

function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  const dataUrl = canvas.toDataURL('image/png');
  (window as any).electronAPI?.savePng(dataUrl, name);
}

async function handleExport() {
  const s = getState();
  // Preload all icon images
  await Promise.all(s.icons.map(ic => loadExportImg(ic.dataUrl)));
  const canvas = renderPattern(s.canvasWidth, s.canvasHeight);
  downloadCanvas(canvas, 'pattern.png');
}

async function handleExportTile() {
  const s = getState();
  await Promise.all(s.icons.map(ic => loadExportImg(ic.dataUrl)));
  const canvas = renderPattern(s.canvasWidth, s.canvasHeight);
  downloadCanvas(canvas, 'pattern-tile.png');
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v || min)); }

const previewImgCache = new Map<string, HTMLImageElement>();

function PatternPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, tick] = React.useState(0);

  useEffect(() => subscribe(() => tick(n => n + 1)), []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = getState();
    const w = 120, h = 120;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }

    // Checkerboard background
    const sz = 10;
    for (let y = 0; y < h; y += sz) {
      for (let x = 0; x < w; x += sz) {
        ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#1a1a2e' : '#16162a';
        ctx.fillRect(x, y, sz, sz);
      }
    }

    // Draw first available icon with current pattern settings
    if (s.availableIcons.length === 0) return;
    const du = s.availableIcons[0].dataUrl;
    let img = previewImgCache.get(du);
    if (!img) {
      img = new Image();
      img.onload = () => { previewImgCache.set(du, img!); tick(n => n + 1); };
      img.src = du;
      return;
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((s.iconRotation * Math.PI) / 180);
    ctx.globalAlpha = s.iconOpacity;
    const half = s.iconSize / 2;
    if (s.useIconColor) {
      // Recolor on temp canvas
      const tmp = document.createElement('canvas');
      tmp.width = s.iconSize; tmp.height = s.iconSize;
      const tc = tmp.getContext('2d')!;
      tc.drawImage(img, 0, 0, s.iconSize, s.iconSize);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = s.iconColor;
      tc.fillRect(0, 0, s.iconSize, s.iconSize);
      ctx.drawImage(tmp, -half, -half);
    } else {
      ctx.drawImage(img, -half, -half, s.iconSize, s.iconSize);
    }
    ctx.restore();
  });

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Preview</div>
      <canvas ref={canvasRef} style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }} />
    </div>
  );
}
