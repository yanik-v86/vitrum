import React, { useCallback, useState, useRef } from 'react';
import { getState, setState, subscribe, IconPack } from '../store/useStore';

const BATCH = 80;

export function IconPicker() {
  const [, tick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [packName, setPackName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(BATCH);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => subscribe(() => tick(n => n + 1)), []);
  React.useEffect(() => { setVisible(BATCH); }, [getState().activePack]);

  // Auto-load defaults + all saved packs
  React.useEffect(() => {
    if (loaded) return;
    (async () => {
      try {
        const [defs, savedPacks] = await Promise.all([
          window.electronAPI.loadDefaultIcons(),
          window.electronAPI.loadPacks(),
        ]);
        const allPacks = [...defs];
        // Merge saved packs — skip duplicates that already exist in defaults
        for (const sp of savedPacks) {
          if (!allPacks.find(p => p.name === sp.name)) {
            allPacks.push(sp);
          }
        }
        setState({ packs: allPacks });
        const first = defs.find(p => p.name === 'lucide') || defs[0];
        if (first) setState({ activePack: first.name, availableIcons: first.icons });
      } catch {}
      setLoaded(true);
    })();
  }, [loaded]);

  const s = getState();
  const total = s.availableIcons.length;
  const vis = s.availableIcons.slice(0, Math.min(visible, total));

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisible(v => Math.min(v + BATCH, total));
    }
  }, [total]);

  const importFolder = useCallback(async () => {
    const folder = await window.electronAPI.openFolder();
    if (!folder) return;
    setLoading(true);
    try {
      const files = await window.electronAPI.readFolder(folder);
      const icons: { name: string; dataUrl: string }[] = [];
      for (const f of files) {
        try {
          const du = await window.electronAPI.readFileAsDataUrl(f.path);
          if (du) icons.push({ name: f.name, dataUrl: du });
        } catch {}
      }
      if (icons.length > 0) {
        setState({ availableIcons: icons, activePack: 'Imported' });
        setVisible(BATCH);
        // Auto-save as "Imported" pack
        try {
          await window.electronAPI.savePack({ name: 'Imported', icons });
          setState({ packs: [...getState().packs.filter((p: any) => p.name !== 'Imported'), { name: 'Imported', icons }] });
        } catch {}
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const importFiles = useCallback(async () => {
    const files = await window.electronAPI.openFiles();
    if (!files) return;
    setLoading(true);
    try {
      const icons: { name: string; dataUrl: string }[] = [];
      for (const fp of files) {
        try {
          const du = await window.electronAPI.readFileAsDataUrl(fp);
          if (du) icons.push({ name: fp.split('/').pop() || 'icon', dataUrl: du });
        } catch {}
      }
      if (icons.length > 0) {
        setState({ availableIcons: icons, activePack: 'Imported' });
        setVisible(BATCH);
        // Auto-save as "Imported" pack
        try {
          await window.electronAPI.savePack({ name: 'Imported', icons });
          setState({ packs: [...getState().packs.filter((p: any) => p.name !== 'Imported'), { name: 'Imported', icons }] });
        } catch {}
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const savePack = useCallback(async () => {
    if (total === 0 || !packName.trim()) return;
    try {
      await window.electronAPI.savePack({ name: packName.trim(), icons: getState().availableIcons });
    } catch {}
    try {
      setState({ packs: await window.electronAPI.loadPacks() });
    } catch {}
    setPackName('');
  }, [packName, total]);

  const selectPack = useCallback((pack: IconPack) => {
    setState({ activePack: pack.name, availableIcons: pack.icons });
  }, []);

  const addIcon = useCallback((icon: { name: string; dataUrl: string }) => {
    const st = getState();
    const ic = {
      id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: icon.name, dataUrl: icon.dataUrl,
      x: st.canvasWidth / 2, y: st.canvasHeight / 2,
      size: st.iconSize, rotation: st.iconRotation, opacity: st.iconOpacity,
    };
    setState({ icons: [...st.icons, ic], selectedIconId: ic.id });
  }, []);

  return (
    <div className="icon-picker">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Import</div>
        <button className="btn btn-full" onClick={importFolder} disabled={loading}>
          {loading ? <span className="loading-spinner" /> : 'Import Folder'}
        </button>
        <button className="btn btn-full" onClick={importFiles} disabled={loading}>
          {loading ? <span className="loading-spinner" /> : 'Import Files'}
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Icon Packs</div>
        <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1 }}>
          <input type="text" placeholder="Pack name..." value={packName}
            onChange={e => setPackName(e.target.value)}
            style={{ flex: 1, height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#f0f0f0', fontSize: 11, outline: 'none' }} />
          <button className="btn" style={{ height: 28, fontSize: 10, padding: '0 8px' }}
            onClick={savePack} disabled={total === 0 || !packName.trim()}>Save</button>
        </div>
        {s.packs.length > 0 && (
          <div className="packs-scroll">
            {s.packs.map(pack => (
              <div key={pack.name} className={`pack-item ${s.activePack === pack.name ? 'active' : ''}`}
                onClick={() => selectPack(pack)}>
                <div>
                  <div className="pack-item-name">{pack.name}</div>
                  <div className="pack-item-count">{pack.icons.length} icons</div>
                </div>
                <button className="pack-item-delete" onClick={async (e) => {
                  e.stopPropagation();
                  try { await window.electronAPI.deletePack(pack.name); } catch {}
                  const packs = s.packs.filter(p => p.name !== pack.name);
                  setState({ packs, ...(s.activePack === pack.name ? { activePack: null, availableIcons: [] } : {}) });
                }}>&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-section" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-section-title">
          {s.activePack ? `${s.activePack} (${total})` : total > 0 ? `Imported (${total})` : 'Icons'}
        </div>
        {total === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#9733;</div>
            {loaded ? 'Import a folder of icons or select a pack' : 'Loading...'}
          </div>
        ) : (
          <div ref={scrollRef} onScroll={onScroll} className="icon-grid-scroll">
            <div className="icon-grid">
              {vis.map((icon, i) => (
                <div key={`${icon.name}-${i}`} className="icon-item"
                  draggable onDragStart={e => { e.dataTransfer.setData('application/json', JSON.stringify(icon)); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => addIcon(icon)}>
                  <img src={icon.dataUrl} alt={icon.name} draggable={false} loading="lazy" />
                  <button className="icon-item-delete" onClick={(e) => {
                    e.stopPropagation();
                    const all = s.availableIcons.filter((_, idx) => {
                      // Find the index in the full array
                      const globalIdx = s.availableIcons.indexOf(icon);
                      return idx !== globalIdx;
                    });
                    // Actually filter by reference
                    const newIcons = s.availableIcons.filter(ic => ic !== icon);
                    setState({ availableIcons: newIcons });
                  }}>&times;</button>
                </div>
              ))}
            </div>
            {visible < total && (
              <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {visible} / {total}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
