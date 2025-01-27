import React, { useState, useRef, useEffect } from "react";
import { atom, useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import _ from "lodash";
import { guideStepAtom, guideTargetRefsAtom, guideVisibleAtom } from "./Guide";

// Import atoms from App.jsx
import {
  hexesAtom,
  selectedEffectAtom,
  selectedSampleAtom,
  pathsAtom,
  draftPathAtom,
  effectDraftPathAtom,
  isPathCreationModeAtom,
  mobilePanelOpenAtom,
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
  canCreateMorePaths,
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

  // Convert SVG coordinates to screen coordinates
  const convertToScreenCoords = (x, y) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    // Create SVG point
    const pt = svgRef.current.createSVGPoint();
    pt.x = x;
    pt.y = y;

    // Get current transformation matrix and include viewport scale
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    // Get current scroll position
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Transform point and adjust for scroll
    const transformed = pt.matrixTransform(ctm);
    return {
      x: transformed.x + scrollX,
      y: transformed.y + scrollY,
    };
  };

  useEffect(() => {
    if (
      selectedSample?.name &&
      selectedSample?.click === 2 &&
      !hasShownOnce &&
      paths.length > 0
    ) {
      const latestPathObj = paths[paths.length - 1];
      if (latestPathObj?.path?.length) {
        const pathArr = latestPathObj.path;
        const lastHex = pathArr[pathArr.length - 1];

        // Convert coordinates
        const { x: sx, y: sy } = convertToScreenCoords(lastHex.x, lastHex.y);

        // Add responsive offsets
        const isMobile = window.innerWidth <= 768;
        const offsetX = isMobile ? -60 : -150; // Smaller offset on mobile
        let offsetY;

        if (isMobile) {
          offsetY = lastHex.y > 0 ? 40 : -90;
        } else {
          offsetY = lastHex.y > 0 ? 20 : -60;
        }

        setTooltipPos({
          x: sx + offsetX,
          y: sy + offsetY,
        });
        setVisible(true);
        setHasShownOnce(true);
      }
    }

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
  }, [paths, selectedSample, hasShownOnce, hexes]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", // Changed to fixed to handle scrolling better
        left: tooltipPos.x,
        top: tooltipPos.y,
        pointerEvents: "none",
        zIndex: 50, // Ensure tooltip stays on top
      }}
      className="px-2 py-1 text-sm text-white bg-neutral-900 border border-neutral-600 bg-opacity-80 rounded-lg text-xs"
    >
      Now place sample on path
    </div>
  );
};
/* ------------------------------------------------
   The main Grid component with drag-and-drop support
   ------------------------------------------------ */
