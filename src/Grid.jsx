// Grid.jsx

import React, { useState } from "react";
import { atom, useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import _ from "lodash";

// Import atoms from App.jsx
import {
  hexesAtom,
  selectedEffectAtom,
  selectedSampleAtom,
  pathsAtom,
  draftPathAtom,
  effectDraftPathAtom,
} from "./App";

// Import utilities and helper functions
import {
  updateHexProperties,
  findShortestPath,
  getPathEdges,
  areCoordinatesEqual,
  hexDistance,
  pathEdgeFromPath,
  branchEdgeFromBranch,
} from "./hexUtils";

// Import the Hex component
import Hex from "./Hex";

// SVG dimensions from App.jsx (or duplicate them here if needed)
import { SVG_WIDTH, SVG_HEIGHT } from "./App";

// Additional references from App.jsx
import { predefinedOuterRing } from "./App";

/**
 * The main hex grid, displaying all hexes and handling mouse interactions.
 */
const Grid = () => {
  const [hexes, setHexes] = useAtom(hexesAtom);

  const handleHexMouseEnter = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);

    if (selectedEffect.name && !hex.isPath) {
      // We are drawing an effect branch
      const lastHexes = getPathEdges(paths, "last").filter((h) => h);

      // Exit if no valid path edges
      if (lastHexes.length === 0) return;

      // Find nearest last hex
      let minDistance = Infinity;
      let nearestLastHex = null;

      for (const lastHex of lastHexes) {
        const distance = hexDistance(hex, lastHex);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLastHex = lastHex;
        }
      }

      if (nearestLastHex) {
        // Shortest path from nearest last hex to current hex
        const shortestPath = findShortestPath(nearestLastHex, hex, hexes);

        if (shortestPath.length > 0) {
          // Mark those hexes as effect draft
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(
              prevHexes,
              (h) =>
                shortestPath.find((p) => areCoordinatesEqual(p, h)) &&
                !h.isPath,
              { isEffectDraft: true }
            )
          );
          set(effectDraftPathAtom, shortestPath);
        }
      }
    } else if (
      selectedSample.click === 1 &&
      !selectedEffect.name &&
      !hex.isPath
    ) {
      // We are drawing a new path for a sample
      // Attempt path from the outer ring
      const shortestPathsToNeighbors = predefinedOuterRing
        .map((outerHex) => {
          // Actual hex in the grid
          const neighbor = hexes.find((h) => areCoordinatesEqual(h, outerHex));
          if (!neighbor) return null;

          const path = findShortestPath(neighbor, hex, hexes);
          return { neighbor, path };
        })
        .filter(Boolean);

      // Filter valid paths (non-empty)
      const validPaths = shortestPathsToNeighbors.filter(
        ({ path }) => path.length > 0
      );

      if (validPaths.length > 0) {
        // Choose the shortest path among them
        const shortestPathEntry = validPaths.reduce((minEntry, entry) =>
          entry.path.length < minEntry.path.length ? entry : minEntry
        );
        const { path: shortestPath } = shortestPathEntry;

        // Mark them as path draft
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(
            prevHexes,
            (h) =>
              shortestPath.find((p) => areCoordinatesEqual(p, h)) && !h.isPath,
            { isPathDraft: true }
          )
        );
        set(draftPathAtom, shortestPath);
      }
    }
  }, []);

  const handleHexMouseLeave = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);

    if (selectedEffect.name) {
      // Clear effect draft from all hexes
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isEffectDraft: false })
      );
      set(effectDraftPathAtom, []);
    } else if (selectedSample.name) {
      // Clear path draft from all hexes
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isPathDraft: false })
      );
      set(draftPathAtom, []);
    }
  }, []);

  const handleHexClick = useAtomCallback(async (get, set, hex) => {
    const selectedSample = get(selectedSampleAtom);
    const selectedEffect = get(selectedEffectAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);
    const draftPath = get(draftPathAtom);
    const effectDraftPath = get(effectDraftPathAtom);

    // 1) Assign sample to existing path hex
    if (selectedSample.name && hex.isPath && draftPath.length === 0) {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
          sampleName: selectedSample.name,
        })
      );
      // Clear selectedSample
      set(selectedSampleAtom, { name: null, click: 0 });
      return;
    }

    // 2) Create a branch for an effect
    if (selectedEffect.name && hex.isEffectDraft) {
      // We have effectDraftPath
      const effectDraftHexes = effectDraftPath;

      // Find nearest path's last hex
      const lastHexes = getPathEdges(paths, "last").filter(Boolean);
      if (lastHexes.length === 0) return;

      let nearestLastHex = null;
      let minDistance = Infinity;

      for (const lastHex of lastHexes) {
        const distance = hexDistance(hex, lastHex);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLastHex = lastHex;
        }
      }

      // Identify the parent path
      const parentPath = paths.find((pathObj) =>
        areCoordinatesEqual(
          pathObj.path[pathObj.path.length - 1],
          nearestLastHex
        )
      );
      if (!parentPath) return;

      const parentPathId = parentPath.id;

      // Pull effect defaults from effectStore
      const effectConfig = _.cloneDeep(
        _.find(
          (await import("./App")).effectStore, // Dynamically fetch effectStore if needed
          (e) => e.name === selectedEffect.name
        )?.config || {}
      );

      // Create new branch
      const { v4: uuidv4 } = await import("uuid");
      const newBranchId = uuidv4();

      const lastHexInDraft = branchEdgeFromBranch(effectDraftHexes, "last");

      set((await import("./App")).branchesAtom, (prevBranches) => [
        ...prevBranches,
        {
          id: newBranchId,
          parentPathId,
          effect: { type: selectedEffect.type, name: selectedEffect.name },
          effectConfig,
          branch: effectDraftHexes,
        },
      ]);

      // Update hexes
      set(hexesAtom, (prevHexes) =>
        prevHexes.map((h) => {
          const isMatch = effectDraftHexes.some(
            (p) => areCoordinatesEqual(p, h) && !h.isPath
          );
          if (isMatch) {
            return {
              ...h,
              isEffectDraft: false,
              isBranch: true,
              branchId: newBranchId,
              effect:
                areCoordinatesEqual(hex, h) && selectedEffect.name
                  ? { type: selectedEffect.type, name: selectedEffect.name }
                  : { type: h.effect.type, name: h.effect.name },
              lastHexInPath:
                lastHexInDraft && areCoordinatesEqual(h, lastHexInDraft),
            };
          }
          return h;
        })
      );

      // Clear selectedEffect
      set(selectedEffectAtom, { type: null, name: null });
      set(effectDraftPathAtom, []);
      return;
    }

    // 3) Finalize a new path for a sample
    if (
      selectedSample.name &&
      !selectedEffect.name &&
      hex.isPathDraft &&
      draftPath.length > 0
    ) {
      const { v4: uuidv4 } = await import("uuid");
      const newPathId = uuidv4();
      const lastHexInDraft = pathEdgeFromPath(draftPath, "last");

      // Mark the last hex
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(
          prevHexes,
          (h) => lastHexInDraft && areCoordinatesEqual(h, lastHexInDraft),
          {
            lastHexInPath: true,
          }
        )
      );

      // Convert pathDraft to isPath
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => h.isPathDraft, {
          isPathDraft: false,
          isPath: true,
          isPathSelected: false,
          isBranch: false,
          pathId: newPathId,
        })
      );

      // Store in paths
      set(pathsAtom, (prevPaths) => [
        ...prevPaths,
        { id: newPathId, path: draftPath },
      ]);
      // Clear draftPath
      set(draftPathAtom, []);

      // Increase click so that next time we can place the sample
      set(selectedSampleAtom, { name: selectedSample.name, click: 2 });
      return;
    }

    // 4) Handle selection or movement
    if (!selectedSample.name && !selectedEffect.name) {
      const anyHexSelected = _.some(hexes, (h) => h.isHexSelected);

      if (!anyHexSelected) {
        if (hex.isPathSelected && hex.sampleName) {
          // If the path is selected, allow picking up the sample from this hex
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
              isHexSelected: true,
            })
          );
        } else if (hex.isPath) {
          // Select entire path
          const selectedPathId = hex.pathId;

          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, (h) => h.pathId === selectedPathId, {
              isPathSelected: true,
              isBranchSelected: false,
              isHexSelected: false,
            })
          );
          // Deselect branches
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isBranchSelected: false,
            })
          );
        } else if (hex.isBranch && !hex.isPath) {
          // Select the branch
          const selectedBranchId = hex.branchId;

          set(hexesAtom, (prevHexes) =>
            updateHexProperties(
              prevHexes,
              (h) => h.branchId === selectedBranchId,
              {
                isBranchSelected: true,
                isPathSelected: false,
                isHexSelected: false,
              }
            )
          );
          // Deselect paths
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isPathSelected: false,
            })
          );
        } else {
          // Deselect everything
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isPathSelected: false,
              isBranchSelected: false,
              isHexSelected: false,
            })
          );
        }
      } else {
        // Movement logic
        const selectedHex = hexes.find((h) => h.isHexSelected);

        if (hex.isPathSelected && !hex.sampleName && selectedHex) {
          // Move the sample
          const sampleName = selectedHex.sampleName;
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(
              prevHexes,
              (h) => areCoordinatesEqual(h, selectedHex),
              {
                sampleName: null,
                isHexSelected: false,
              }
            )
          );
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
              sampleName: sampleName,
              isHexSelected: false,
            })
          );
        } else if (selectedHex && areCoordinatesEqual(hex, selectedHex)) {
          // Remove sample
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(
              prevHexes,
              (h) => areCoordinatesEqual(h, selectedHex),
              {
                sampleName: null,
                isHexSelected: false,
              }
            )
          );
        } else {
          // Deselect the single hex
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isHexSelected: false,
            })
          );
        }
      }
    }
  }, []);

  // Determine global states for UI
  const anyBranchSelected = _.some(hexes, (h) => h.isBranchSelected);
  const anyPathSelected = _.some(hexes, (h) => h.isPathSelected);
  const anyHexSelected = _.some(hexes, (h) => h.isHexSelected);

  // Debounce mouse events so we don't spam large computations
  const debouncedHandleHexMouseEnter = _.debounce(
    (hex) => handleHexMouseEnter(hex),
    10
  );
  const debouncedHandleHexMouseLeave = _.debounce(
    (hex) => handleHexMouseLeave(hex),
    10
  );

  return (
    <svg
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      viewBox={`${-SVG_WIDTH / 2} ${
        -SVG_HEIGHT / 2
      } ${SVG_WIDTH} ${SVG_HEIGHT}`}
    >
      <g transform="translate(0,0)">
        {_.map(hexes, (hex) => (
          <Hex
            key={`${hex.q},${hex.r}`}
            hex={hex}
            onClick={() => handleHexClick(hex)}
            onMouseEnter={() => debouncedHandleHexMouseEnter(hex)}
            onMouseLeave={() => debouncedHandleHexMouseLeave(hex)}
            anyPathSelected={anyPathSelected}
            anyBranchSelected={anyBranchSelected}
            anyHexSelected={anyHexSelected}
          />
        ))}
      </g>
    </svg>
  );
};

export default Grid;
