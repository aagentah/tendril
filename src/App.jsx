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

// Guide
import Guide, { guideStepAtom, guideVisibleAtom } from "./Guide";

// Import your newly separated components
import ControlsWrapper from "./Controls";

import HexGrid from "./Grid";

// -------------------------------------------
//  Sample Assets, Mappings, and Effect Store
// -------------------------------------------

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

// BomKlakkYukuS samples
import vocalWhatToBelieve from "./assets/samples/aFruitBomKlakkYukuSSupersickSamplePackFree01VocalWhatToBelieve.mp3";
import aaa from "./assets/samples/aaa.mp3";
import acidLoop from "./assets/samples/aagentahBomKlakkYukuSSupersickSamplePackFree02AcidLoop.mp3";
import mangledChords from "./assets/samples/alanJohnsonBomKlakkYukuSSupersickSamplePackFree03MangledChords.mp3";
import bassCybershot from "./assets/samples/anmonBomKlakkYukuSSupersickSamplePackFree04BassCybershot.mp3";
import moanPad2 from "./assets/samples/aromaNiceBomKlakkYukuSSupersickSamplePackFree05MoanPad2.mp3";
import basslineUnstable from "./assets/samples/audekaBomKlakkYukuSSupersickSamplePackFree06BasslineUnstable.mp3";
import bassJustAScratch from "./assets/samples/balatronBomKlakkYukuSSupersickSamplePackFree07BassJustAScratch.mp3";
import creakPercie from "./assets/samples/chewlieBomKlakkYukuSSupersickSamplePackFree08CreakPercie.mp3";
import pongPercie from "./assets/samples/chewlieBomKlakkYukuSSupersickSamplePackFree09PongPercie.mp3";
import harmonicBeauty from "./assets/samples/chrizpyChrizBomKlakkYukuSSupersickSamplePackFree10808CHarmonicBeauty.mp3";
import fmBassAlienRace from "./assets/samples/cocktailPartyEffectBomKlakkYukuSSupersickSamplePackFree11FmBassAlienRace.mp3";
import drumloopSplak from "./assets/samples/coidoBomKlakkYukuSSupersickSamplePackFree12DrumloopSplak.mp3";
import yukuDrumLoop from "./assets/samples/debbaBomKlakkYukuSSupersickSamplePackFree13YukuDrumLoop.mp3";
import movedByYouFx from "./assets/samples/dimFumesBomKlakkYukuSSupersickSamplePackFree14MovedByYouFx.mp3";
import istanbulTrafigIKick from "./assets/samples/djStrawberryBomKlakkYukuSSupersickSamplePackFree15IStanbulTrafigIKick.mp3";
import playgroundRidePerc from "./assets/samples/djStrawberryBomKlakkYukuSSupersickSamplePackFree16PlaygroundRidePerc.mp3";
import ritimAtoLyesiResonance from "./assets/samples/djStrawberryBomKlakkYukuSSupersickSamplePackFree17RitimAtoLyesiResonance.mp3";
import bassLoop from "./assets/samples/domizakoBomKlakkYukuSSupersickSamplePackFree18BassLoop.mp3";
import percussionRimLoop from "./assets/samples/domizakoBomKlakkYukuSSupersickSamplePackFree19PercussionRimLoop.mp3";
import breakPalmGrease from "./assets/samples/earlGreyBomKlakkYukuSSupersickSamplePackFree20BreakPalmGrease.mp3";
import padWaterDamage from "./assets/samples/earlGreyBomKlakkYukuSSupersickSamplePackFree21PadWaterDamageEpDronePad.mp3";
import stabWeatherReport from "./assets/samples/earlGreyBomKlakkYukuSSupersickSamplePackFree22StabWeatherReportStab.mp3";
import chordRemixMe from "./assets/samples/endmodellBomKlakkYukuSSupersickSamplePackFree23ChordRemixMe.mp3";
import fxSoundTheLossOfHearing from "./assets/samples/endmodellBomKlakkYukuSSupersickSamplePackFree24FxSoundTheLossOfHearing.mp3";
import padBeyond from "./assets/samples/esTereoBomKlakkYukuSSupersickSamplePackFree25PadBeyond.mp3";
import bassBram01 from "./assets/samples/fearfulBomKlakkYukuSSupersickSamplePackFree26BassBram01.mp3";
import bassBram02 from "./assets/samples/fearfulBomKlakkYukuSSupersickSamplePackFree27BassBram02.mp3";
import synthDarker from "./assets/samples/fearfulBomKlakkYukuSSupersickSamplePackFree28SynthDarker.mp3";
import glasskik from "./assets/samples/flywheelBomKlakkYukuSSupersickSamplePackFree29Glasskik.mp3";
import bassline89BpmD from "./assets/samples/granulBomKlakkYukuSSupersickSamplePackFree30Bassline89BpmD.mp3";
import bassline160BpmD from "./assets/samples/granulBomKlakkYukuSSupersickSamplePackFree31Bassline160BpmD.mp3";
import bleeps160BpmAm from "./assets/samples/granulBomKlakkYukuSSupersickSamplePackFree32Bleeps160BpmAm.mp3";
import pad89BpmAm from "./assets/samples/granulBomKlakkYukuSSupersickSamplePackFree33Pad89BpmAm.mp3";
import vocalCount140Bpm from "./assets/samples/granulBomKlakkYukuSSupersickSamplePackFree34VocalCount140Bpm.mp3";
import broomSound from "./assets/samples/griffitVigoBomKlakkYukuSSupersickSamplePackFree35BroomSoundSample.mp3";
import gqomOriginatorKick from "./assets/samples/griffitVigoBomKlakkYukuSSupersickSamplePackFree36GqomOriginatorKickSample.mp3";
import hardHitHat from "./assets/samples/griffitVigoBomKlakkYukuSSupersickSamplePackFree37HardHitHatSound.mp3";
import reaktorNoise from "./assets/samples/hassanAbouAlamBomKlakkYukuSSupersickSamplePackFree38ReaktorNoise.mp3";
import bassLoopHeavyHitter from "./assets/samples/hedchefBomKlakkYukuSSupersickSamplePackFree39BassLoopHeavyHitter136Bpm.mp3";
import kickSubPunch from "./assets/samples/hedchefBomKlakkYukuSSupersickSamplePackFree40KickSubPunch.mp3";
import percLoopBoxedSynco from "./assets/samples/hedchefBomKlakkYukuSSupersickSamplePackFree41PercLoopBoxedSynco136Bpm.mp3";
import bassloopSoundOf141 from "./assets/samples/hiddenElementBomKlakkYukuSSupersickSamplePackFree42BassloopSoundOf141.mp3";
import drumloopDifferences137 from "./assets/samples/hiddenElementBomKlakkYukuSSupersickSamplePackFree43DrumloopDifferences137.mp3";
import drumLoopSheSAlways135 from "./assets/samples/hiddenElementBomKlakkYukuSSupersickSamplePackFree44DrumLoopSheSAlways135.mp3";
import drumLoopRigorousBreaks from "./assets/samples/i7hvnBomKlakkYukuSSupersickSamplePackFree45DrumLoopRigorousBreaks.mp3";
import glitchHellCockroach from "./assets/samples/janaBomKlakkYukuSSupersickSamplePackFree46GlitchHellCockroach.mp3";
import drumLoopBentGroove from "./assets/samples/joaquinCornejoBomKlakkYukuSSupersickSamplePackFree47DrumLoopBentGroove.mp3";
import impactSpringCrash from "./assets/samples/joaquinCornejoBomKlakkYukuSSupersickSamplePackFree48ImpactSpringCrash.mp3";
import retroverbedKick from "./assets/samples/joaquinCornejoBomKlakkYukuSSupersickSamplePackFree49RetroverbedKick.mp3";
import klahrkKick from "./assets/samples/klahrkBomKlakkYukuSSupersickSamplePackFree50KlahrkKick.mp3";
import kickLongGabber from "./assets/samples/lakkerBomKlakkYukuSSupersickSamplePackFree51KickLongGabber.mp3";
import modkick from "./assets/samples/lazarusBomKlakkYukuSSupersickSamplePackFree52Modkick.mp3";
import dolphinPerc from "./assets/samples/leMotelBomKlakkYukuSSupersickSamplePackFree53DolphinPerc.mp3";
import helixDoor from "./assets/samples/leMotelBomKlakkYukuSSupersickSamplePackFree54HelixDoor.mp3";
import helixSnare from "./assets/samples/leMotelBomKlakkYukuSSupersickSamplePackFree55HelixSnare.mp3";
import bass from "./assets/samples/leeseBomKlakkYukuSSupersickSamplePackFree56Bass.mp3";
import pad2Extended from "./assets/samples/leeseBomKlakkYukuSSupersickSamplePackFree57Pad2.mp3";
import pad from "./assets/samples/leeseBomKlakkYukuSSupersickSamplePackFree58Pad.mp3";
import percu1 from "./assets/samples/leeseBomKlakkYukuSSupersickSamplePackFree59Percu1.mp3";
import sfxBuilder from "./assets/samples/lucikaBomKlakkYukuSSupersickSamplePackFree60SfxBuilder.mp3";
import dirtyPad from "./assets/samples/machineCodeBomKlakkYukuSSupersickSamplePackFree61DirtyPad.mp3";
import texturalMudPie from "./assets/samples/maudeVoSBomKlakkYukuSSupersickSamplePackFree62TexturalMudPie.mp3";
import blauwSample1 from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree63BlauwSample132Bpm1.mp3";
import blauwSample2 from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree64BlauwSample132Bpm2.mp3";
import changingHorses from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree65ChangingHorses116Bpm.mp3";
import magnopause from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree66Magnopause.mp3";
import victoriaEdgeAtmos from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree67VictoriaEdgeAtmos97Bpm.mp3";
import victoriaEdgeBassline from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree68VictoriaEdgeBassline97Bpm.mp3";
import victoriaEdgeVoices from "./assets/samples/michelleSambaPhilMillsBomKlakkYukuSSupersickSamplePackFree69VictoriaEdgeVoices97Bpm.mp3";
import wubBass from "./assets/samples/monibiBomKlakkYukuSSupersickSamplePackFree70MamieEllePortaitDesFringuesKitschWubBass.mp3";
import clapChat from "./assets/samples/monibiBomKlakkYukuSSupersickSamplePackFree71VroomVroomTikalPyramidClapChat.mp3";
import vroomVroomFire from "./assets/samples/monibiBomKlakkYukuSSupersickSamplePackFree72VroomVroomFire.mp3";
import percussionGongs from "./assets/samples/moxinaBomKlakkYukuSSupersickSamplePackFree73PercussionGongs.mp3";
import oCoastBassline from "./assets/samples/muadeepBomKlakkYukuSSupersickSamplePackFree74OCoastBasslineA138Bpm.mp3";
import usulPercussion from "./assets/samples/muadeepBomKlakkYukuSSupersickSamplePackFree75UsulPercussion138Bpm.mp3";
import fluteArgoul from "./assets/samples/muskilaBomKlakkYukuSSupersickSamplePackFree76FluteArgoul.mp3";
import polydrums from "./assets/samples/obekaBomKlakkYukuSSupersickSamplePackFree77PolydrumsSample135bpm.mp3";
import ghostInThePorridge from "./assets/samples/panicmanBomKlakkYukuSSupersickSamplePackFree78FxGhostInThePorridge.mp3";
import reesiestRiser from "./assets/samples/pePeBomKlakkYukuSSupersickSamplePackFree79FxReesiestRiserEverRisen.mp3";
import extract from "./assets/samples/pol100BomKlakkYukuSSupersickSamplePackFree80Extract.mp3";
import yukuSample1 from "./assets/samples/pruvanBomKlakkYukuSSupersickSamplePackFree81YukuSample1.mp3";
import textureVowelLoop from "./assets/samples/revBomKlakkYukuSSupersickSamplePackFree82149_textureVowelLoop.mp3";
import liNoiseTexture from "./assets/samples/revBomKlakkYukuSSupersickSamplePackFree83LiNoiseTexture.mp3";
import modPhrase01 from "./assets/samples/revBomKlakkYukuSSupersickSamplePackFree84ModPhrase01.mp3";
import modPhrase01Am from "./assets/samples/revBomKlakkYukuSSupersickSamplePackFree85ModPhrase01Am.mp3";
import chordWoolyNebula from "./assets/samples/samALaBamalotBomKlakkYukuSSupersickSamplePackFree86ChordWoolyNebula.mp3";
import flappy125 from "./assets/samples/samLinkBomKlakkYukuSSupersickSamplePackFree87Flappy125.mp3";
import textureSteamLocomotive from "./assets/samples/soreabBomKlakkYukuSSupersickSamplePackFree88TextureSteamLocomotive.mp3";
import mashedRutabagas from "./assets/samples/sprocketmossBomKlakkYukuSSupersickSamplePackFree89FxMashedRutabagas.mp3";
import bassNeurality from "./assets/samples/tenebreBomKlakkYukuSSupersickSamplePackFree90BassNeurality.mp3";
import padInterferance from "./assets/samples/theScienceBomKlakkYukuSSupersickSamplePackFree91PadInterferance.mp3";
import textureRealityunfold from "./assets/samples/theScienceBomKlakkYukuSSupersickSamplePackFree92TextureRealityunfold.mp3";
import fmHorn from "./assets/samples/trakaBomKlakkYukuSSupersickSamplePackFree93FmHorn.mp3";
import garageLoop from "./assets/samples/trakaBomKlakkYukuSSupersickSamplePackFree94GarageLoop.mp3";
import neuro from "./assets/samples/trakaBomKlakkYukuSSupersickSamplePackFree95Neuro.mp3";
import swing from "./assets/samples/trakaBomKlakkYukuSSupersickSamplePackFree96Swing.mp3";

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

  // BomKlakkYukuS samples
  // { name: "Vocal What To Believe", url: vocalWhatToBelieve },
  // { name: "AAA", url: aaa },
  // { name: "Acid Loop", url: acidLoop },
  { name: "Mangled Chords", url: mangledChords },
  // { name: "Bass Cybershot", url: bassCybershot },
  // { name: "Moan Pad 2", url: moanPad2 },
  // { name: "Bassline Unstable", url: basslineUnstable },
  // { name: "Bass Just A Scratch", url: bassJustAScratch },
  { name: "Creak Percie", url: creakPercie },
  { name: "Pong Percie", url: pongPercie },
  { name: "808C Harmonic Beauty", url: harmonicBeauty },
  // { name: "FM Bass Alien Race", url: fmBassAlienRace },
  // { name: "Drumloop Splak", url: drumloopSplak },
  // { name: "Yuku Drum Loop", url: yukuDrumLoop },
  { name: "Moved By You FX", url: movedByYouFx },
  { name: "Istanbul Trafigi Kick", url: istanbulTrafigIKick },
  // { name: "Playground Ride Perc", url: playgroundRidePerc },
  { name: "Ritim Atolyesi Resonance", url: ritimAtoLyesiResonance },
  // { name: "Bass Loop", url: bassLoop },
  // { name: "Percussion Rim Loop", url: percussionRimLoop },
  // { name: "Break Palm Grease", url: breakPalmGrease },
  { name: "Pad Water Damage", url: padWaterDamage },
  { name: "Stab Weather Report", url: stabWeatherReport },
  { name: "Chord Remix Me", url: chordRemixMe },
  // { name: "FX Sound The Loss Of Hearing", url: fxSoundTheLossOfHearing },
  { name: "Pad Beyond", url: padBeyond },
  // { name: "Bass Bram 01", url: bassBram01 },
  // { name: "Bass Bram 02", url: bassBram02 },
  { name: "Synth Darker", url: synthDarker },
  { name: "Glasskik", url: glasskik },
  // { name: "Bassline 89BPM D", url: bassline89BpmD },
  // { name: "Bassline 160BPM D", url: bassline160BpmD },
  // { name: "Bleeps 160BPM Am", url: bleeps160BpmAm },
  // { name: "Pad 89BPM Am", url: pad89BpmAm },
  // { name: "Vocal Count 140BPM", url: vocalCount140Bpm },
  { name: "Broom Sound", url: broomSound },
  { name: "Gqom Originator Kick", url: gqomOriginatorKick },
  { name: "Hard HitHat", url: hardHitHat },
  { name: "Reaktor Noise", url: reaktorNoise },
  // { name: "Bass Loop Heavy Hitter 136BPM", url: bassLoopHeavyHitter },
  // { name: "Kick Sub Punch", url: kickSubPunch },
  // { name: "Perc Loop Boxed Synco 136BPM", url: percLoopBoxedSynco },
  // { name: "Bassloop Sound Of 141", url: bassloopSoundOf141 },
  // { name: "Drumloop Differences 137", url: drumloopDifferences137 },
  // { name: "Drum Loop SheSAlways 135", url: drumLoopSheSAlways135 },
  // { name: "Drum Loop Rigorous Breaks", url: drumLoopRigorousBreaks },
  { name: "Glitch Hell Cockroach", url: glitchHellCockroach },
  // { name: "Drum Loop Bent Groove", url: drumLoopBentGroove },
  { name: "Impact Spring Crash", url: impactSpringCrash },
  { name: "Retroverbed Kick", url: retroverbedKick },
  { name: "Klahrk Kick", url: klahrkKick },
  { name: "Kick Long Gabber", url: kickLongGabber },
  { name: "Modkick", url: modkick },
  { name: "Dolphin Perc", url: dolphinPerc },
  { name: "Helix Door", url: helixDoor },
  { name: "Helix Snare", url: helixSnare },
  { name: "Bass", url: bass },
  { name: "Pad 2 Extended", url: pad2Extended },
  { name: "Pad", url: pad },
  { name: "Percu 1", url: percu1 },
  { name: "SFX Builder", url: sfxBuilder },
  { name: "Dirty Pad", url: dirtyPad },
  { name: "Textural Mud Pie", url: texturalMudPie },
  // { name: "Blauw Sample 1 132BPM", url: blauwSample1 },
  // { name: "Blauw Sample 2 132BPM", url: blauwSample2 },
  // { name: "Changing Horses 116BPM", url: changingHorses },
  { name: "Magnopause", url: magnopause },
  // { name: "Victoria Edge Atmos 97BPM", url: victoriaEdgeAtmos },
  // { name: "Victoria Edge Bassline 97BPM", url: victoriaEdgeBassline },
  // { name: "Victoria Edge Voices 97BPM", url: victoriaEdgeVoices },
  { name: "Wub Bass", url: wubBass },
  { name: "Clap Chat", url: clapChat },
  { name: "Vroom Vroom Fire", url: vroomVroomFire },
  { name: "Percussion Gongs", url: percussionGongs },
  // { name: "OCoast Bassline A 138BPM", url: oCoastBassline },
  // { name: "Usul Percussion 138BPM", url: usulPercussion },
  // { name: "Flute Argoul", url: fluteArgoul },
  // { name: "Polydrums 135BPM", url: polydrums },
  { name: "Ghost In The Porridge", url: ghostInThePorridge },
  { name: "Reesiest Riser Ever Risen", url: reesiestRiser },
  { name: "Extract", url: extract },
  // { name: "Yuku Sample 1", url: yukuSample1 },
  // { name: "Texture Vowel Loop", url: textureVowelLoop },
  { name: "Li Noise Texture", url: liNoiseTexture },
  { name: "Mod Phrase 01", url: modPhrase01 },
  { name: "Mod Phrase 01 Am", url: modPhrase01Am },
  { name: "Chord Wooly Nebula", url: chordWoolyNebula },
  { name: "Flappy 125", url: flappy125 },
  // { name: "Texture Steam Locomotive", url: textureSteamLocomotive },
  // { name: "Mashed Rutabagas", url: mashedRutabagas },
  // { name: "Bass Neurality", url: bassNeurality },
  { name: "Pad Interferance", url: padInterferance },
  { name: "Texture Reality Unfold", url: textureRealityunfold },
  { name: "FM Horn", url: fmHorn },
  // { name: "Garage Loop", url: garageLoop },
  { name: "Neuro", url: neuro },
  // { name: "Swing", url: swing },
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
          // { value: "2", label: "2× Speed" },
          // { value: "4", label: "4× Speed" },
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
export const hexGridSizeAtom = atom(11);
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
export const isPathCreationModeAtom = atom(false);
export const mobilePanelOpenAtom = atom(false);

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

