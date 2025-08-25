// audioService.js - Centralized audio functionality
import * as Tone from "tone";

// Audio manipulation handlers for utilities and effects
export const utilityHandlers = {
  Offset: (context, config) => {
    const { amount } = config;
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
  Probability: (context, config) => {
    const { chance } = config;
    const probabilityChance = parseFloat(chance.value);
    // Probability affects whether the sample triggers at all
    // Generate random number and compare against probability threshold
    const randomValue = Math.random();
    if (randomValue > probabilityChance) {
      // Skip this trigger - mark context as cancelled
      context.cancelled = true;
    }
    return context;
  },
};

// Audio effect handlers for path-level effects
export const effectHandlers = {
  Chaos: (context, config) => {
    const { amount } = config;
    const chaosAmount = parseFloat(amount.value);
    // Chaos affects timing randomization - this is handled at path level
    // We store the chaos amount for use in timing calculations
    context.chaosAmount = chaosAmount;
    return context;
  },
};

/**
 * Safely triggers a sample with validation and error handling
 * @param {Object} players - The player instances
 * @param {String} sampleName - Name of the sample to play
 * @param {Number} duration - Duration to play
 * @param {Number} time - Start time
 * @returns {Boolean} - Whether playback was successful
 */
export const triggerSampleWithValidation = (
  players,
  sampleName,
  duration,
  time,
  lastStartTimeRef = {}
) => {
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
    const lastTime = lastStartTimeRef[sampleName] || 0;
    const finalStartTime = Math.max(safeStartTime, lastTime + 0.01);
    lastStartTimeRef[sampleName] = finalStartTime;

    // Calculate a safe duration
    const safeDuration = Math.max(duration || 0.25, 0.1);

    // Start the player with the calculated safe times
    player.start(finalStartTime, 0, safeDuration);
    return true;
  } catch (error) {
    console.error(`Error playing sample ${sampleName}:`, error);
    return false;
  }
};

/**
 * Initializes the recording functionality
 * @returns {Tone.Recorder} - The recorder instance
 */
export const initializeRecorder = () => {
  const recorder = new Tone.Recorder();
  Tone.getDestination().connect(recorder);
  return recorder;
};

/**
 * Starts audio context
 */
export const startAudio = async () => {
  await Tone.start();
};

/**
 * Safely stops and cleans up all audio players
 * @param {Object} samplerRef - Reference to all sample players
 * @param {Object} branchEffectNodesRef - Reference to all effect nodes
 */
export const stopAllAudio = (samplerRef, branchEffectNodesRef) => {
  const now = Tone.now();
  Tone.Transport.cancel();
  Tone.Transport.stop();

  // Clean up audio nodes
  if (samplerRef.current) {
    Object.values(samplerRef.current).forEach((player) => {
      if (player?.stop) {
        player.stop(now);
        player.mute = true;
      }
    });
  }

  if (branchEffectNodesRef.current) {
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
  }
};
