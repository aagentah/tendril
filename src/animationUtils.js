// animationUtils.js
// Shared utilities for animations and styling across components

/**
 * Generates styling for a hex based on its properties and the current application state
 *
 * @param {Object} hex - The hex object with all its properties
 * @param {Object} state - The current application state (selected items, mode, etc.)
 * @returns {Object} An object with styling properties for the hex
 */
export const getHexStyling = (hex, state) => {
  const {
    isMainHex,
    isCenterRing,
    isOuterRing,
    isPathDraft,
    isPath,
    isBranch,
    isPlaying,
    sampleName,
    effect,
    isPathSelected,
    isBranchSelected,
    lastHexInPath,
  } = hex;

  const {
    selectedSample,
    selectedEffect,
    isPathCreationMode,
    paths,
    draftPath,
    isAdjacentToPathEnd,
  } = state;

  // Default styling
  let styling = {
    fillColor: "transparent",
    strokeColor: "#666666",
    strokeOpacity: 1,
    strokeWidth: 0.5,
    cursor: "cursor-default",
    fontSize: 12,
    finalFillOpacity: 1,
  };

  // Basic styling
  if (paths.length === 0 && !selectedSample?.name) {
    styling.strokeOpacity = 0.2;
  }

  // Main/Center/Outer ring styling
  if (isMainHex || isCenterRing) {
    styling.fillColor = "#171717";
    styling.strokeColor = "#171717";
  }
  if (isOuterRing) {
    styling.fillColor = "#171717";
  }

  if (isPath) {
    styling.strokeOpacity = 1;
  }

  // Make branch hexes invisible but keep them functional
  if (isBranch && !isPath) {
    styling.fillColor = "transparent";
    styling.strokeOpacity = 0;
    styling.finalFillOpacity = 0;
  }

  // Effect placement visualization
  if (!isPath && !isBranch && selectedEffect?.type && isAdjacentToPathEnd) {
    if (selectedEffect.type === "fx") {
      styling.fillColor = "grey";
      styling.strokeWidth = 2;
      styling.strokeOpacity = 1;
      styling.cursor = "cursor-pointer";
    }
  }

  // Playing state
  if (isPlaying && sampleName) {
    styling.fillColor = "#666666";
  }

  // Selection highlights
  if (isPathSelected && !(isPlaying && sampleName)) {
    styling.fillColor = "#171717";
    styling.strokeWidth = 4;
    styling.strokeColor = "#666666";
  }

  // Endpoint styling
  if (!isPathSelected && isPath && lastHexInPath) {
    styling.strokeColor = "#850D15";
    styling.strokeWidth = 1;
  }
  if (effect.type === "fx" && isBranch && lastHexInPath) {
    styling.strokeColor = "grey";
    styling.strokeWidth = 1;
  }

  // Final fill color for various conditions
  let finalFillColor = styling.fillColor;

  // If a sample can be placed here (and there's no sample yet)
  if (selectedSample?.name && isPath && !sampleName) {
    finalFillColor = "#850D15"; // Static red for sample placement
  }
  // If an FX can be placed here
  else if (
    selectedEffect?.type === "fx" &&
    !isPath &&
    !isBranch &&
    isAdjacentToPathEnd
  ) {
    finalFillColor = "grey"; // Static grey for FX
  }

  // Path Creation Mode Visualization
  if (isPathCreationMode) {
    styling.strokeOpacity = 0.5;

    if (isPath || isAdjacentToPathEnd) {
      styling.cursor = "cursor-not-allowed";
      styling.fillColor = "#1a1a1a";
      styling.strokeColor = "#666666";
      styling.strokeWidth = 1;
      styling.strokeOpacity = 1;
    }

    if (isPathDraft) {
      styling.strokeOpacity = 1;
      styling.strokeWidth = 2;
      styling.strokeColor = "#666666";
      styling.fillColor = "#444444";
      finalFillColor = "#444444"; // Ensure draft path is visible
      styling.cursor = "cursor-pointer";
    }

    if (draftPath.length > 0) {
      // Add specific styling for path draft visualization
      if (isPathDraft) {
        // Find position in draft path to create visual sequence
        const index = draftPath.findIndex(
          (dh) => dh.q === hex.q && dh.r === hex.r
        );
        if (index >= 0) {
          // Gradient effect based on position in path
          const opacity = 0.3 + (0.7 * (index + 1)) / draftPath.length;
          styling.finalFillOpacity = opacity;

          // Last hex in draft gets special styling
          if (index === draftPath.length - 1) {
            styling.strokeWidth = 3;
            styling.strokeColor = "#888888";
          }
        }
      }
    }
  }

  return {
    ...styling,
    finalFillColor,
  };
};

