// Grid.jsx

import React, { useState, useRef, useEffect } from "react";
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

// SVG dimensions
import { SVG_WIDTH, SVG_HEIGHT } from "./App";

// Additional references from App.jsx
import { predefinedOuterRing } from "./App";

/* ----------------------------------------
   NEW COMPONENT for showing your tooltip 
   ---------------------------------------- */
const PlacementTooltip = ({ svgRef, paths, selectedSample, hexes }) => {
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hasShownOnce, setHasShownOnce] = useState(false);

  // Convert (x,y) in SVG space to screen coords
  const convertToScreenCoords = (x, y) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const screenCTM = svgRef.current.getScreenCTM();
    if (screenCTM) {
      const { x: sx, y: sy } = pt.matrixTransform(screenCTM);
      return { x: sx, y: sy };
    }
    return { x: 0, y: 0 };
  };

  // Hide function you can call after user places the sample
  const hideTooltip = () => {
    setVisible(false);
  };

  // Whenever the user is ready to place the sample onto path hexes:
  useEffect(() => {
    // Condition to show the tooltip
    if (
      selectedSample?.name &&
      selectedSample?.click === 2 &&
      !hasShownOnce &&
      paths.length > 0
    ) {
      // Get the last path object (the newly created path is typically last)
      const latestPathObj = paths[paths.length - 1];
      if (latestPathObj?.path?.length) {
        const pathArr = latestPathObj.path;
        const lastHex = pathArr[pathArr.length - 1];
        const { x: sx, y: sy } = convertToScreenCoords(lastHex.x, lastHex.y);

        // If lastHex is in bottom half, place tooltip below; else place above
        const placeBelow = lastHex.y > 0;
        const offsetX = -100; // Adjusted offset for better positioning
        const offsetY = placeBelow ? 20 : -50;

        setTooltipPos({ x: sx + offsetX, y: sy + offsetY });
        setVisible(true);
        setHasShownOnce(true); // Ensure it shows only once
      }
    }

    // Condition to hide the tooltip
    // Hide if there are multiple paths or if the first path has a sample placed
    if (paths.length > 1) {
      setVisible(false);
    } else if (paths.length === 1) {
      const firstPath = paths[0];
      const firstPathHasSample = firstPath.path.some((hexCoord) => {
        const hex = hexes.find((h) => h.q === hexCoord.q && h.r === hexCoord.r);
        return hex && hex.sampleName;
      });
      if (firstPathHasSample) {
        setVisible(false);
      }
    }
  }, [paths, selectedSample, hasShownOnce, convertToScreenCoords, hexes]);

  // Return the tooltip's JSX
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: tooltipPos.x,
        top: tooltipPos.y,
        pointerEvents: "none",
      }}
      className="px-2 py-1 text-sm text-white bg-black bg-opacity-50 rounded-lg text-xs"
    >
      Place sample on path
    </div>
  );
};

/* ------------------------------------------------
   The main Grid component (unchanged except where 
   we call the new tooltip component)
   ------------------------------------------------ */
