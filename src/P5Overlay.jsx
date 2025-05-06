import React, { useRef, useEffect } from "react";
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
import { axialToPixel, generateHexPoints } from "./hexUtils";

// Constants for SVG dimensions and hexagon size
const NUM_LAYERS_PATH = 5; // Number of lines per path
const NUM_LAYERS_BRANCH = 3; // Number of lines per bracn
const NOISE_INCREMENT = 0.01; // Controls the speed of the noise animation
const NOISE_FACTOR_PATH = 5.5; // Base distortion factor path
const NOISE_FACTOR_BRANCH = 8; // Base distortion factor branch

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

  const generateHexCircle = (radius) => {
    const hexes = [];
    for (let q = -radius; q <= radius; q++) {
      for (
        let r = Math.max(-radius, -q - radius);
        r <= Math.min(radius, -q + radius);
        r++
      ) {
        hexes.push({ q, r });
      }
    }
    return hexes;
  };

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

        // Initialize noise data based on the initial paths
        noiseData = {};
        pathsRef.current.forEach((pathObj) => {
          const { id: pathId } = pathObj;
          noiseData[pathId] = _.times(NUM_LAYERS_PATH, () => ({
            x: p.random(1000),
            y: p.random(1000),
            dx: p.random(0.001, NOISE_INCREMENT),
            dy: p.random(0.001, NOISE_INCREMENT),
          }));
        });

        // Initialize noise data for branches
        branchesNoiseData = {};
        branchesRef.current.forEach((branchObj) => {
          const { id: branchId } = branchObj;
          branchesNoiseData[branchId] = _.times(NUM_LAYERS_BRANCH, () => ({
            x: p.random(1000),
            y: p.random(1000),
            dx: p.random(0.001, NOISE_INCREMENT),
            dy: p.random(0.001, NOISE_INCREMENT),
          }));
        });

        // Initialize noise data for the animated circles
        circleNoiseData = _.times(5, () => ({
          x: p.random(1000),
          y: p.random(1000),
          dx: p.random(0.001, NOISE_INCREMENT),
          dy: p.random(0.001, NOISE_INCREMENT),
        }));
      };

      p.draw = () => {
        p.clear();
        p.noFill();
        p.strokeWeight(0.75);

        const currentPaths = pathsRef.current;
        const currentBranches = branchesRef.current;
        const currentHexes = hexesRef.current;

        // Synchronize noiseData with currentPaths
        currentPaths.forEach((pathObj) => {
          const { id: pathId } = pathObj;
          if (!noiseData[pathId]) {
            noiseData[pathId] = _.times(NUM_LAYERS_PATH, () => ({
              x: p.random(1000),
              y: p.random(1000),
              dx: p.random(0.001, NOISE_INCREMENT),
              dy: p.random(0.001, NOISE_INCREMENT),
            }));
          }
        });

        // Remove noiseData entries for paths that no longer exist
        Object.keys(noiseData).forEach((pathId) => {
          if (!currentPaths.find((pathObj) => pathObj.id === pathId)) {
            delete noiseData[pathId];
          }
        });

        // Synchronize branchesNoiseData with currentBranches
        currentBranches.forEach((branchObj) => {
          const { id: branchId } = branchObj;
          if (!branchesNoiseData[branchId]) {
            branchesNoiseData[branchId] = _.times(NUM_LAYERS_BRANCH, () => ({
              x: p.random(1000),
              y: p.random(1000),
              dx: p.random(0.001, NOISE_INCREMENT),
              dy: p.random(0.001, NOISE_INCREMENT),
            }));
          }
        });

        // Remove branchesNoiseData entries for branches that no longer exist
        Object.keys(branchesNoiseData).forEach((branchId) => {
          if (!currentBranches.find((branchObj) => branchObj.id === branchId)) {
            delete branchesNoiseData[branchId];
          }
        });

        /**
         * Function to draw animated paths and branches.
         * @param {Array} items - The array of paths or branches.
         * @param {Object} noiseDataObj - The corresponding noise data object.
         * @param {Function} getColor - Function to get the stroke color.
         * @param {boolean} isBranch - Flag to indicate if drawing branches.
         */
        const drawAnimatedPath = (
          items,
          noiseDataObj,
          getColor,
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
                const parentLastHex =
                  parentPath.path[parentPath.path.length - 1];

                if (
                  itemObj.branch.length > 0 &&
                  itemObj.branch[0].q === parentLastHex.q &&
                  itemObj.branch[0].r === parentLastHex.r
                ) {
                  // The branch already starts with the parentLastHex
                  pathData = itemObj.branch;
                } else {
                  pathData = [parentLastHex, ...itemObj.branch];
                }
              } else {
                pathData = itemObj.branch;
              }
            } else {
              pathData = itemObj.path;
            }

            const noiseArray = noiseDataObj[itemId];

            if (pathData.length > 1) {
              for (let layer = 0; layer < numLayers; layer++) {
                noiseArray[layer].x += noiseArray[layer].dx;
                noiseArray[layer].y += noiseArray[layer].dy;

                p.beginShape();

                _.forEach(pathData, (hex, index) => {
                  let { x, y } = axialToPixel(hex.q, hex.r, HEX_RADIUS);

                  const noise = noiseFactor * (1 + layer * 0.2);
                  const angle =
                    p.noise(
                      noiseArray[layer].x + x * 0.01,
                      noiseArray[layer].y + y * 0.01
                    ) *
                    Math.PI *
                    2;
                  const distortion =
                    p.noise(noiseArray[layer].x, noiseArray[layer].y) * noise;

                  x += Math.cos(angle) * distortion;
                  y += Math.sin(angle) * distortion;

                  x += SVG_WIDTH / 2;
                  y += SVG_HEIGHT / 2;

                  if (index === pathData.length - 1) {
                    const controlX = x - HEX_RADIUS * 0.2;
                    const controlY = y - HEX_RADIUS * 0.3;
                    p.curveVertex(controlX, controlY);
                    p.curveVertex(x, y + HEX_RADIUS * 0.2);
                    p.curveVertex(x, y + HEX_RADIUS * 0.2);
                  } else if (index === 0) {
                    p.curveVertex(x, y);
                    p.curveVertex(x, y);
                  } else {
                    p.curveVertex(x, y);
                  }
                });

                p.endShape();

                const color = getColor(layer);
                p.stroke(color[0], color[1], color[2], color[3]);
              }
            }
          });
        };

        // Draw the main paths in red
        drawAnimatedPath(
          currentPaths,
          noiseData,
          (layer) => [255, 0, 0, 200 - layer * 50], // Red color for paths
          false,
          NOISE_FACTOR_PATH,
          NUM_LAYERS_PATH
        );

        // Draw the branches in white
        drawAnimatedPath(
          currentBranches,
          branchesNoiseData,
          () => [255, 255, 255, 200], // White color for branches
          true,
          NOISE_FACTOR_BRANCH,
          NUM_LAYERS_BRANCH
        );

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
