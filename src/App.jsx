import React, { useEffect, useRef, useState, useMemo } from "react";
import { atom, useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import * as Tone from "tone";
import p5 from "p5";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { openDB } from "idb";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend"; // For desktop and touch support
// import { TouchBackend } from "react-dnd-touch-backend"; // Optional: For enhanced touch support
// import MultiBackend, { TouchTransition } from "react-dnd-multi-backend"; // Optional: For combining backends

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

// Effect store
export const effectStore = [
  {
    type: "fx",
    name: "Reverb",
    config: {
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "AutoFilter",
    config: {
      frequency: { value: 1, default: 1, min: 0.1, max: 10, step: 0.1 },
      depth: { value: 1, default: 1, min: 0, max: 1, step: 0.01 },
      baseFrequency: { value: 200, default: 200, min: 20, max: 2000, step: 1 },
      octaves: { value: 2.6, default: 2.6, min: 0, max: 8, step: 0.1 },
    },
  },
  {
    type: "fx",
    name: "AutoWah",
    config: {
      baseFrequency: { value: 100, default: 100, min: 20, max: 1000, step: 1 },
      octaves: { value: 6, default: 6, min: 0, max: 8, step: 0.1 },
      sensitivity: { value: 0, default: 0, min: -40, max: 0, step: 1 },
      Q: { value: 2, default: 2, min: 0.1, max: 20, step: 0.1 },
      gain: { value: 2, default: 2, min: 0, max: 10, step: 0.1 },
    },
  },
  {
    type: "fx",
    name: "BitCrusher",
    config: {
      bits: { value: 4, default: 4, min: 1, max: 16, step: 1 },
    },
  },
  {
    type: "fx",
    name: "Chorus",
    config: {
      frequency: { value: 1.5, default: 1.5, min: 0.1, max: 10, step: 0.1 },
      delayTime: { value: 3.5, default: 3.5, min: 0.1, max: 10, step: 0.1 },
      depth: { value: 0.7, default: 0.7, min: 0, max: 1, step: 0.01 },
      feedback: { value: 0.1, default: 0.1, min: 0, max: 1, step: 0.01 },
      spread: { value: 180, default: 180, min: 0, max: 360, step: 1 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "Distortion",
    config: {
      distortion: { value: 0.4, default: 0.4, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "FeedbackDelay",
    config: {
      delayTime: { value: 0.25, default: 0.25, min: 0, max: 1, step: 0.01 },
      feedback: { value: 0.5, default: 0.5, min: 0, max: 0.99, step: 0.01 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "FrequencyShifter",
    config: {
      frequency: { value: 42, default: 42, min: -1000, max: 1000, step: 1 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "Phaser",
    config: {
      frequency: { value: 0.5, default: 0.5, min: 0.1, max: 10, step: 0.1 },
      octaves: { value: 3, default: 3, min: 0, max: 8, step: 0.1 },
      stages: { value: 10, default: 10, min: 1, max: 12, step: 1 },
      Q: { value: 10, default: 10, min: 0.1, max: 20, step: 0.1 },
      baseFrequency: { value: 350, default: 350, min: 20, max: 2000, step: 1 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "PingPongDelay",
    config: {
      delayTime: { value: 0.25, default: 0.25, min: 0, max: 1, step: 0.01 },
      feedback: { value: 0.3, default: 0.3, min: 0, max: 0.99, step: 0.01 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "fx",
    name: "PitchShift",
    config: {
      pitch: { value: 0, default: 0, min: -24, max: 24, step: 1 },
      windowSize: { value: 0.1, default: 0.1, min: 0.01, max: 1, step: 0.01 },
      delayTime: { value: 0, default: 0, min: 0, max: 1, step: 0.01 },
      feedback: { value: 0, default: 0, min: 0, max: 0.99, step: 0.01 },
      wet: { value: 0.5, default: 0.5, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "utility",
    name: "Offset",
    config: {
      amount: { value: 0, default: 0, min: 0, max: 1, step: 0.1 },
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
          { value: "0.25", label: "¼ Speed" },
          { value: "0.5", label: "½ Speed" },
          { value: "1", label: "Normal" },
          { value: "2", label: "2× Speed" },
          { value: "4", label: "4× Speed" },
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
export const dragPreviewAtom = atom({ show: false, x: 0, y: 0 });

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
    // sample.note = getFallbackNote(sample.name, userSamples);
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

  const [isLoadingSamples, setIsLoadingSamples] = useState(true);

  const samplerRef = useRef(null);
  const branchEffectNodesRef = useRef({});
  const noteTime = "8n";

  const pathsRef = useRef(paths);
  const branchesRef = useRef(branches);
  const currentIndicesRef = useRef(currentIndices);
  const pathSpeedRatesRef = useRef({});
  const lastStartTimeRef = useRef({});
  const transportScheduleRef = useRef(null);

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
    // Schedule the index update at the next 8n subdivision
    Tone.Transport.scheduleOnce((time) => {
      setCurrentIndices((prevIndices) => {
        // Use the current bar at the moment of scheduling
        const currentBar = Math.floor(Tone.Transport.position.split(":")[0]);

        return _.reduce(
          paths,
          (acc, pathObj) => {
            const { id: pathId, path } = pathObj;
            if (prevIndices.hasOwnProperty(pathId)) {
              acc[pathId] = prevIndices[pathId];
            } else {
              const pathLength = path.length;
              if (pathLength > 0) {
                const normalizedPosition = currentBar % pathLength;
                acc[pathId] = normalizedPosition;
              } else {
                acc[pathId] = 0;
              }
            }
            return acc;
          },
          { ...prevIndices }
        );
      });
    }, "next 8n");
  }, [paths, setCurrentIndices]);

  useEffect(() => {
    const players = {};
    const allSamples = [...sampleStore, ...userSamples];
    let loadedCount = 0;
    const totalCount = allSamples.length;

    const initializePlayers = async () => {
      try {
        await Tone.start();

        for (const sample of allSamples) {
          const player = new Tone.Player({
            url: sample.url,
            fadeOut: 0.01,
            retrigger: true,
            curve: "linear",
            onload: () => {
              loadedCount += 1;
              if (loadedCount === totalCount) {
                setIsLoadingSamples(false);
              }
            },
          }).toDestination();

          const silentGain = new Tone.Gain(0).toDestination();
          player.connect(silentGain);

          players[sample.name] = player;
        }
      } catch (error) {
        console.error("Error initializing audio players:", error);
      }
    };

    initializePlayers();
    samplerRef.current = players;

    return () => {
      Object.values(players).forEach((player) => {
        player.stop();
        player.disconnect();
        player.dispose();
      });
    };
  }, [sampleStore, userSamples]);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    // Set up any new branches or reconfigure existing ones
    branches.forEach((branch) => {
      if (!branchEffectNodesRef.current[branch.id]) {
        let effectNode;
        const effectConfig = _.mapValues(
          branch.effectConfig,
          (param) => param.value
        );

        console.log("effectConfig", effectConfig);

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

        const branchPlayers = {};
        [...sampleStore, ...userSamples].forEach((sample) => {
          branchPlayers[sample.name] = new Tone.Player(sample.url).connect(
            effectNode
          );
        });

        branchEffectNodesRef.current[branch.id] = {
          effectNode,
          players: branchPlayers,
          type: branch.effect.type,
        };
      } else {
        // Update any changed configs
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
    // Clean up speed rates for removed paths
    const branchIds = branches.map((branch) => branch.id);
    Object.keys(pathSpeedRatesRef.current).forEach((pathId) => {
      // If path no longer exists or no longer has a Speed utility, reset its speed
      const hasSpeedUtility = branches.some(
        (branch) =>
          branch.parentPathId === pathId && branch.effect.name === "Speed"
      );
      if (!hasSpeedUtility) {
        delete pathSpeedRatesRef.current[pathId];
      }
    });
  }, [branches, sampleStore, userSamples]);

  const triggerSampleWithValidation = (players, sampleName, duration, time) => {
    if (!players || !players[sampleName]) {
      console.error("Error: Player not initialized for sample:", sampleName);
      return false;
    }

    try {
      const player = players[sampleName];

      // Ensure the player is loaded
      if (!player.loaded) {
        console.warn(`Sample ${sampleName} is not yet loaded.`);
        return false;
      }

      const currentTime = Tone.Transport.seconds;
      // Add a small offset to ensure clean playback
      const safeStartTime = Math.max(time, currentTime + 0.01);

      // Ensure time is strictly greater than last start time
      const lastTime = lastStartTimeRef.current[sampleName] || 0;
      const finalStartTime = Math.max(safeStartTime, lastTime + 0.01);
      lastStartTimeRef.current[sampleName] = finalStartTime;

      // Calculate a safe duration
      const safeDuration = Math.max(duration || 0.25, 0.1);

      console.log(
        `Playing sample ${sampleName} at time ${finalStartTime} for duration ${safeDuration}s`
      );

      // Start the player with the calculated safe times
      player.start(finalStartTime, 0, safeDuration);
      return true;
    } catch (error) {
      console.error(`Error playing sample ${sampleName}:`, error);
      return false;
    }
  };

  // Within App.jsx, replace the existing useEffect for Tone.Transport with this updated version

  // Replace the main useEffect for transport and playback in App.jsx
  useEffect(() => {
    if (isAudioPlaying) {
      // Initialize references and state
      lastStartTimeRef.current = {};
      pathSpeedRatesRef.current = {};

      const initializeAndStart = async () => {
        try {
          await Tone.start();

          // Pre-warm the audio system
          // const players = samplerRef.current;
          // for (const player of Object.values(players)) {
          //   if (player.loaded) {
          //     const silentGain = new Tone.Gain(0).toDestination();
          //     player.connect(silentGain);
          //     await player.start();
          //     await player.stop();
          //     player.disconnect(silentGain);
          //     silentGain.dispose();
          //   }
          // }

          // Initialize currentIndices based on transport position
          const initializeCurrentIndices = () => {
            const newIndices = {};
            const baseStepDuration = Tone.Time(noteTime).toSeconds();
            // Use raw transport time to calculate steps without musical bar assumptions
            const rawStepsElapsed = Math.floor(
              Tone.Transport.seconds / baseStepDuration
            );

            pathsRef.current.forEach((pathObj) => {
              const { id: pathId, path } = pathObj;
              if (!path || path.length === 0) {
                newIndices[pathId] = 0;
              } else {
                const pathLength = path.length;
                // Calculate the current index based purely on elapsed time and path length,
                // allowing for true polyrhythmic relationships
                const currentIndex = rawStepsElapsed % pathLength;
                newIndices[pathId] = currentIndex;
              }
            });

            currentIndicesRef.current = newIndices;
            setCurrentIndices(newIndices);
          };

          initializeCurrentIndices();

          // Schedule the main playback loop
          const scheduleId = Tone.Transport.scheduleRepeat((time) => {
            if (!isAudioPlaying) return;

            const currentPaths = pathsRef.current;
            const currentIndices = currentIndicesRef.current;
            const soloPaths = currentPaths.filter((p) => p.solo);
            const pathsToUse = soloPaths.length > 0 ? soloPaths : currentPaths;

            setHexes((prevHexes) => {
              const updatedHexes = _.map(prevHexes, (hex) => ({
                ...hex,
                isPlaying: false,
              }));

              pathsToUse.forEach((pathObj) => {
                const { id: pathId, path } = pathObj;
                if (!path || path.length === 0 || pathObj.bypass) return;

                let currentIndex = currentIndices[pathId];
                if (currentIndex === undefined) {
                  const pathLength = path.length;
                  if (pathLength > 0) {
                    const baseStepDuration = Tone.Time(noteTime).toSeconds();
                    const stepsElapsed = Math.floor(
                      Tone.Transport.seconds / baseStepDuration
                    );
                    currentIndex = stepsElapsed % pathLength;
                    currentIndices[pathId] = currentIndex;
                  } else {
                    currentIndex = 0;
                    currentIndices[pathId] = currentIndex;
                  }
                }

                const currentHex = path[path.length - 1 - currentIndex];
                if (!currentHex) return;

                const hexToUpdate = _.find(updatedHexes, (h) =>
                  areCoordinatesEqual(h, currentHex)
                );

                if (hexToUpdate?.sampleName) {
                  try {
                    const stepsRemaining = path.length - currentIndex;
                    const scheduledTime = Math.max(
                      time + 0.05, // Add small offset for first trigger
                      Tone.Transport.seconds + 0.01
                    );

                    let playbackContext = {
                      triggerTime: scheduledTime,
                      duration: null,
                      speedRate: 1,
                    };

                    const connectedBranches = _.filter(
                      branchesRef.current,
                      (b) => b?.parentPathId === pathId
                    );

                    const utilityBranches = connectedBranches.filter(
                      (branch) => branch?.effect?.type === "utility"
                    );
                    const audioEffectBranches = connectedBranches.filter(
                      (branch) => branch?.effect?.type === "fx"
                    );

                    // Apply utility effects with error handling
                    playbackContext = utilityBranches.reduce(
                      (context, branchObj) => {
                        if (!branchObj?.effect?.name) return context;

                        const handler = utilityHandlers[branchObj.effect.name];
                        if (!handler) return context;

                        try {
                          const newContext = handler(
                            context,
                            branchObj.effectConfig
                          );

                          if (branchObj.effect.name === "Speed") {
                            const rate = parseFloat(
                              branchObj.effectConfig?.rate?.value ?? 1
                            );
                            if (!isNaN(rate) && rate > 0) {
                              pathSpeedRatesRef.current[pathId] = rate;
                            }
                          }

                          return newContext;
                        } catch (error) {
                          console.error("Utility handler error:", error);
                          return context;
                        }
                      },
                      playbackContext
                    );

                    // Calculate precise durations with a minimum duration
                    const baseStepDuration = Tone.Time(noteTime).toSeconds();
                    const speedRate = playbackContext.speedRate || 1;
                    const oneStepDuration = baseStepDuration / speedRate;

                    const totalDuration = Math.max(
                      stepsRemaining * oneStepDuration + oneStepDuration - 0.01,
                      0.1
                    );

                    const pathVolume = pathObj.volume ?? 1;

                    // Handle audio playback through effects or direct
                    if (audioEffectBranches.length > 0) {
                      audioEffectBranches.forEach((branch) => {
                        const branchNode =
                          branchEffectNodesRef.current[branch.id];
                        if (branchNode?.players) {
                          const player =
                            branchNode.players[hexToUpdate.sampleName];
                          if (player && player.loaded) {
                            player.volume.value = Tone.gainToDb(pathVolume);
                            player.mute = false;
                            triggerSampleWithValidation(
                              branchNode.players,
                              hexToUpdate.sampleName,
                              totalDuration,
                              playbackContext.triggerTime
                            );
                          }
                        }
                      });
                    } else {
                      const player = samplerRef.current[hexToUpdate.sampleName];
                      if (player && player.loaded) {
                        player.volume.value = Tone.gainToDb(pathVolume);
                        player.mute = false;
                        triggerSampleWithValidation(
                          samplerRef.current,
                          hexToUpdate.sampleName,
                          totalDuration,
                          playbackContext.triggerTime
                        );
                      }
                    }
                  } catch (error) {
                    console.error(
                      `Error playing sample ${hexToUpdate.sampleName}:`,
                      error
                    );
                  }
                }

                if (hexToUpdate) {
                  hexToUpdate.isPlaying = true;
                }
              });

              return [...updatedHexes];
            });

            // Update indices with speed rate consideration
            pathsToUse.forEach((pathObj) => {
              const { id: pathId, path } = pathObj;
              if (path?.length > 0) {
                const speedRate = pathSpeedRatesRef.current[pathId] || 1;
                const currentIndex = currentIndices[pathId] ?? 0;
                const effectiveSpeedRate = Math.min(speedRate, path.length);
                currentIndices[pathId] =
                  (currentIndex + effectiveSpeedRate) % path.length;
              } else {
                currentIndices[pathId] = 0;
              }
            });

            // Update the ref and state
            currentIndicesRef.current = { ...currentIndicesRef.current };
            setCurrentIndices(currentIndicesRef.current);
          }, noteTime);

          transportScheduleRef.current = scheduleId;

          // Start transport with a small delay
          setTimeout(() => {
            Tone.Transport.start("+0.1");
          }, 100);
        } catch (error) {
          console.error("Error starting transport:", error);
        }
      };

      initializeAndStart();

      return () => {
        if (transportScheduleRef.current !== null) {
          Tone.Transport.clear(transportScheduleRef.current);
          transportScheduleRef.current = null;
        }
        Tone.Transport.cancel();
      };
    } else {
      // Cleanup when stopping
      const now = Tone.now();
      Tone.Transport.cancel();
      Tone.Transport.stop();

      // Clean up audio nodes
      Object.values(samplerRef.current).forEach((player) => {
        if (player?.stop) {
          player.stop(now);
          player.mute = true;
        }
      });

      Object.values(branchEffectNodesRef.current).forEach((branch) => {
        if (branch?.players) {
          Object.values(branch.players).forEach((player) => {
            if (player?.stop) {
              player.stop(now);
              player.mute = true;
            }
          });
        }
      });

      // Reset states
      setCurrentIndices(() => {
        const resetIndices = {};
        paths.forEach((path) => {
          resetIndices[path.id] =
            path.path.length > 0 ? path.path.length - 1 : 0;
        });
        currentIndicesRef.current = resetIndices;
        return resetIndices;
      });

      setHexes((prevHexes) =>
        prevHexes.map((hex) => ({
          ...hex,
          isPlaying: false,
        }))
      );

      // Clear references
      lastStartTimeRef.current = {};
      pathSpeedRatesRef.current = {};
    }

    return () => {
      if (transportScheduleRef.current !== null) {
        Tone.Transport.clear(transportScheduleRef.current);
        transportScheduleRef.current = null;
      }
      Tone.Transport.cancel();
      Tone.Transport.stop();
    };
  }, [isAudioPlaying, setHexes, setCurrentIndices]);

  const closeControlsRef = useRef(null);

  // Replace the handlePlayToggle function in App.jsx
  // 1. Replace the sample initialization useEffect with this version
  useEffect(() => {
    console.log("Initializing audio players..."); // Debug log
    const players = {};
    const allSamples = [...sampleStore, ...userSamples];
    let loadedCount = 0;
    const totalCount = allSamples.length;

    allSamples.forEach((sample) => {
      console.log(`Starting to load sample: ${sample.name}`); // Debug log
      const player = new Tone.Player({
        url: sample.url,
        fadeOut: 0.01,
        retrigger: true,
        curve: "linear",
        onload: () => {
          loadedCount += 1;
          console.log(
            `Loaded sample ${sample.name} (${loadedCount}/${totalCount})`
          ); // Debug log
          if (loadedCount === totalCount) {
            console.log("All samples loaded successfully"); // Debug log
            setIsLoadingSamples(false);
          }
        },
      }).toDestination();

      players[sample.name] = player;
    });

    samplerRef.current = players;

    return () => {
      Object.values(players).forEach((player) => {
        player.stop();
        player.disconnect();
        player.dispose();
      });
    };
  }, [sampleStore, userSamples]);

  // 2. Replace the handlePlayToggle function with this version
  const handlePlayToggle = async () => {
    if (isAudioPlaying) {
      setIsAudioPlaying(false);
    } else {
      try {
        await Tone.start();
        console.log("Tone.start() successful"); // Debug log

        // Pre-warm players only when play is clicked
        const players = samplerRef.current;
        const preWarmPromises = Object.values(players).map(async (player) => {
          if (player.loaded) {
            const silentGain = new Tone.Gain(0).toDestination();
            player.connect(silentGain);
            await player.start();
            await player.stop();
            player.disconnect(silentGain);
            silentGain.dispose();
          }
        });

        await Promise.all(preWarmPromises);
        console.log("Pre-warm complete"); // Debug log

        // Small delay before starting playback
        setTimeout(() => {
          setIsAudioPlaying(true);
        }, 100);
      } catch (error) {
        console.error("Error starting playback:", error);
      }
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="hidden lg:flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white">
        <div className="flex flex-wrap w-full max-w-screen-xl">
          <div className="w-full lg:w-1/2 flex justify-center items-center scale-75 sm:scale-100">
            <div className="relative">
              {/* Render the Grid and P5Overlay */}
              <HexGrid />
              <P5Overlay />
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex justify-center items-center">
            {isLoadingSamples ? (
              <div className="flex justify-center items-center">
                <span>Loading samples...</span>
              </div>
            ) : (
              <MobileControlsPanel onCloseRef={closeControlsRef}>
                <div className="visible text-lg my-4 text-center mx-auto">
                  <h1 className="text-lg mb-2 text-center mx-auto">tendril</h1>
                  <p className="text-center text-sm text-neutral-500">
                    Made by{" "}
                    <a
                      className="text-neutral-500 underline"
                      href="https://daniel.aagentah.tech/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      daniel.aagentah
                    </a>
                  </p>
                </div>

                {/* Controls panel */}
                <Controls
                  onPlayToggle={handlePlayToggle}
                  isAudioPlaying={isAudioPlaying}
                  selectedSample={selectedSample}
                  setSelectedSample={(sample) => {
                    setSelectedSample(sample);
                    closeControlsRef.current?.();
                  }}
                  onControlPress={() => closeControlsRef.current?.()}
                />
              </MobileControlsPanel>
            )}
          </div>
        </div>
      </div>

      <div className="flex lg:hidden flex-col h-screen w-screen items-center justify-center min-h-screen bg-neutral-900 text-white p-8">
        This project wasn't built for touch devices (sorry).
      </div>
    </DndProvider>
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
          className={`h-3/4 bottom-0 fixed inset-x-0 bg-neutral-900 z-40 transition-transform duration-300 ease-in-out border-t border-t-neutral-500 rounded-t-xl ${
            isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="13.5" y1="4.5" x2="4.5" y2="13.5"></line>
              <line x1="4.5" y1="4.5" x2="13.5" y2="13.5"></line>
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
