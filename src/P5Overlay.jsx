import { useRef, useEffect } from "react";
import p5 from "p5";
import { useAtom } from "jotai";
import _ from "lodash";

// Import atoms from centralized store
import {
  pathsAtom,
  branchesAtom,
  hexesAtom,
  SVG_WIDTH,
  SVG_HEIGHT,
  HEX_RADIUS,
} from "./atomStore";
import { axialToPixel, getPathEdges } from "./hexUtils";

// Import animation utilities
import {
  createNoiseData,
  syncNoiseData,
  drawAnimatedPath,
} from "./animationUtils";

// Constants for SVG dimensions and hexagon size
const NUM_LAYERS_PATH = 5; // Number of lines per path
const NUM_LAYERS_BRANCH = 3; // Number of lines per branch
const NOISE_INCREMENT = 0.01; // Controls the speed of the noise animation
const NOISE_FACTOR_PATH = 5.5; // Base distortion factor path
// NOISE_FACTOR_BRANCH removed since branch rendering is disabled

const P5Overlay = () => {
  const containerRef = useRef(null);
  const [paths] = useAtom(pathsAtom);
  const [branches] = useAtom(branchesAtom);
  const [hexes] = useAtom(hexesAtom);

  // Refs to hold the latest data
  const pathsRef = useRef(paths);
  const branchesRef = useRef(branches);
  const hexesRef = useRef(hexes);

  const CENTER_HEX_RADIUS = 1.1; // Radius of the hex circle

  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);

  useEffect(() => {
    hexesRef.current = hexes;
  }, [hexes]);

  useEffect(() => {
    const sketch = (p) => {
      let noiseData = {};
      let branchesNoiseData = {};
      let circleNoiseData = [];

      p.setup = () => {
        p.createCanvas(SVG_WIDTH, SVG_HEIGHT);
        p.clear();
        p.noFill();
        p.strokeWeight(0.75);

        // Use utility functions to initialize noise data
        const createLayerNoise = (numLayers) =>
          createNoiseData(p, numLayers, NOISE_INCREMENT);

        // Initialize paths noise data
        pathsRef.current.forEach((pathObj) => {
          noiseData[pathObj.id] = createLayerNoise(NUM_LAYERS_PATH);
        });

        // Initialize branches noise data
        branchesRef.current.forEach((branchObj) => {
          branchesNoiseData[branchObj.id] = createLayerNoise(NUM_LAYERS_BRANCH);
        });

        // Initialize circle animations
        circleNoiseData = createLayerNoise(5);
      };

      p.draw = () => {
        p.clear();
        p.noFill();
        p.strokeWeight(0.75);

        const currentPaths = pathsRef.current;
        const currentBranches = branchesRef.current;
        const currentHexes = hexesRef.current;

        // Use utility function to sync noise data
        noiseData = syncNoiseData(
          currentPaths,
          noiseData,
          () => createNoiseData(p, NUM_LAYERS_PATH, NOISE_INCREMENT),
          NUM_LAYERS_PATH
        );

        branchesNoiseData = syncNoiseData(
          currentBranches,
          branchesNoiseData,
          () => createNoiseData(p, NUM_LAYERS_BRANCH, NOISE_INCREMENT),
          NUM_LAYERS_BRANCH
        );

        /**
         * Enhanced wrapper around the utility function to draw animated paths or branches
         */
        const drawLayeredPaths = (
          items,
          noiseDataObj,
          colorFn,
          isBranch = false,
          noiseFactor,
          numLayers
        ) => {
          _.forEach(items, (itemObj) => {
            let pathData;
            const itemId = itemObj.id;

            if (isBranch) {
              const parentPath = pathsRef.current.find(
                (path) => path.id === itemObj.parentPathId
              );
              if (parentPath && parentPath.path.length > 0) {
                // Use getPathEdges to get the last hex of the parent path
                const parentLastHexes = getPathEdges([parentPath], "last");
                const parentLastHex = parentLastHexes[0];

                if (
                  parentLastHex &&
                  itemObj.branch.length > 0 &&
                  itemObj.branch[0].q === parentLastHex.q &&
                  itemObj.branch[0].r === parentLastHex.r
                ) {
                  // The branch already starts with the parentLastHex
                  pathData = itemObj.branch;
                } else if (parentLastHex) {
                  pathData = [parentLastHex, ...itemObj.branch];
                } else {
                  pathData = itemObj.branch;
                }
              } else {
                pathData = itemObj.branch;
              }
            } else {
              pathData = itemObj.path;
            }

            // Convert path to pixel coordinates
            const pixelPath = pathData.map((hex) => ({
              ...axialToPixel(hex.q, hex.r, HEX_RADIUS),
              q: hex.q,
              r: hex.r,
            }));

            if (pixelPath.length > 1) {
              const layerNoiseArray = noiseDataObj[itemId];

              // Draw each layer
              for (let layer = 0; layer < numLayers; layer++) {
                const color = colorFn(layer);
                const adjustedNoiseFactor = noiseFactor * (1 + layer * 0.2);

                drawAnimatedPath(
                  p,
                  pixelPath,
                  layerNoiseArray[layer],
                  color,
                  adjustedNoiseFactor,
                  HEX_RADIUS,
                  { width: SVG_WIDTH, height: SVG_HEIGHT }
                );
              }
            }
          });
        };

        // Draw the main paths in red
        drawLayeredPaths(
          currentPaths,
          noiseData,
          (layer) => [255, 0, 0, 200 - layer * 50], // Red color for paths
          false,
          NOISE_FACTOR_PATH,
          NUM_LAYERS_PATH
        );

        // Branch visual rendering disabled - utilities managed via path config
        // (keeping branch data intact for functionality)

        // Handle White Ball Animation
        const playingHexes = _.filter(currentHexes, (hex) => hex.isPlaying);

        _.forEach(playingHexes, (hex) => {
          const { x, y } = axialToPixel(hex.q, hex.r, HEX_RADIUS);

          const targetX = x + SVG_WIDTH / 2;
          const targetY = y + SVG_HEIGHT / 2;

          p.noStroke();
          p.fill(255);
          p.ellipse(targetX, targetY, HEX_RADIUS * 0.2, HEX_RADIUS * 0.2);
        });

        const centerX = SVG_WIDTH / 2;
        const centerY = SVG_HEIGHT / 2;
        const baseRadius = 2 * HEX_RADIUS * CENTER_HEX_RADIUS * 0.85;

        _.forEach(circleNoiseData, (noiseObj, index) => {
          // Update Perlin noise offsets
          noiseObj.x += noiseObj.dx;
          noiseObj.y += noiseObj.dy;

          const layerRadius = baseRadius + index * HEX_RADIUS * 0.01; // Slightly larger radius for each circle
          const distortionFactor = 10; // Adjust this to control the distortion amount

          // Set stroke and disable fill to ensure only the circle outlines are drawn
          const alpha = 200 - index * 40; // Reduce alpha for outer circles
          p.stroke(255, 0, 0, alpha); // Red stroke with decreasing opacity
          p.noFill();

          p.beginShape();
          for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            // Calculate distorted radius using Perlin noise
            const noiseValue = p.noise(
              noiseObj.x + Math.cos(angle),
              noiseObj.y + Math.sin(angle)
            );
            const distortedRadius =
              layerRadius + noiseValue * distortionFactor * (1 + index * 0.2);

            // Convert polar coordinates to Cartesian
            const x = centerX + Math.cos(angle) * distortedRadius;
            const y = centerY + Math.sin(angle) * distortedRadius;

            p.vertex(x, y);
          }
          p.endShape(p.CLOSE);
        });
      };
    };

    const p5Instance = new p5(sketch, containerRef.current);

    return () => {
      p5Instance.remove();
    };
  }, [paths, branches]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
};

export default P5Overlay;
