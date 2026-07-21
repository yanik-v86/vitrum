export interface PatternIcon {
  id: string; name: string; dataUrl: string;
  x: number; y: number; size: number; rotation: number; opacity: number;
}
export interface GradientStop { color: string; position: number; }
export interface IconPack { name: string; icons: { name: string; dataUrl: string }[]; }

export interface PatternState {
  icons: PatternIcon[];
  selectedIconId: string | null;
  backgroundColor: string;
  backgroundGradient: GradientStop[];
  gradientAngle: number;
  useGradient: boolean;
  canvasWidth: number; canvasHeight: number;
  iconSpacing: number; iconOpacity: number; iconSize: number;
  iconColor: string; useIconColor: boolean; iconRotation: number;
  packs: IconPack[];
  activePack: string | null;
  availableIcons: { name: string; dataUrl: string }[];
  viewportZoom: number;
}

export const defaultState: PatternState = {
  icons: [], selectedIconId: null,
  backgroundColor: '#f5c518',
  backgroundGradient: [{ color: '#f5c518', position: 0 }, { color: '#e6b800', position: 100 }],
  gradientAngle: 135, useGradient: false,
  canvasWidth: 300, canvasHeight: 300,
  iconSpacing: 60, iconOpacity: 0.5, iconSize: 32,
  iconColor: '#ffffff', useIconColor: true, iconRotation: 0,
  packs: [], activePack: null, availableIcons: [],
  viewportZoom: 1,
};

let state = { ...defaultState };
const listeners: (() => void)[] = [];
export function getState() { return state; }
export function setState(p: Partial<PatternState>) { state = { ...state, ...p }; listeners.forEach(l => l()); }
export function subscribe(l: () => void) { listeners.push(l); return () => { const i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); }; }
