// atomStore.js - Central state management with Jotai atoms
import { atom } from "jotai";

// Grid and Hex state
export const hexesAtom = atom([]);
export const hexGridSizeAtom = atom(9);
export const isPathCreationModeAtom = atom(false);

// Audio state
export const isAudioPlayingAtom = atom(false);
export const bpmAtom = atom(130);
export const samplesPendingLoadAtom = atom(0);
export const samplesLoadedAtom = atom(0);
export const isLoadingSamplesAtom = atom(true);

// Effect randomization state is now stored per-path in path objects
// No global randomization atom needed

// Path and pattern state
export const pathsAtom = atom([]); // [{ id, path: [{ q, r }, ...] }]
export const branchesAtom = atom([]); // [{ id, parentPathId, effect, effectConfig, branch }]
export const draftPathAtom = atom([]);
export const effectDraftPathAtom = atom([]);
export const currentIndicesAtom = atom({});

// Selection state
export const selectedSampleAtom = atom({ name: null, click: 0 });
export const selectedEffectAtom = atom({ type: null, name: null });
export const dragPreviewAtom = atom({ show: false, x: 0, y: 0 });

// Sample management
export const userSamplesAtom = atom([]);

// UI State
export const mobilePanelOpenAtom = atom(false);
export const libraryLoadingAtom = atom(false);
export const activeSamplesTabAtom = atom("default");
export const showLibraryAtom = atom(false);
export const isRecordingAtom = atom(false);
export const isRecordingArmedAtom = atom(false);
export const loadingProgressAtom = atom({ loaded: 0, total: 0 });

// Guide state
export const guideStepAtom = atom(1);
export const guideVisibleAtom = atom(true);
export const guideTargetRefsAtom = atom({
  firstHex: null,
  mainHex: null,
  effectDraft: null,
  pathHex: null,
  samplePanel: null,
  playButton: null,
  effectPanel: null,
  pathEnd: null,
});

// Constants
export const SVG_WIDTH = 800;
export const SVG_HEIGHT = 800;
export const HEX_RADIUS = 24;

// Predefined ring hexes
export const predefinedCenterRingHexes = [
  { q: 0, r: 1 },
  { q: 1, r: 0 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export const predefinedOuterRing = [
  { q: 2, r: 0 },
  { q: 2, r: -1 },
  { q: 1, r: -2 },
  { q: 0, r: -2 },
  { q: -1, r: -1 },
  { q: -2, r: 0 },
  { q: -2, r: 1 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
  { q: 1, r: 1 },
  { q: 2, r: -2 },
];
