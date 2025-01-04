// App.jsx

import React, { useEffect, useRef, useState, useMemo } from "react";
import { atom, useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import * as Tone from "tone";
import p5 from "p5";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { openDB } from "idb";

import {
  FaPlay,
  FaPause,
  FaMicrophone,
  FaMicrophoneSlash,
  FaStop,
} from "react-icons/fa";

// Utility functions for hexagon calculations (keep as-is, or from separate file)
import {
  generateHexPoints,
  axialToPixel,
  getHexNeighbours,
  hexDistance,
  findShortestPath,
  updateHexProperties,
  getPathEdges,
  areCoordinatesEqual,
  pathEdgeFromPath,
  branchEdgeFromBranch,
} from "./hexUtils";

// p5.js overlay (unchanged, just imported)
import P5Overlay from "./P5Overlay";

// Import your newly separated components
import Controls from "./Controls";
import HexGrid from "./Grid";

// -------------------------------------------
//  Sample Assets, Mappings, and Effect Store
// -------------------------------------------

// You already had older sample lines commented out;
// keep or remove them as needed.
// Here, keep the current store:

import cymbal1 from "./assets/samples/Cymbal-1.wav";
import cymbal2 from "./assets/samples/Cymbal-2.wav";
import hat1 from "./assets/samples/Hat-1.wav";
import hat2 from "./assets/samples/Hat-2.wav";
import kick1 from "./assets/samples/Kick-1.wav";
import kick2 from "./assets/samples/Kick-2.wav";
import pad1 from "./assets/samples/Pad-1.wav";
import pad2 from "./assets/samples/Pad-2.wav";
import pad3 from "./assets/samples/Pad-3.wav";
import pad4 from "./assets/samples/Pad-4.wav";
import rim1 from "./assets/samples/Rim-1.wav";
import rim2 from "./assets/samples/Rim-2.wav";
import snare1 from "./assets/samples/Snare-1.wav";
import snare2 from "./assets/samples/Snare-2.wav";
import snare3 from "./assets/samples/Snare-3.wav";
import sweep1 from "./assets/samples/Sweep-1.wav";
import sweep2 from "./assets/samples/Sweep-2.wav";
import sweep3 from "./assets/samples/Sweep-3.wav";

// Sample store
export const sampleStore = [
  { name: "Kick-1", url: kick1 },
  { name: "Kick-2", url: kick2 },
  { name: "Hat-1", url: hat1 },
  { name: "Hat-2", url: hat2 },
  { name: "Snare-1", url: snare1 },
  { name: "Snare-2", url: snare2 },
  { name: "Snare-3", url: snare3 },
  { name: "Rim-1", url: rim1 },
  { name: "Rim-2", url: rim2 },
  { name: "Cymbal-1", url: cymbal1 },
  { name: "Cymbal-2", url: cymbal2 },
  { name: "Pad-1", url: pad1 },
  { name: "Pad-2", url: pad2 },
  { name: "Pad-3", url: pad3 },
  { name: "Pad-4", url: pad4 },
  { name: "Sweep-1", url: sweep1 },
  { name: "Sweep-2", url: sweep2 },
  { name: "Sweep-3", url: sweep3 },
];

// Mapping samples to notes
export const sampleToNoteMap = {
  "Cymbal-1": "C4",
  "Cymbal-2": "C#4",
  "Hat-1": "D4",
  "Hat-2": "D#4",
  "Kick-1": "E4",
  "Kick-2": "F4",
  "Pad-1": "F#4",
  "Pad-2": "G4",
  "Pad-3": "G#4",
  "Pad-4": "A4",
  "Rim-1": "A#4",
  "Rim-2": "B4",
  "Snare-1": "C5",
  "Snare-2": "C#5",
  "Snare-3": "D5",
  "Sweep-1": "D#5",
  "Sweep-2": "E5",
  "Sweep-3": "F5",
};

// Effect store
export const effectStore = [
  {
    type: "fx",
    name: "Reverb",
    config: {
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "AutoFilter",
    config: {
      frequency: { value: 1, default: 1 },
      depth: { value: 1, default: 1 },
      baseFrequency: { value: 200, default: 200 },
      octaves: { value: 2.6, default: 2.6 },
    },
  },
  {
    type: "fx",
    name: "AutoWah",
    config: {
      baseFrequency: { value: 100, default: 100 },
      octaves: { value: 6, default: 6 },
      sensitivity: { value: 0, default: 0 },
      Q: { value: 2, default: 2 },
      gain: { value: 2, default: 2 },
    },
  },
  {
    type: "fx",
    name: "BitCrusher",
    config: {
      bits: { value: 4, default: 4 },
    },
  },
  {
    type: "fx",
    name: "Chorus",
    config: {
      frequency: { value: 1.5, default: 1.5 },
      delayTime: { value: 3.5, default: 3.5 },
      depth: { value: 0.7, default: 0.7 },
      feedback: { value: 0.1, default: 0.1 },
      spread: { value: 180, default: 180 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "Distortion",
    config: {
      distortion: { value: 0.4, default: 0.4 },
    },
  },
  {
    type: "fx",
    name: "FeedbackDelay",
    config: {
      delayTime: { value: 0.25, default: 0.25 },
      feedback: { value: 0.5, default: 0.5 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "FrequencyShifter",
    config: {
      frequency: { value: 42, default: 42 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "Phaser",
    config: {
      frequency: { value: 0.5, default: 0.5 },
      octaves: { value: 3, default: 3 },
      stages: { value: 10, default: 10 },
      Q: { value: 10, default: 10 },
      baseFrequency: { value: 350, default: 350 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "PingPongDelay",
    config: {
      delayTime: { value: 0.25, default: 0.25 },
      feedback: { value: 0.3, default: 0.3 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "fx",
    name: "PitchShift",
    config: {
      pitch: { value: 0, default: 0 },
      windowSize: { value: 0.1, default: 0.1 },
      delayTime: { value: 0, default: 0 },
      feedback: { value: 0, default: 0 },
      wet: { value: 0.5, default: 0.5 },
    },
  },
  {
    type: "utility",
    name: "Offset",
    config: {
      amount: { value: 0, default: 0 },
    },
  },
  {
    type: "utility",
    name: "Speed",
    config: {
      rate: {
        value: 1,
        default: 1,
        options: [
          { value: "4", label: "÷4" },
          { value: "2", label: "÷2" },
          { value: "1", label: "Normal" },
          { value: "0.5", label: "×2" },
          { value: "0.25", label: "×4" },
        ],
      },
    },
  },
];

// -------------------
//   Global Constants
// -------------------

export const SVG_WIDTH = 800;
export const SVG_HEIGHT = 800;
export const HEX_RADIUS = 18;

// ---------------------
//   Jotai Global State
// ---------------------

export const hexesAtom = atom([]);
export const isAudioPlayingAtom = atom(false);
export const hexGridSizeAtom = atom(12);
export const bpmAtom = atom(130);
export const draftPathAtom = atom([]);
export const pathsAtom = atom([]); // [{ id, path: [{ q, r }, ...] }]
export const branchesAtom = atom([]); // [{ id, parentPathId, effect, effectConfig, branch }]
export const currentIndicesAtom = atom({});
export const selectedSampleAtom = atom({ name: null, click: 0 });
export const selectedEffectAtom = atom({ type: null, name: null });
export const effectDraftPathAtom = atom([]);
export const userSamplesAtom = atom([]);

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

// ------------------------------------------
//   Function to create the initial hex grid
// ------------------------------------------
const createHexGrid = (size) => {
  const hexes = [];
  const hexMap = new Map();

  // First pass: create hexes
  for (let q = -size; q <= size; q++) {
    const r1 = Math.max(-size, -q - size);
    const r2 = Math.min(size, -q + size);
    for (let r = r1; r <= r2; r++) {
      const { x, y } = axialToPixel(q, r, HEX_RADIUS);
      const points = generateHexPoints(HEX_RADIUS);

      const isEdge = q === -size || q === size || r === r1 || r === r2;
      const hex = {
        q,
        r,
        x,
        y,
        points,
        isMainHex: q === 0 && r === 0,
        isCenterRing: predefinedCenterRingHexes.some(
          (coords) => coords.q === q && coords.r === r
        ),
        isOuterRing: predefinedOuterRing.some(
          (coords) => coords.q === q && coords.r === r
        ),
        isPathDraft: false,
        isPath: false,
        isValid: false,
        isPlaying: false,
        sampleName: null,
        effect: { type: null, name: null },
        isEdge,
        isHidden: false,
        isPathSelected: false,
        isBranchSelected: false,
        isEffectDraft: false,
        isBranch: false,
        pathId: null,
        branchId: null,
        isHexSelected: false,
      };
      hexes.push(hex);
      hexMap.set(`${q},${r}`, hex);
    }
  }

  // Tag random clusters of surrounding hexes as hidden (optional)
  _.forEach(
    _.filter(hexes, (hex) => hex.isEdge),
    (edgeHex) => {
      edgeHex.isHidden = true;

      const randomCount = _.random(1, 1);
      _.forEach(
        _.sampleSize(getHexNeighbours(edgeHex, hexes), randomCount),
        (hex) => {
          hex.isHidden = true;
        }
      );
    }
  );

  return hexes;
};

// --------------
//   Utilities
// --------------
const utilityHandlers = {
  Offset: (context, config) => {
    const { amount } = config;
    console.log("config", config);
    const delay = Tone.Time(`${amount.value} * 8n`).toSeconds();
    context.triggerTime += delay;
    return context;
  },
  Speed: (context, config) => {
    const { rate } = config;
    const speedRate = parseFloat(rate.value);
    context.duration = context.duration ? context.duration / speedRate : null;
    context.speedRate = speedRate;
    return context;
  },
};

/**
 * Utility to generate a unique note for user-uploaded samples.
 */
export function getFallbackNote(sampleName, existingUserSamples) {
  const defaultNotes = new Set(Object.values(sampleToNoteMap));
  const usedNotes = new Set([
    ...existingUserSamples.map((sample) => sample.note),
    ...defaultNotes,
  ]);

  const noteSequence = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const startOctave = 4;
  const endOctave = 7;

  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (const note of noteSequence) {
      const fullNote = `${note}${octave}`;
      if (!usedNotes.has(fullNote)) {
        return fullNote;
      }
    }
  }
  return "C6";
}

// -----------------
//   IndexedDB Init
// -----------------
async function initDB() {
  return openDB("SampleDB", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("userSamples")) {
        db.createObjectStore("userSamples", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    },
  });
}

export async function getAllUserSamples() {
  const db = await initDB();
  const records = await db.getAll("userSamples");
  return records.map((record) => {
    const blob = new Blob([record.data], { type: "audio/*" });
    const objectURL = URL.createObjectURL(blob);
    return {
      ...record,
      url: objectURL,
    };
  });
}

export async function addUserSample(sample) {
  // Always ensure we have a valid note
  if (!sample.note || !sample.note.match(/^[A-G]#?\d$/)) {
    console.warn(
      `Invalid or missing note for sample ${sample.name}, generating fallback`
    );
    sample.note = getFallbackNote(sample.name, userSamples);
  }

  const db = await initDB();
  const tx = db.transaction("userSamples", "readwrite");

  try {
    await tx.objectStore("userSamples").add({
      name: sample.name,
      data: sample.data,
      note: sample.note,
    });

    console.log(
      `Successfully added user sample ${sample.name} with note ${sample.note}`
    );
    await tx.done;
  } catch (error) {
    console.error(`Error adding user sample ${sample.name}:`, error);
    throw error;
  }
}

export async function removeUserSample(id) {
  const db = await initDB();
  const tx = db.transaction("userSamples", "readwrite");
  tx.objectStore("userSamples").delete(id);
  await tx.done;
}

// --------------
//    App
// --------------
const App = () => {
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [size] = useAtom(hexGridSizeAtom);
  const [isAudioPlaying, setIsAudioPlaying] = useAtom(isAudioPlayingAtom);
  const [paths] = useAtom(pathsAtom);
  const [branches] = useAtom(branchesAtom);
  const [currentIndices, setCurrentIndices] = useAtom(currentIndicesAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [bpm] = useAtom(bpmAtom);

  // Access user samples
  const [userSamples] = useAtom(userSamplesAtom);
  console.log("Current userSamples:", userSamples);

  const samplerRef = useRef(null);
  const branchEffectNodesRef = useRef({});
  const noteTime = "8n";

  const pathsRef = useRef(paths);
  const branchesRef = useRef(branches);
  const currentIndicesRef = useRef(currentIndices);
  const pathSpeedRatesRef = useRef({});

  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);

  useEffect(() => {
    currentIndicesRef.current = currentIndices;
  }, [currentIndices]);

  useEffect(() => {
    const initialHexes = createHexGrid(size);
    setHexes(initialHexes);
  }, [size, setHexes]);

  useEffect(() => {
    setCurrentIndices(
      _.reduce(
        paths,
        (acc, pathObj) => {
          const { id: pathId, path } = pathObj;
          acc[pathId] = path.length > 0 ? path.length - 1 : 0;
          return acc;
        },
        {}
      )
    );
  }, [paths, setCurrentIndices]);

  const sampleMap = useMemo(() => {
    // Merge built-in and user samples
    const mergedSamples = [...sampleStore, ...userSamples];

    return _.reduce(
      mergedSamples,
      (acc, sample) => {
        // If built-in
        if (sampleStore.includes(sample)) {
          const note = sampleToNoteMap[sample.name];
          if (note) {
            acc[note] = sample.url;
          }
        }
        // If user
        else if (sample.note) {
          acc[sample.note] = sample.url;
        }
        return acc;
      },
      {}
    );
  }, [userSamples]);

  useEffect(() => {
    samplerRef.current = new Tone.Sampler(sampleMap).toDestination();
    return () => {
      if (samplerRef.current) {
        samplerRef.current.dispose();
      }
    };
  }, [sampleMap]);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    branches.forEach((branch) => {
      if (!branchEffectNodesRef.current[branch.id]) {
        let effectNode;
        const effectConfig = _.mapValues(
          branch.effectConfig,
          (param) => param.value
        );

        if (branch.effect.type === "utility") {
          effectNode = new Tone.Gain().toDestination();
        } else {
          switch (branch.effect.name) {
            case "Reverb":
              effectNode = new Tone.Reverb(effectConfig).toDestination();
              break;
            case "AutoFilter":
              effectNode = new Tone.AutoFilter(effectConfig).toDestination();
              effectNode.start();
              break;
            case "AutoWah":
              effectNode = new Tone.AutoWah(effectConfig).toDestination();
              break;
            case "BitCrusher":
              effectNode = new Tone.BitCrusher(effectConfig).toDestination();
              break;
            case "Chorus":
              effectNode = new Tone.Chorus(effectConfig).toDestination();
              effectNode.start();
              break;
            case "Distortion":
              effectNode = new Tone.Distortion(effectConfig).toDestination();
              break;
            case "FeedbackDelay":
              effectNode = new Tone.FeedbackDelay(effectConfig).toDestination();
              break;
            case "FrequencyShifter":
              effectNode = new Tone.FrequencyShifter(
                effectConfig
              ).toDestination();
              break;
            case "Phaser":
              effectNode = new Tone.Phaser(effectConfig).toDestination();
              break;
            case "PingPongDelay":
              effectNode = new Tone.PingPongDelay(effectConfig).toDestination();
              break;
            case "PitchShift":
              effectNode = new Tone.PitchShift(effectConfig).toDestination();
              break;
            default:
              effectNode = new Tone.Gain().toDestination();
              break;
          }
        }
        const branchSampler = new Tone.Sampler(sampleMap).connect(effectNode);

        branchEffectNodesRef.current[branch.id] = {
          effectNode,
          sampler: branchSampler,
          type: branch.effect.type,
        };
      } else {
        const { effectNode } = branchEffectNodesRef.current[branch.id];
        const effectConfig = _.mapValues(
          branch.effectConfig,
          (param) => param.value
        );
        if (effectNode && typeof effectNode.set === "function") {
          effectNode.set(effectConfig);
        }
      }
    });

    // Cleanup removed branches
    const branchIds = branches.map((branch) => branch.id);
    Object.keys(branchEffectNodesRef.current).forEach((branchId) => {
      if (!branchIds.includes(branchId)) {
        branchEffectNodesRef.current[branchId].sampler.dispose();
        branchEffectNodesRef.current[branchId].effectNode.dispose();
        delete branchEffectNodesRef.current[branchId];
      }
    });
  }, [branches, sampleMap]);

  function forceNoteMapping(sampleName) {
    const defaultNotes = new Set(Object.values(sampleToNoteMap));
    const availableNotes = [
      "G#5",
      "A5",
      "A#5",
      "B5",
      "C6",
      "C#6",
      "D6",
      "D#6",
      "E6",
      "F6",
      "F#6",
      "G6",
      "G#6",
      "A6",
      "A#6",
      "B6",
    ].filter((note) => !defaultNotes.has(note));

    const hash = sampleName.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return availableNotes[Math.abs(hash) % availableNotes.length] || "C6";
  }

  const combinedNoteMap = useMemo(() => {
    const noteMap = { ...sampleToNoteMap };
    const activeHexes = hexes.filter((hex) => hex.sampleName);
    console.log(
      "Active hexes with samples:",
      activeHexes.map((hex) => hex.sampleName)
    );

    // Map user samples first
    userSamples.forEach((sample) => {
      if (sample.note && !noteMap[sample.name]) {
        noteMap[sample.name] = sample.note;
        console.log(`Mapped user sample ${sample.name} to note ${sample.note}`);
      }
    });

    // Force-map any hex sample with no existing mapping
    activeHexes.forEach((hex) => {
      if (hex.sampleName && !noteMap[hex.sampleName]) {
        const forcedNote = forceNoteMapping(hex.sampleName);
        noteMap[hex.sampleName] = forcedNote;
        console.log(
          `Force mapped sample ${hex.sampleName} to note ${forcedNote}`
        );
      }
    });

    console.log("Final noteMap:", noteMap);
    return noteMap;
  }, [hexes, userSamples]);

  function ensureSampleHasValidNote(hex) {
    if (!hex || !hex.sampleName) return null;

    const note = combinedNoteMap[hex.sampleName];
    if (!note) {
      console.warn(`No note mapping found for sample ${hex.sampleName}`);
      return null;
    }
    if (!note.match(/^[A-G]#?\d$/)) {
      console.warn(`Invalid note ${note} for sample ${hex.sampleName}`);
      return null;
    }
    return note;
  }

  async function updateUserSampleNote(sampleId, newNote) {
    const db = await initDB();
    const tx = db.transaction("userSamples", "readwrite");
    const store = tx.objectStore("userSamples");

    const sample = await store.get(sampleId);
    if (sample) {
      sample.note = newNote;
      await store.put(sample);
    }
    await tx.done;
  }

  const triggerSampleWithValidation = (
    sampler,
    sampleName,
    note,
    duration,
    time
  ) => {
    if (!sampler) {
      console.error("Error: Sampler is not initialized");
      return false;
    }
    const validNote = note && note.match(/^[A-G]#?\d$/);
    if (!validNote) {
      console.error(`Error: Invalid note ${note} for sample ${sampleName}`);
      return false;
    }
    try {
      console.log(`Playing sample ${sampleName} with note ${note}`);
      sampler.triggerAttackRelease(note, duration || "8n", time);
      return true;
    } catch (error) {
      console.error(
        `Error playing sample ${sampleName} with note ${note}:`,
        error
      );
      return false;
    }
  };

  useEffect(() => {
    if (isAudioPlaying) {
      const tickCallback = (time) => {
        const currentPaths = pathsRef.current;
        const currentIndices = currentIndicesRef.current;

        setHexes((prevHexes) => {
          const updatedHexes = _.map(prevHexes, (hex) => ({
            ...hex,
            isPlaying: false,
          }));

          _.forEach(currentPaths, (pathObj) => {
            const { id: pathId, path } = pathObj;
            const currentIndex = currentIndices[pathId] || 0;
            const hex = path[currentIndex];

            if (hex) {
              const hexToUpdate = _.find(updatedHexes, (h) =>
                areCoordinatesEqual(h, hex)
              );
              if (hexToUpdate && hexToUpdate.sampleName) {
                const note =
                  combinedNoteMap[hexToUpdate.sampleName] ||
                  forceNoteMapping(hexToUpdate.sampleName);
                const baseDuration =
                  Tone.Time(noteTime).toSeconds() * path.length;

                console.log(`Attempting to play hex:`, {
                  sampleName: hexToUpdate.sampleName,
                  note,
                  duration: baseDuration,
                });

                const connectedBranches = _.filter(
                  branchesRef.current,
                  (branchObj) => branchObj.parentPathId === pathId
                );
                if (connectedBranches.length > 0) {
                  const utilityBranches = connectedBranches.filter(
                    (branch) => branch.effect.type === "utility"
                  );
                  const audioEffectBranches = connectedBranches.filter(
                    (branch) => branch.effect.type !== "utility"
                  );

                  let playbackContext = {
                    triggerTime: time,
                    duration: baseDuration,
                    speedRate: 1,
                  };

                  // Process utility effects first
                  playbackContext = utilityBranches.reduce(
                    (context, branchObj) => {
                      const handler = utilityHandlers[branchObj.effect.name];
                      return handler
                        ? handler(context, branchObj.effectConfig)
                        : context;
                    },
                    playbackContext
                  );

                  pathSpeedRatesRef.current[pathId] = playbackContext.speedRate;

                  if (!playbackContext.skip) {
                    // Play through audio effect branches
                    if (audioEffectBranches.length > 0) {
                      audioEffectBranches.forEach((branch) => {
                        const branchNode =
                          branchEffectNodesRef.current[branch.id];
                        if (branchNode && branchNode.sampler) {
                          triggerSampleWithValidation(
                            branchNode.sampler,
                            hexToUpdate.sampleName,
                            note,
                            playbackContext.duration || baseDuration,
                            playbackContext.triggerTime
                          );
                        }
                      });
                    } else {
                      triggerSampleWithValidation(
                        samplerRef.current,
                        hexToUpdate.sampleName,
                        note,
                        playbackContext.duration || baseDuration,
                        playbackContext.triggerTime
                      );
                    }
                  }
                } else {
                  // No branches
                  triggerSampleWithValidation(
                    samplerRef.current,
                    hexToUpdate.sampleName,
                    note,
                    baseDuration,
                    time
                  );
                  pathSpeedRatesRef.current[pathId] = 1;
                }
              }
              if (hexToUpdate) {
                hexToUpdate.isPlaying = true;
              }
            }
          });
          return [...updatedHexes];
        });

        // Update path indices
        setCurrentIndices((prevIndices) => {
          const newIndices = { ...prevIndices };
          _.forEach(currentPaths, (pathObj) => {
            const { id: pathId, path } = pathObj;
            if (path && path.length > 0) {
              const currentIndex = prevIndices[pathId] || 0;
              const speedRate = pathSpeedRatesRef.current[pathId] || 1;
              const increment = speedRate;
              newIndices[pathId] =
                (currentIndex - increment + path.length) % path.length;
            } else {
              newIndices[pathId] = 0;
            }
          });
          return newIndices;
        });
      };

      Tone.Transport.scheduleRepeat(tickCallback, noteTime);
      Tone.Transport.start();
    } else {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }

    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, [isAudioPlaying, setHexes, setCurrentIndices]);

  const closeControlsRef = useRef(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white">
      <div className="flex flex-wrap w-full max-w-screen-xl">
        <h1 className="visible lg:hidden absolute top-8 left-0 right-0 text-lg my-4 text-center mx-auto">
          tendril.aagentah.tech
        </h1>
        <div className="w-full lg:w-1/2 flex justify-center items-center scale-75 sm:scale-100">
          <div style={{ position: "relative" }}>
            {/* Render the Grid and P5Overlay */}
            <HexGrid />
            <P5Overlay />
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex justify-center items-center">
          <MobileControlsPanel onCloseRef={closeControlsRef}>
            <h1 className="text-lg my-4 text-center mx-auto">
              tendril.aagentah.tech
            </h1>
            {/* Controls panel */}
            <Controls
              selectedSample={selectedSample}
              setSelectedSample={(sample) => {
                setSelectedSample(sample);
                closeControlsRef.current?.();
              }}
              onControlPress={() => closeControlsRef.current?.()}
            />
          </MobileControlsPanel>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------
//  MobileControlsPanel subcomponent
// ----------------------------------
const MobileControlsPanel = ({ children, onCloseRef }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (onCloseRef) {
      onCloseRef.current = () => setIsOpen(false);
    }
  }, [onCloseRef]);

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block w-full relative">{children}</div>

      {/* Mobile */}
      <div className="block lg:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-30 px-6 py-2 border border-white text-white shadow-lg ${
            isOpen ? "hidden" : "block"
          }`}
        >
          Controls
        </button>

        <div
          className={`fixed inset-0 bg-neutral-900 z-40 transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="h-full overflow-y-auto px-4 pt-16 pb-8">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