const Grid = () => {
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [selectedEffect, setSelectedEffect] = useAtom(selectedEffectAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [paths, setPaths] = useAtom(pathsAtom);
  const [draftPath, setDraftPath] = useAtom(draftPathAtom);
  const [effectDraftPath, setEffectDraftPath] = useAtom(effectDraftPathAtom);

  const svgRef = useRef(null);

  // --------------------
  // Debounced Handlers
  // --------------------
  const handleHexMouseEnter = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);

    // Effect branch drafting
    if (selectedEffect.name && !hex.isPath) {
      const lastHexes = getPathEdges(paths, "last").filter(Boolean);
      if (lastHexes.length === 0) return;

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
        const shortestPath = findShortestPath(nearestLastHex, hex, hexes);
        if (shortestPath.length > 0) {
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
    }
    // Sample path drafting
    else if (
      selectedSample.click === 1 &&
      !selectedEffect.name &&
      !hex.isPath
    ) {
      const shortestPathsToNeighbors = predefinedOuterRing
        .map((outerHex) => {
          const neighbor = hexes.find((h) => areCoordinatesEqual(h, outerHex));
          if (!neighbor) return null;
          const path = findShortestPath(neighbor, hex, hexes);
          return { neighbor, path };
        })
        .filter(Boolean);

      const validPaths = shortestPathsToNeighbors.filter(
        ({ path }) => path.length > 0
      );
      if (validPaths.length > 0) {
        const shortestPathEntry = validPaths.reduce((minEntry, entry) =>
          entry.path.length < minEntry.path.length ? entry : minEntry
        );
        const { path: sp } = shortestPathEntry;
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(
            prevHexes,
            (h) => sp.find((p) => areCoordinatesEqual(p, h)) && !h.isPath,
            { isPathDraft: true }
          )
        );
        set(draftPathAtom, sp);
      }
    }
  }, []);

  const handleHexMouseLeave = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);

    if (selectedEffect.name) {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isEffectDraft: false })
      );
      set(effectDraftPathAtom, []);
    } else if (selectedSample.name) {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isPathDraft: false })
      );
      set(draftPathAtom, []);
    }
  }, []);

  // --------------------
  // Main Click Handler
  // --------------------
  const handleHexClick = useAtomCallback(async (get, set, hex) => {
    const selectedSample = get(selectedSampleAtom);
    const selectedEffect = get(selectedEffectAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);
    const draftPath = get(draftPathAtom);
    const effectDraftPath = get(effectDraftPathAtom);

    // (1) Assign sample to existing path
    if (selectedSample.name && hex.isPath && draftPath.length === 0) {
      // If user is placing sample for the first time (click===2),
      // then hide the tooltip once they do it:
      if (selectedSample.click === 2) {
        // Resets sample selection or sets click=0 or however you wish
        setSelectedSample({ name: null, click: 0 });
      } else {
        // If user was still on click=1 or something else
        setSelectedSample({ name: null, click: 0 });
      }
      // Actually place the sample
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
          sampleName: selectedSample.name,
        })
      );
      return;
    }

    // (2) Create an effect branch
    if (selectedEffect.name && hex.isEffectDraft) {
      const effectDraftHexes = effectDraftPath;
      const lastHexes = getPathEdges(paths, "last").filter(Boolean);
      if (!lastHexes.length) return;

      let minDistance = Infinity;
      let nearestLastHex = null;
      for (const lastHex of lastHexes) {
        const distance = hexDistance(hex, lastHex);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLastHex = lastHex;
        }
      }
      const parentPath = paths.find((p) =>
        areCoordinatesEqual(
          p.path[p.path.length - 1],
          nearestLastHex || { q: null, r: null }
        )
      );
      if (!parentPath) return;

      const parentPathId = parentPath.id;
      const effectConfig = _.cloneDeep(
        _.find(
          (await import("./App")).effectStore,
          (e) => e.name === selectedEffect.name
        )?.config || {}
      );

      const { v4: uuidv4 } = await import("uuid");
      const newBranchId = uuidv4();

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

      const lastHexInDraft = branchEdgeFromBranch(effectDraftHexes, "last");
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

      setSelectedEffect({ type: null, name: null });
      setEffectDraftPath([]);
      return;
    }

    // (3) Finalize a new path for a sample
    if (
      selectedSample.name &&
      !selectedEffect.name &&
      hex.isPathDraft &&
      draftPath.length > 0
    ) {
      const { v4: uuidv4 } = await import("uuid");
      const newPathId = uuidv4();
      const lastHexInDraft = pathEdgeFromPath(draftPath, "last");

      set(hexesAtom, (prevHexes) =>
        updateHexProperties(
          prevHexes,
          (h) => lastHexInDraft && areCoordinatesEqual(h, lastHexInDraft),
          { lastHexInPath: true }
        )
      );
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => h.isPathDraft, {
          isPathDraft: false,
          isPath: true,
          isPathSelected: false,
          isBranch: false,
          pathId: newPathId,
        })
      );
      set(pathsAtom, (prevPaths) => [
        ...prevPaths,
        { id: newPathId, path: draftPath },
      ]);
      setDraftPath([]);

      // User can now place the sample onto path hexes => set click=2
      setSelectedSample({ name: selectedSample.name, click: 2 });
      return;
    }

    // (4) Handle selection or movement
    if (!selectedSample.name && !selectedEffect.name) {
      const anyHexSelected = _.some(hexes, (h) => h.isHexSelected);
      if (!anyHexSelected) {
        if (hex.isPath && hex.sampleName && hex.isPathSelected) {
          // picking up sample from this hex
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
              isHexSelected: true,
            })
          );
        } else if (hex.isPath) {
          // select entire path
          const selectedPathId = hex.pathId;
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, (h) => h.pathId === selectedPathId, {
              isPathSelected: true,
              isBranchSelected: false,
              isHexSelected: false,
            })
          );
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isBranchSelected: false,
            })
          );
        } else if (hex.isBranch && !hex.isPath) {
          // select the branch
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
          // Move sample
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
          // Deselect single hex
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(prevHexes, () => true, {
              isHexSelected: false,
            })
          );
        }
      }
    }
  }, []);

  // For UI states
  const anyBranchSelected = _.some(hexes, (h) => h.isBranchSelected);
  const anyPathSelected = _.some(hexes, (h) => h.isPathSelected);
  const anyHexSelected = _.some(hexes, (h) => h.isHexSelected);

  // Debounced for performance
  const debouncedHandleHexMouseEnter = _.debounce(
    (hex) => handleHexMouseEnter(hex),
    10
  );
  const debouncedHandleHexMouseLeave = _.debounce(
    (hex) => handleHexMouseLeave(hex),
    10
  );

  return (
    <div className="relative">
      {/* The SVG itself */}
      <svg
        ref={svgRef}
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

      {/* NEW: The actual tooltip component for sample placement */}
      <PlacementTooltip
        svgRef={svgRef}
        paths={paths}
        selectedSample={selectedSample}
        hexes={hexes}
      />
    </div>
  );
};

export default Grid;