// Optional: Define getFallbackNote if not already defined
function getFallbackNote(sampleName, userSamples) {
  // Implement logic to determine a fallback note based on sampleName or other criteria
  // For simplicity, returning a default note
  return "C4";
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
  const [isPathCreationMode, setIsPathCreationMode] = useAtom(
    isPathCreationModeAtom
  );
  const [loadingProgress, setLoadingProgress] = useState({
    loaded: 0,
    total: 0,
  });

  // Access user samples
  const [userSamples] = useAtom(userSamplesAtom);
  console.log("paths", paths);

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

            pathsToUse.forEach((pathObj) => {
              const { id: pathId } = pathObj;
              const connectedBranches = _.filter(
                branchesRef.current,
                (b) => b?.parentPathId === pathId
              );

              const speedBranch = connectedBranches.find(
                (branch) => branch?.effect?.name === "Speed"
              );

              if (speedBranch?.effectConfig?.rate?.value) {
                const rate = parseFloat(speedBranch.effectConfig.rate.value);
                if (!isNaN(rate) && rate > 0) {
                  pathSpeedRatesRef.current[pathId] = rate;
                }
              }
            });

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

                // (line ~388)
                const currentHex = path[currentIndex];
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

                    // Pan functionality: retrieve the pan value from the current path and normalize (-12 dB to +12 dB => -1 to +1)
                    const currentPath = currentPaths.find(
                      (p) => p.id === pathId
                    );
                    const panValue =
                      currentPath?.pan !== undefined ? currentPath.pan : 0;
                    const normalizedPan = panValue / 12;

                    console.log("currentPath.pan", currentPath.pan);
                    console.log("normalizedPan", normalizedPan);

                    // Handle audio playback through effects or direct
                    if (audioEffectBranches.length > 0) {
                      audioEffectBranches.forEach((branch) => {
                        const branchNode =
                          branchEffectNodesRef.current[branch.id];
                        if (branchNode?.players) {
                          const player =
                            branchNode.players[hexToUpdate.sampleName];
                          if (player && player.loaded) {
                            // Insert panner into the branch chain without breaking the existing effect chain
                            if (!player._panner) {
                              player.disconnect();
                              const panner = new Tone.Panner(normalizedPan);
                              player.connect(panner);
                              panner.connect(branchNode.effectNode);
                              player._panner = panner;
                            } else {
                              player._panner.pan.value = normalizedPan;
                            }
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
                        if (!player._panner) {
                          player.disconnect();
                          const panner = new Tone.Panner(
                            normalizedPan
                          ).toDestination();
                          player.connect(panner);
                          player._panner = panner;
                        } else {
                          player._panner.pan.value = normalizedPan;
                        }
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
      // (line ~494)
      setCurrentIndices(() => {
        const resetIndices = {};
        paths.forEach((path) => {
          resetIndices[path.id] = 0;
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

  // // In App.jsx, replace the sample loading useEffect
  useEffect(() => {
    console.log("Starting sample initialization");
    const players = {};
    const allSamples = [...sampleStore, ...userSamples];
    let loadedCount = 0;
    const totalCount = allSamples.length;

    // Set initial loading state
    setLoadingProgress({ loaded: 0, total: totalCount });

    // Load each sample synchronously like in the original version
    allSamples.forEach((sample) => {
      console.log(`Creating player for sample: ${sample.name}`);

      const player = new Tone.Player({
        url: sample.url,
        fadeOut: 0.01,
        retrigger: true,
        curve: "linear",
        onload: () => {
          loadedCount += 1;
          console.log(
            `Loaded sample ${sample.name} (${loadedCount}/${totalCount})`
          );
          setLoadingProgress({ loaded: loadedCount, total: totalCount });

          if (loadedCount === totalCount) {
            console.log("All samples loaded successfully");
            setIsLoadingSamples(false);
          }
        },
        onerror: (error) => {
          console.error(`Error loading sample ${sample.name}:`, error);
        },
      }).toDestination();

      players[sample.name] = player;
    });

    // Set the ref immediately like in the original version
    samplerRef.current = players;

    return () => {
      Object.values(players).forEach((player) => {
        try {
          player.stop();
          player.disconnect();
          player.dispose();
        } catch (error) {
          console.error("Error cleaning up player:", error);
        }
      });

      // Optionally, reset the samplerRef
      samplerRef.current = null;
    };
  }, [sampleStore, userSamples]);

  // Keep the LoadingUI component as is
  const LoadingUI = ({ loadedCount, totalCount }) => (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="text-neutral-300">Loading samples...</div>
      <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-neutral-400 transition-all duration-300"
          style={{ width: `${(loadedCount / totalCount) * 100}%` }}
        />
      </div>
      <div className="text-sm text-neutral-500">
        {loadedCount} / {totalCount} samples loaded
      </div>
    </div>
  );

  return (
    <>
      <Guide />
      <DndProvider backend={HTML5Backend}>
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white">
          <div className="flex flex-wrap w-full max-w-screen-xl">
            <div className="block lg:hidden fixed top-12 left-0 right-0 text-lg my-4 text-center mx-auto z-50">
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

            <div className="w-full lg:w-1/2 flex justify-center items-center origin-top scale-[0.8] sm:scale-100">
              <div className="relative">
                {/* Render the Grid and P5Overlay */}
                <HexGrid />
                <P5Overlay />
              </div>
            </div>
            <div className="w-full lg:w-1/2 flex justify-center items-center">
              {isLoadingSamples ? (
                <LoadingUI
                  loadedCount={loadingProgress.loaded}
                  totalCount={loadingProgress.total}
                />
              ) : (
                <ControlsWrapper
                  isAudioPlaying={isAudioPlaying}
                  selectedSample={selectedSample}
                  setSelectedSample={setSelectedSample}
                  onControlPress={() => {}}
                  samplerRef={samplerRef}
                />
              )}
            </div>
          </div>
        </div>
      </DndProvider>
    </>
  );
};

export default App;
