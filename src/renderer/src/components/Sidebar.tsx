import React, { useCallback } from 'react';
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

      {/* Viewport Zoom */}
      <Section title="Zoom">
        <Slider label="Scale" min={10} max={500} value={Math.round(s.viewportZoom * 100)}
          onChange={(v) => setState({ viewportZoom: v / 100 })} unit="%" />
        <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1 }}>
          <button className="btn" style={{ height: 24, fontSize: 10, flex: 1 }}
            onClick={() => setState({ viewportZoom: 1 })}>100%</button>
          <button className="btn" style={{ height: 24, fontSize: 10, flex: 1 }}
            onClick={() => setState({ viewportZoom: 2 })}>200%</button>
          <button className="btn" style={{ height: 24, fontSize: 10, flex: 1 }}
            onClick={() => {
              const st = getState();
              // Fit to viewport
              const areaW = window.innerWidth - 510;
              const areaH = window.innerHeight - 60;
              const fit = Math.min(1, areaW / st.canvasWidth, areaH / st.canvasHeight);
              setState({ viewportZoom: Math.round(fit * 100) / 100 });
            }}>Fit</button>
        </div>
      </Section>

      {/* Background */}
      <Section title="Background">
        <div className="toggle-row">
          <span className="control-label">Gradient</span>
          <button className={`toggle ${s.useGradient ? 'active' : ''}`}
            onClick={() => setState({ useGradient: !s.useGradient })} />
        </div>

        {!s.useGradient ? (
          <div className="control-row">
            <span className="control-label">Color</span>
            <div className="color-swatch" style={{ background: s.backgroundColor }}>
              <input type="color" value={s.backgroundColor}
                onChange={(e) => setState({ backgroundColor: e.target.value })} />
            </div>
          </div>
        ) : (
          <>
            <div className="control-row">
              <span className="control-label">Angle</span>
              <input type="range" min={0} max={360} value={s.gradientAngle}
                onChange={(e) => setState({ gradientAngle: Number(e.target.value) })} />
              <span className="control-value">{s.gradientAngle}&deg;</span>
            </div>
            <GradientEditor />
          </>
        )}
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

function handleExport() {
  const canvas = document.querySelector('.pattern-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'pattern.png';
  a.click();
}

function handleExportTile() {
  const canvas = document.querySelector('.pattern-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const s = getState();
  const tileSize = s.iconSpacing * 2;
  const tmp = document.createElement('canvas');
  tmp.width = tileSize;
  tmp.height = tileSize;
  const ctx = tmp.getContext('2d')!;
  // Draw a section from the center of the canvas
  const cx = canvas.width / 2 - tileSize / 2;
  const cy = canvas.height / 2 - tileSize / 2;
  ctx.drawImage(canvas, cx, cy, tileSize, tileSize, 0, 0, tileSize, tileSize);
  const a = document.createElement('a');
  a.href = tmp.toDataURL('image/png');
  a.download = 'pattern-tile.png';
  a.click();
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v || min)); }