const Grid = () => {
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [selectedEffect, setSelectedEffect] = useAtom(selectedEffectAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [paths, setPaths] = useAtom(pathsAtom);
  const [draftPath, setDraftPath] = useAtom(draftPathAtom);
  const [effectDraftPath, setEffectDraftPath] = useAtom(effectDraftPathAtom);
  const [isOpen, setIsOpen] = useAtom(mobilePanelOpenAtom);
  const [guideStep, setGuideStep] = useAtom(guideStepAtom);
  const [isPathCreationMode, setIsPathCreationMode] = useAtom(
    isPathCreationModeAtom
  );

  const svgRef = useRef(null);
  const draggingSampleHex = useRef(null); // NEW: Ref to store dragging sample hex
  const mouseDownTimerRef = useRef(null);

  const firstHexRef = useRef(null);
  const effectDraftRef = useRef(null);
  const mainHexRef = useRef(null);
  const pathHexRef = useRef(null);
  const pathEndRef = useRef(null);

  const [, setGuideTargetRefs] = useAtom(guideTargetRefsAtom);

  useEffect(() => {
    console.log("Setting guide target refs...");

    setGuideTargetRefs((prev) => {
      console.log("Before update:", prev);
      const updatedRefs = {
        ...prev,
        firstHex: firstHexRef,
        effectDraft: effectDraftRef,
        mainHex: mainHexRef,
        pathHex: pathHexRef,
        pathEnd: pathEndRef,
      };
      console.log("After update:", updatedRefs);
      return updatedRefs;
    });
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setSelectedSample({ name: null });
        setSelectedEffect({ type: null, name: null });
        setIsPathCreationMode(false);
        setHexes((prevHexes) =>
          updateHexProperties(prevHexes, () => true, {
            isPathSelected: false,
            isBranchSelected: false,
            isHexSelected: false,
            isPathDraft: false,
            isEffectDraft: false,
          })
        );
        setDraftPath([]);
        setEffectDraftPath([]);
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return;
  }, []);

  // --------------------
  // Debounced Handlers
  // --------------------
  const handleHexMouseEnter = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);
    const isPathCreationMode = get(isPathCreationModeAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);

    // Get all path end hexes
    const existingPathEnds = paths
      .map((path) => path.path[path.path.length - 1])
      .filter(Boolean);

    // Find all hexes adjacent to path ends - these should be treated as reserved
    const reservedHexes = _.flatMap(existingPathEnds, (endHex) =>
      hexes.filter((h) => hexDistance(h, endHex) === 1)
    );

    // Check if this hex is already part of any existing path or is reserved
    const isHexInExistingPath = paths.some((existingPath) =>
      existingPath.path.some((pathHex) => areCoordinatesEqual(pathHex, hex))
    );

    const isHexReserved = reservedHexes.some((reservedHex) =>
      areCoordinatesEqual(reservedHex, hex)
    );

    // Check if this hex is adjacent to any existing path endpoints
    const isAdjacentToPathEnd = existingPathEnds.some((endHex) => {
      const distance = hexDistance(hex, endHex);
      return distance <= 1;
    });

    if (isPathCreationMode && !hex.isPath) {
      // Skip path drafting if hex is already in a path, reserved, or too close to an endpoint
      if (isHexInExistingPath || isHexReserved || isAdjacentToPathEnd) {
        return;
      }

      const shortestPathsToNeighbors = predefinedOuterRing
        .map((outerHex) => {
          const neighbor = hexes.find((h) => areCoordinatesEqual(h, outerHex));
          if (!neighbor) return null;

          // Modified path finding to consider reserved hexes as blocked
          const path = findShortestPath(
            neighbor,
            hex,
            hexes.map((h) => ({
              ...h,
              isPath:
                h.isPath ||
                reservedHexes.some((reserved) =>
                  areCoordinatesEqual(reserved, h)
                ),
            }))
          );

          // Check if any hex in this potential path is already used or reserved
          if (
            path.some(
              (pathHex) =>
                paths.some((existingPath) =>
                  existingPath.path.some((existing) =>
                    areCoordinatesEqual(existing, pathHex)
                  )
                ) ||
                reservedHexes.some((reserved) =>
                  areCoordinatesEqual(reserved, pathHex)
                )
            )
          ) {
            return null;
          }

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

        // Final validation check including reserved hexes
        const hasCollision = sp.some(
          (pathHex) =>
            paths.some((existingPath) =>
              existingPath.path.some((existing) =>
                areCoordinatesEqual(existing, pathHex)
              )
            ) ||
            reservedHexes.some((reserved) =>
              areCoordinatesEqual(reserved, pathHex)
            )
        );

        if (!hasCollision) {
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
      return;
    }

    if (selectedEffect?.name && !hex.isPath) {
      const lastHexes = getPathEdges(paths, "last").filter(Boolean);

      for (const lastHex of lastHexes) {
        const distance = hexDistance(hex, lastHex);
        if (distance === 1) {
          set(hexesAtom, (prevHexes) =>
            updateHexProperties(
              prevHexes,
              (h) => areCoordinatesEqual(h, hex) && !h.isPath,
              { isEffectDraft: true }
            )
          );
          set(effectDraftPathAtom, [hex]);
          break;
        }
      }
    }
  }, []);

  const handleHexMouseLeave = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const selectedSample = get(selectedSampleAtom);
    const isPathCreationMode = get(isPathCreationModeAtom);

    if (selectedEffect?.name) {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isEffectDraft: false })
      );
      set(effectDraftPathAtom, []);
    }

    if (selectedSample?.name || isPathCreationMode) {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, { isPathDraft: false })
      );
      set(draftPathAtom, []);
    }
  }, []);

  // --------------------
  // New: Handler for mouse down to initiate dragging
  // --------------------
  const handleHexMouseDown = (hex) => {
    if (!selectedSample.name && !selectedEffect.name) {
      // Add a timeout to only trigger drag state if mouse is held
      const timer = setTimeout(() => {
        if (hex.isPath && hex.sampleName) {
          draggingSampleHex.current = hex;
          setHexes((prevHexes) =>
            updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
              isHexSelected: true,
            })
          );
        }
      }, 200); // 200ms hold time before drag activates

      // Store timer in ref so we can clear it on mouse up
      mouseDownTimerRef.current = timer;
    }
  };

  // In Grid.jsx - Simplified hex click handling

  const handleHexClick = useAtomCallback(async (get, set, hex) => {
    const selectedSample = get(selectedSampleAtom);
    const selectedEffect = get(selectedEffectAtom);
    const hexes = get(hexesAtom);
    const isPathCreationMode = get(isPathCreationModeAtom);
    const currentStep = get(guideStepAtom);

    // Handle path creation mode
    if (hex.isMainHex && canCreateMorePaths(hexes, paths)) {
      set(isPathCreationModeAtom, !isPathCreationMode);
      set(draftPathAtom, []);
      set(effectDraftPathAtom, []);
      setSelectedEffect({ type: null, name: null });
      setSelectedSample({ name: null });

      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, {
          isPathSelected: false,
          isBranchSelected: false,
          isHexSelected: false,
        })
      );

      setIsOpen(false);

      if (currentStep === 1) {
        set(guideStepAtom, 2);
      } else {
        set(guideVisibleAtom, false);
      }

      return;
    }

    // Handle path creation mode
    // In handleHexClick function within Grid.jsx, replace the path creation mode block with this:

    // Handle path creation mode
    // In handleHexClick function within Grid.jsx, update the path creation mode block:

    // Handle path creation mode
    if (isPathCreationMode && hex.isPathDraft && draftPath.length > 0) {
      // Lock the current draft path immediately
      const lockedDraftPath = [...draftPath];

      // Get the last hex of the locked draft path
      const lastHexInDraft = lockedDraftPath[lockedDraftPath.length - 1];

      // Get all existing path hexes and their end points
      const existingPathHexes = paths.flatMap((path) => path.path);
      const existingEndPoints = paths.map(
        (path) => path.path[path.path.length - 1]
      );

      // Function to get adjacent hex positions for a given hex
      const getAdjacentPositions = (hex) => {
        // Define the 6 possible directions for adjacent hexes
        const directions = [
          { q: 1, r: 0 },
          { q: 1, r: -1 },
          { q: 0, r: -1 },
          { q: -1, r: 0 },
          { q: -1, r: 1 },
          { q: 0, r: 1 },
        ];

        return directions.map((dir) => ({
          q: hex.q + dir.q,
          r: hex.r + dir.r,
        }));
      };

      // Get adjacent positions for the draft path's end hex
      const draftEndAdjacents = getAdjacentPositions(lastHexInDraft);

      // Check for overlapping adjacents with existing path endpoints
      const hasOverlappingAdjacents = existingEndPoints.some((endPoint) => {
        const endPointAdjacents = getAdjacentPositions(endPoint);

        return draftEndAdjacents.some((draftAdj) =>
          endPointAdjacents.some(
            (existingAdj) =>
              existingAdj.q === draftAdj.q && existingAdj.r === draftAdj.r
          )
        );
      });

      // Check if the last hex would be adjacent to existing path hexes
      const wouldBeAdjacentToPath = existingPathHexes.some(
        (pathHex) => hexDistance(lastHexInDraft, pathHex) === 1
      );

      if (wouldBeAdjacentToPath || hasOverlappingAdjacents) {
        // If there would be adjacency or overlapping adjacents, don't create the path
        console.warn("Cannot create path: invalid end hex position");
        return;
      }

      // If no adjacency issues, proceed with path creation
      const { v4: uuidv4 } = await import("uuid");
      const newPathId = uuidv4();

      // Establish the path using the locked draft path
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(
          prevHexes,
          (h) => lastHexInDraft && areCoordinatesEqual(h, lastHexInDraft),
          { lastHexInPath: true }
        )
      );

      set(hexesAtom, (prevHexes) =>
        updateHexProperties(
          prevHexes,
          (h) => lockedDraftPath.some((p) => areCoordinatesEqual(p, h)),
          {
            isPathDraft: false,
            isPath: true,
            isPathSelected: false,
            isBranch: false,
            pathId: newPathId,
          }
        )
      );

      set(pathsAtom, (prevPaths) => [
        ...prevPaths,
        {
          id: newPathId,
          path: lockedDraftPath,
          volume: 1,
          solo: false,
          bypass: false,
        },
      ]);

      // Reset path creation mode
      set(isPathCreationModeAtom, false);
      setDraftPath([]);
      set(guideStepAtom, 3);

      return;
    }

    // Handle sample placement, removal, or replacement on existing path
    if (selectedSample?.name && hex.isPath) {
      if (guideStep === 4) {
        set(guideStepAtom, 5);
      }

      // If hex already has the same sample, remove it
      if (hex.sampleName === selectedSample.name) {
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
            sampleName: null,
          })
        );
        return;
      }

      // Place the new sample (whether hex is empty or has a different sample)
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => areCoordinatesEqual(h, hex), {
          sampleName: selectedSample.name,
        })
      );
      // Don't deselect the sample to allow multiple placements
      return;
    }

    // Handle effect branch creation (unchanged)
    if (selectedEffect.name && hex.isEffectDraft) {
      if (guideStep === 7) {
        setGuideStep(8);
      }

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

    // Handle path/branch selection (unchanged)
    if (!selectedSample?.name && !selectedEffect?.name && !isPathCreationMode) {
      if (hex.isPath) {
        // Select entire path
        const selectedPathId = hex.pathId;
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(prevHexes, () => true, {
            isPathSelected: false,
            isBranchSelected: false,
            isHexSelected: false,
          })
        );
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(prevHexes, (h) => h.pathId === selectedPathId, {
            isPathSelected: true,
          })
        );

        setIsOpen(true);
      } else if (hex.isBranch && !hex.isPath) {
        // Select the branch
        const selectedBranchId = hex.branchId;
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(prevHexes, () => true, {
            isBranchSelected: false,
            isPathSelected: false,
            isHexSelected: false,
          })
        );
        set(hexesAtom, (prevHexes) =>
          updateHexProperties(
            prevHexes,
            (h) => h.branchId === selectedBranchId,
            {
              isBranchSelected: true,
            }
          )
        );

        setIsOpen(true);
      } else {
        // Deselect everything

        set(hexesAtom, (prevHexes) =>
          updateHexProperties(prevHexes, () => true, {
            isPathSelected: false,
            isBranchSelected: false,
            isHexSelected: false,
          })
        );

        setIsOpen(false);
      }
    } else {
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, () => true, {
          isPathSelected: false,
          isBranchSelected: false,
          isHexSelected: false,
        })
      );

      setSelectedSample({ name: null });
      setSelectedEffect({ type: null, name: null });
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

  const isAdjacentToPathEnd = (hex) => {
    const pathEnds = getPathEdges(paths, "last").filter(Boolean);
    return pathEnds.some((end) => hexDistance(hex, end) === 1);
  };

  // Determine the correct ref for each hex
  const getHexRef = (hex) => {
    if (hex.q === 5 && hex.r === -5) return firstHexRef;

    if (
      !hex.isPath &&
      !hex.isBranch &&
      selectedEffect?.type &&
      isAdjacentToPathEnd(hex)
    ) {
      return effectDraftRef;
    }

    if (hex.isMainHex) return mainHexRef;
    if (hex.isPath) return pathHexRef;
    if (hex.lastHexInPath) return pathEndRef;
    return null;
  };

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
              onMouseDown={() => handleHexMouseDown(hex)}
              onMouseEnter={() => debouncedHandleHexMouseEnter(hex)}
              onMouseLeave={() => debouncedHandleHexMouseLeave(hex)}
              anyPathSelected={anyPathSelected}
              anyBranchSelected={anyBranchSelected}
              anyHexSelected={anyHexSelected}
              isDragging={!!draggingSampleHex.current}
              ref={getHexRef(hex)}
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