/**
 * Create noise data for animated elements
 *
 * @param {Object} p - The p5 instance
 * @param {number} numLayers - Number of animation layers
 * @param {number} noiseIncrement - The increment for noise movement
 * @returns {Array} Array of noise data objects
 */
export const createNoiseData = (p, numLayers, noiseIncrement = 0.01) => {
  return Array(numLayers)
    .fill()
    .map(() => ({
      x: p.random(1000),
      y: p.random(1000),
      dx: p.random(0.001, noiseIncrement),
      dy: p.random(0.001, noiseIncrement),
    }));
};

/**
 * Synchronize noise data with current items
 *
 * @param {Object} currentItems - Current items (paths, branches)
 * @param {Object} noiseData - Current noise data object
 * @param {Function} createNoise - Function to create new noise data
 * @returns {Object} Updated noise data
 */
export const syncNoiseData = (currentItems, noiseData, createNoise) => {
  const updatedNoiseData = { ...noiseData };

  // Add noise data for new items
  currentItems.forEach((item) => {
    if (!updatedNoiseData[item.id]) {
      updatedNoiseData[item.id] = createNoise();
    }
  });

  // Remove noise data for items that no longer exist
  Object.keys(updatedNoiseData).forEach((itemId) => {
    if (!currentItems.find((item) => item.id === itemId)) {
      delete updatedNoiseData[itemId];
    }
  });

  return updatedNoiseData;
};

/**
 * Draw an animated path with perlin noise distortion
 *
 * @param {Object} p - The p5 instance
 * @param {Array} path - Array of points to draw
 * @param {Array} noiseData - Noise data for animation
 * @param {Array} color - RGBA color array
 * @param {number} noiseFactor - Factor for noise distortion
 * @param {number} hexRadius - Radius of hexes for scaling
 * @param {Object} dimensions - Canvas dimensions
 */
export const drawAnimatedPath = (
  p,
  path,
  noiseData,
  color,
  noiseFactor,
  hexRadius,
  dimensions
) => {
  if (path.length <= 1) return;

  // Update noise position
  noiseData.x += noiseData.dx;
  noiseData.y += noiseData.dy;

  p.beginShape();

  path.forEach((point, index) => {
    let { x, y } = point;

    // Apply noise distortion
    const angle =
      p.noise(noiseData.x + x * 0.01, noiseData.y + y * 0.01) * Math.PI * 2;
    const distortion = p.noise(noiseData.x, noiseData.y) * noiseFactor;

    x += Math.cos(angle) * distortion;
    y += Math.sin(angle) * distortion;

    // Center in canvas
    x += dimensions.width / 2;
    y += dimensions.height / 2;

    // Special handling for endpoints
    if (index === path.length - 1) {
      const controlX = x - hexRadius * 0.2;
      const controlY = y - hexRadius * 0.3;
      p.curveVertex(controlX, controlY);
      p.curveVertex(x, y + hexRadius * 0.2);
      p.curveVertex(x, y + hexRadius * 0.2);
    } else if (index === 0) {
      p.curveVertex(x, y);
      p.curveVertex(x, y);
    } else {
      p.curveVertex(x, y);
    }
  });

  p.endShape();

  // Apply color
  p.stroke(color[0], color[1], color[2], color[3]);
};
