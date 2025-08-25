import { useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import * as Tone from "tone";
import _ from "lodash";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// Import atoms from centralized atom store
import {
  hexesAtom,
  isAudioPlayingAtom,
  hexGridSizeAtom,
  bpmAtom,
  pathsAtom,
  branchesAtom,
  currentIndicesAtom,
  selectedSampleAtom,
  userSamplesAtom,
  loadingProgressAtom,
  isPathCreationModeAtom,
  isLoadingSamplesAtom,
  draftPathAtom,
  effectDraftPathAtom,
  HEX_RADIUS,
  predefinedCenterRingHexes,
  predefinedOuterRing,
} from "./atomStore";

// Import utility functions
import {
  generateHexPoints,
  axialToPixel,
  getHexNeighbours,
  areCoordinatesEqual,
} from "./hexUtils";

// Import audio service functions
import { triggerSampleWithValidation, utilityHandlers } from "./audioService";

// Import sample store
import { sampleStore, effectStore } from "./sampleStore";

// Components
import P5Overlay from "./P5Overlay";
import Guide from "./Guide";
import ControlsWrapper from "./Controls";
import HexGrid from "./Grid";

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
  const [isPathCreationMode] = useAtom(isPathCreationModeAtom);
  const [loadingProgress, setLoadingProgress] = useAtom(loadingProgressAtom);
  const [isLoadingSamples, setIsLoadingSamples] = useAtom(isLoadingSamplesAtom);

  // Access user samples
  const [userSamples] = useAtom(userSamplesAtom);

  const samplerRef = useRef(null);
  const branchEffectNodesRef = useRef({});
  const pathEffectNodesRef = useRef({}); // For path-level effects like Chaos and Impala
  const noteTime = "8n";

  const pathsRef = useRef(paths);
  const branchesRef = useRef(branches);
  const currentIndicesRef = useRef(currentIndices);
  const pathSpeedRatesRef = useRef({});
  const lastStartTimeRef = useRef({});
  const transportScheduleRef = useRef(null);

  // Helper function to get effect value (randomized or fixed)
  const getEffectValue = (effectName, path) => {
    // Map effect names to their correct randomization property names
    const randomizationKeyMap = {
      Chaos: "chaosRandomization",
      Distortion: "distortionRandomization",
      PitchShift: "pitchShiftRandomization",
    };
    const randomizationKey = randomizationKeyMap[effectName];
    const randomSettings = path?.[randomizationKey];

    // Map effect names to their correct property names on the path
    const propertyNameMap = {
      Chaos: "chaos",
      Distortion: "distortion",
      PitchShift: "pitchShift",
    };
    const propertyName = propertyNameMap[effectName];
    const baseValue = path?.[propertyName] || 0;

    console.log(
      `🔍 ${effectName}: randomSettings=`,
      randomSettings,
      `baseValue=${baseValue}`
    );

    if (randomSettings?.enabled) {
      // When randomization is enabled, use the random range
      const { min, max } = randomSettings;
      const randomValue = min + Math.random() * (max - min);
      console.log(
        `✅ ${effectName} randomized: ${randomValue.toFixed(
          3
        )} (range: ${min} to ${max})`
      );
      return randomValue;
    }
    // When randomization is disabled, use the base path value
    console.log(`❌ ${effectName} not randomized, using base: ${baseValue}`);
    return baseValue;
  };

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
            if (Object.prototype.hasOwnProperty.call(prevIndices, pathId)) {
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
          // Utilities are handled at branch level
          effectNode = new Tone.Gain().toDestination();
        } else if (branch.effect.type === "effect") {
          // Effects are handled at path level, so just use a gain node for the branch
          switch (branch.effect.name) {
            case "Chaos":
              effectNode = new Tone.Gain().toDestination();
              break;
            case "Distortion":
              effectNode = new Tone.Gain().toDestination();
              break;
            case "PitchShift":
              effectNode = new Tone.Gain().toDestination();
              break;
            default:
              effectNode = new Tone.Gain().toDestination();
              break;
          }
        } else {
          // Fallback for any unrecognized effect types
          effectNode = new Tone.Gain().toDestination();
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

  // Path-level effects management with post-effects utilities
  useEffect(() => {
    paths.forEach((path) => {
      if (!pathEffectNodesRef.current[path.id]) {
        // Create Chaos (FeedbackDelay) effect with initial zero values
        const chaosDelay = new Tone.FeedbackDelay({
          delayTime: 0,
          feedback: 0,
          wet: 0.5, // Mix between dry (original) and wet (delayed) signal
        });

        // Create Distortion effect with initial zero distortion
        const distortion = new Tone.Distortion({
          distortion: 0,
          wet: 1, // Always full wet - we control the effect with distortion amount
        });

        // Create PitchShift effect with initial zero pitch shift
        const pitchShift = new Tone.PitchShift({
          pitch: 0,
          wet: 0, // Start with no pitch shift effect
        });

        // Create post-effects utility nodes
        const postVolume = new Tone.Gain(path.volume ?? 1);
        const postPanner = new Tone.Panner((path.pan ?? 0) / 12);
        const pathGain = new Tone.Gain(1).toDestination();

        // Chain the complete signal: input (chaosDelay) -> distortion -> pitchShift -> postVolume -> postPanner -> pathGain -> destination
        chaosDelay.connect(distortion);
        distortion.connect(pitchShift);
        pitchShift.connect(postVolume);
        postVolume.connect(postPanner);
        postPanner.connect(pathGain);

        pathEffectNodesRef.current[path.id] = {
          input: chaosDelay,
          chaosDelay,
          distortion,
          pitchShift,
          postVolume,
          postPanner,
          output: pathGain,
        };
      }
    });

    // Clean up removed paths
    Object.keys(pathEffectNodesRef.current).forEach((pathId) => {
      if (!paths.find((p) => p.id === pathId)) {
        const pathEffects = pathEffectNodesRef.current[pathId];
        if (pathEffects) {
          pathEffects.output.dispose();
          pathEffects.chaosDelay.dispose();
          pathEffects.distortion.dispose();
          pathEffects.postVolume.dispose();
          pathEffects.postPanner.dispose();
          delete pathEffectNodesRef.current[pathId];
        }
      }
    });
  }, [paths]);

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
                    // Check probability gate at path level
                    const pathProbability =
                      pathObj?.probability !== undefined
                        ? pathObj.probability
                        : 1;
                    const randomValue = Math.random();

                    // Skip this trigger if probability check fails
                    if (randomValue > pathProbability) {
                      return; // Exit this path iteration, don't trigger this sample
                    }

                    // ...existing code...
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

                    // Get path effects node for this path
                    const pathEffects = pathEffectNodesRef.current[pathId];

                    // Apply random Chaos values if path effects exist
                    if (pathEffects && currentPath) {
                      // Get effect values (randomized or fixed based on settings)
                      const baseChaosValue =
                        currentPath?.chaos !== undefined
                          ? currentPath.chaos
                          : 0;
                      const baseDistortionValue =
                        currentPath?.distortion !== undefined
                          ? currentPath.distortion
                          : 0;
                      const basePitchShiftValue =
                        currentPath?.pitchShift !== undefined
                          ? currentPath.pitchShift
                          : 0;

                      // Apply randomization if enabled
                      const chaosValue = getEffectValue("Chaos", currentPath);
                      const distortionValue = getEffectValue(
                        "Distortion",
                        currentPath
                      );
                      const pitchShiftValue = getEffectValue(
                        "PitchShift",
                        currentPath
                      );

                      // Always randomize delay time between 50ms and 125ms when chaos > 0
                      if (chaosValue > 0) {
                        const minDelayMs = 50;
                        const maxDelayMs = 125;
                        const randomDelayMs =
                          minDelayMs +
                          Math.random() * (maxDelayMs - minDelayMs);
                        const randomDelayTime = randomDelayMs / 1000;

                        // Feedback is random between 0 and 0.75, scaled by chaos amount
                        const randomFeedback =
                          Math.random() * 0.75 * chaosValue;

                        // Apply values to the delay effect
                        pathEffects.chaosDelay.delayTime.value =
                          randomDelayTime;
                        pathEffects.chaosDelay.feedback.value = randomFeedback;
                        pathEffects.chaosDelay.wet.value = 0.8 * chaosValue; // Wet scaled from 0 to 80% by chaos amount

                        // Debug log
                        const chaosRandomized =
                          currentPath?.chaosRandomization?.enabled;
                        console.log(
                          `Chaos applied: delay=${randomDelayMs.toFixed(
                            1
                          )}ms, feedback=${(randomFeedback * 100).toFixed(
                            1
                          )}%, wet=${(chaosValue * 100).toFixed(0)}%${
                            chaosRandomized ? " (chaos value randomized)" : ""
                          }`
                        );
                      } else {
                        // Disable chaos when value is 0
                        pathEffects.chaosDelay.wet.value = 0;
                      }

                      // Apply Distortion effect
                      if (distortionValue > 0.01) {
                        pathEffects.distortion.distortion = distortionValue;
                        pathEffects.distortion.wet.value = 1; // Full wet when active
                      } else {
                        pathEffects.distortion.distortion = 0;
                        pathEffects.distortion.wet.value = 0; // Bypass when zero
                      }

                      // Apply PitchShift effect
                      pathEffects.pitchShift.pitch = pitchShiftValue;
                      pathEffects.pitchShift.wet.value =
                        Math.abs(pitchShiftValue) > 0.01 ? 1 : 0; // Wet is 1 when pitch shift is active (> 0.01), 0 when disabled

                      // Apply post-effects volume and pan utilities
                      pathEffects.postVolume.gain.value = pathVolume;
                      pathEffects.postPanner.pan.value = normalizedPan;

                      // Debug log with randomization info
                      const chaosRandomized =
                        currentPath?.chaosRandomization?.enabled;
                      const distortionRandomized =
                        currentPath?.distortionRandomization?.enabled;
                      const pitchShiftRandomized =
                        currentPath?.pitchShiftRandomization?.enabled;

                      console.log(
                        `Distortion applied: amount=${(
                          distortionValue * 100
                        ).toFixed(0)}%${
                          distortionRandomized ? " (randomized)" : ""
                        }, wet=${(distortionValue * 100).toFixed(0)}%`
                      );
                      console.log(
                        `PitchShift applied: pitch=${pitchShiftValue.toFixed(
                          1
                        )} semitones${
                          pitchShiftRandomized ? " (randomized)" : ""
                        }, wet=${pitchShiftValue !== 0 ? 100 : 0}%`
                      );
                      console.log(
                        `Post-effects utilities: volume=${pathVolume.toFixed(
                          2
                        )}, pan=${normalizedPan.toFixed(2)}`
                      );
                    }
                    // ...existing code for audio routing, etc...

                    // Handle audio playback through effects or direct
                    if (audioEffectBranches.length > 0) {
                      audioEffectBranches.forEach((branch) => {
                        const branchNode =
                          branchEffectNodesRef.current[branch.id];
                        if (branchNode?.players) {
                          const player =
                            branchNode.players[hexToUpdate.sampleName];
                          if (player && player.loaded) {
                            // Always reconnect to ensure fresh routing with current effect values
                            player.disconnect();

                            // Route through path effects if available
                            if (pathEffects) {
                              player.connect(pathEffects.input);
                              // Connect path effects output to branch effect
                              pathEffects.output.disconnect();
                              pathEffects.output.connect(branchNode.effectNode);
                            } else {
                              player.connect(branchNode.effectNode);
                            }
                            // Volume and pan now handled by post-effects nodes
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
                        // Always reconnect to ensure fresh routing with current effect values
                        player.disconnect();

                        // Route through path effects if available
                        if (pathEffects) {
                          player.connect(pathEffects.input);
                        } else {
                          player.toDestination();
                        }
                        // Volume and pan now handled by post-effects nodes
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
