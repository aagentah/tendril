// sampleStore.js - Manages audio samples and effects
import { openDB } from "idb";

// Importing sample assets
// Basic wav samples
import cymbal1 from "./assets/samples/cymbal1.wav";
import cymbal2 from "./assets/samples/cymbal2.wav";
import hat1 from "./assets/samples/hat1.wav";
import hat2 from "./assets/samples/hat2.wav";
import kick1 from "./assets/samples/kick1.wav";
import kick2 from "./assets/samples/kick2.wav";
import pad1 from "./assets/samples/pad1.wav";
import pad2 from "./assets/samples/pad2.wav";
import pad3 from "./assets/samples/pad3.wav";
import pad4 from "./assets/samples/pad4.wav";
import rim1 from "./assets/samples/rim1.wav";
import rim2 from "./assets/samples/rim2.wav";
import snare1 from "./assets/samples/snare1.wav";
import snare2 from "./assets/samples/snare2.wav";
import snare3 from "./assets/samples/snare3.wav";
import sweep1 from "./assets/samples/sweep1.wav";
import sweep2 from "./assets/samples/sweep2.wav";
import sweep3 from "./assets/samples/sweep3.wav";

// Additional samples (abbreviated list for file size)
import mangledChords from "./assets/samples/alanJohnsonBomKlakkYukuSSupersickSamplePackFree03MangledChords.mp3";
import creakPercie from "./assets/samples/chewlieBomKlakkYukuSSupersickSamplePackFree08CreakPercie.mp3";
import pongPercie from "./assets/samples/chewlieBomKlakkYukuSSupersickSamplePackFree09PongPercie.mp3";
import harmonicBeauty from "./assets/samples/chrizpyChrizBomKlakkYukuSSupersickSamplePackFree10808CHarmonicBeauty.mp3";

// Sample store
export const sampleStore = [
  // Basic wav samples
  { name: "Kick 1", url: kick1 },
  { name: "Kick 2", url: kick2 },
  { name: "Hat 1", url: hat1 },
  { name: "Hat 2", url: hat2 },
  { name: "Snare 1", url: snare1 },
  { name: "Snare 2", url: snare2 },
  { name: "Snare 3", url: snare3 },
  { name: "Rim 1", url: rim1 },
  { name: "Rim 2", url: rim2 },
  { name: "Cymbal 1", url: cymbal1 },
  { name: "Cymbal 2", url: cymbal2 },
  { name: "Pad 1", url: pad1 },
  { name: "Pad 2", url: pad2 },
  { name: "Pad 3", url: pad3 },
  { name: "Pad 4", url: pad4 },
  { name: "Sweep 1", url: sweep1 },
  { name: "Sweep 2", url: sweep2 },
  { name: "Sweep 3", url: sweep3 },

  // Additional samples (abbreviated)
  { name: "Mangled Chords", url: mangledChords },
  { name: "Creak Percie", url: creakPercie },
  { name: "Pong Percie", url: pongPercie },
  { name: "808C Harmonic Beauty", url: harmonicBeauty },
];

// Effect store - Contains utilities (branch-level) and effects (path-level)
export const effectStore = [
  // Utilities - branch-level timing and playback manipulation
  {
    type: "utility",
    name: "Offset",
    config: {
      amount: { value: 0, default: 0, min: 0, max: 1, step: 0.25 },
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
        ],
      },
    },
  },
  {
    type: "utility",
    name: "Probability",
    config: {
      chance: { value: 1, default: 1, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "utility",
    name: "Volume",
    config: {
      volume: { value: 1, default: 1, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "utility",
    name: "Pan",
    config: {
      pan: { value: 0, default: 0, min: -12, max: 12, step: 0.1 },
    },
  },
  // Effects - path-level audio processing and manipulation
  {
    type: "effect",
    name: "Chaos",
    config: {
      amount: { value: 0, default: 0, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "effect",
    name: "Distortion",
    config: {
      amount: { value: 0, default: 0, min: 0, max: 1, step: 0.01 },
    },
  },
  {
    type: "effect",
    name: "PitchShift",
    config: {
      pitch: { value: 0, default: 0, min: -12, max: 12, step: 0.1 },
    },
  },
  {
    type: "effect",
    name: "EQ",
    config: {
      lowGain: { value: 0, default: 0, min: -30, max: 6, step: 0.5 },
      midGain: { value: 0, default: 0, min: -30, max: 6, step: 0.5 },
      highGain: { value: 0, default: 0, min: -30, max: 6, step: 0.5 },
    },
  },
];

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
      `Invalid or missing note for sample ${sample.name}, assigning default note "C4"`
    );
    sample.note = "C4"; // Assign a default note directly
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
