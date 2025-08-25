import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import _ from "lodash";
import PropTypes from "prop-types";

// Import all atoms from centralized store
import {
  hexesAtom,
  selectedEffectAtom,
  selectedSampleAtom,
  pathsAtom,
  draftPathAtom,
  effectDraftPathAtom,
  isPathCreationModeAtom,
  mobilePanelOpenAtom,
  guideStepAtom,
  guideTargetRefsAtom,
  guideVisibleAtom,
  predefinedOuterRing,
  SVG_WIDTH,
  SVG_HEIGHT,
  // HEX_RADIUS,
  // branchesAtom,
} from "./atomStore";

// Import utility functions
import {
  updateHexProperties,
  memoizedFindShortestPath,
  clearPathCache,
  getPathEdges,
  areCoordinatesEqual,
  hexDistance,
  branchEdgeFromBranch,
  canCreateMorePaths,
  getReservedHexes,
  isHexInExistingPath,
  isAdjacentToPathEnd,
  validatePathCreation,
  // axialToPixel,
} from "./hexUtils";

// Import the Hex component
import Hex from "./Hex";

// Import the effectStore from sampleStore instead of App.jsx
// import { effectStore } from "./sampleStore";

/* ----------------------------------------
   NEW COMPONENT for showing your tooltip 
   ---------------------------------------- */
const PlacementTooltip = ({ svgRef, paths, selectedSample, hexes }) => {
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hasShownOnce, setHasShownOnce] = useState(false);

  // Convert SVG coordinates to screen coordinates
  const convertToScreenCoords = useCallback(
    (x, y) => {
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
    },
    [svgRef]
  );

  // Add this useEffect in your Grid component to clear the path cache when needed
  useEffect(() => {
    // Clear the cache when a new path is added or path states change
    clearPathCache();
  }, [paths.length]);

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
  }, [paths, selectedSample, hasShownOnce, hexes, convertToScreenCoords]);

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

PlacementTooltip.propTypes = {
  svgRef: PropTypes.object.isRequired,
  paths: PropTypes.array.isRequired,
  selectedSample: PropTypes.object,
  hexes: PropTypes.array.isRequired,
};

/* ------------------------------------------------
   The main Grid component with drag-and-drop support
   ------------------------------------------------ */
const Grid = () => {
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [selectedEffect, setSelectedEffect] = useAtom(selectedEffectAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [paths] = useAtom(pathsAtom);
  const [draftPath, setDraftPath] = useAtom(draftPathAtom);
  const [effectDraftPath, setEffectDraftPath] = useAtom(effectDraftPathAtom);
  const [, setIsOpen] = useAtom(mobilePanelOpenAtom);
  const [guideStep, setGuideStep] = useAtom(guideStepAtom);
  const [, setIsPathCreationMode] = useAtom(isPathCreationModeAtom);
  const [, setGuideVisibleAtom] = useAtom(guideVisibleAtom);
  // const [branches, setBranches] = useAtom(branchesAtom);

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
    setGuideTargetRefs((prev) => ({
      ...prev,
      firstHex: firstHexRef,
      effectDraft: effectDraftRef,
      mainHex: mainHexRef,
      pathHex: pathHexRef,
      pathEnd: pathEndRef,
    }));
  }, [setGuideTargetRefs]);

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
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    setDraftPath,
    setEffectDraftPath,
    setHexes,
    setIsOpen,
    setIsPathCreationMode,
    setSelectedEffect,
    setSelectedSample,
  ]);

  // --------------------
  // Debounced Handlers
  // --------------------
  // Replace this in your handleHexMouseEnter function
  const handleHexMouseEnter = useAtomCallback(async (get, set, hex) => {
    const selectedEffect = get(selectedEffectAtom);
    const isPathCreationMode = get(isPathCreationModeAtom);
    const hexes = get(hexesAtom);
    const paths = get(pathsAtom);

    // Using centralized utility functions for path management
  const reservedHexes = getReservedHexes();
    const hexInPath = isHexInExistingPath(hex, paths);
    const hexReserved = reservedHexes.some((reservedHex) =>
      areCoordinatesEqual(reservedHex, hex)
    );
  // No longer restrict adjacency to path ends

    if (isPathCreationMode && !hex.isPath) {
      // Skip path drafting if hex is already in a path or reserved
      if (hexInPath || hexReserved) {
        return;
      }

      const shortestPathsToNeighbors = predefinedOuterRing
        .map((outerHex) => {
          const neighbor = hexes.find((h) => areCoordinatesEqual(h, outerHex));
          if (!neighbor) return null;

          // Use memoized path finding to consider reserved hexes as blocked
          const path = memoizedFindShortestPath(
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
                isHexInExistingPath(pathHex, paths) ||
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
            isHexInExistingPath(pathHex, paths) ||
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
          set(draftPathAtom, [...sp]);
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

  const handleHexMouseLeave = useAtomCallback(async (get, set) => {
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
      // Explicitly clear all isPathDraft flags to ensure visualization is reset
      set(hexesAtom, (prevHexes) =>
        updateHexProperties(prevHexes, (h) => h.isPathDraft, {
          isPathDraft: false,
        })
      );
      // Clear draft path state
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

  const handleHexClick = useAtomCallback(
    async (get, set, hex) => {
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
        // setSelectedSample({ name: null });

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
          setGuideVisibleAtom(false);
        }

        return;
      }

      // Handle path creation mode
      if (isPathCreationMode && hex.isPathDraft && draftPath.length > 0) {
        // Lock the current draft path immediately
        const lockedDraftPath = [...draftPath];

        // Use centralized validation
        const validationResult = validatePathCreation(lockedDraftPath, paths);

        if (!validationResult.valid) {
          console.warn(`Cannot create path: ${validationResult.reason}`);
          return;
        }

        // If validation passes, batch updates
        const { v4: uuidv4 } = await import("uuid");
        const newPathId = uuidv4();
        const lastHexInDraft = lockedDraftPath[lockedDraftPath.length - 1];

        // BATCHED UPDATE: Single hex state update that handles both the lastHexInPath
        // and the other path properties in one go
        set(hexesAtom, (prevHexes) => {
          // Create a new hexes array that includes all updates at once
          return prevHexes.map((h) => {
            // Handle the lastHexInPath flag
            if (lastHexInDraft && areCoordinatesEqual(h, lastHexInDraft)) {
              return {
                ...h,
                isPathDraft: false,
                isPath: true,
                lastHexInPath: true, // This property was set separately before
                pathId: newPathId,
              };
            }

            // Handle other hexes in the path
            if (lockedDraftPath.some((p) => areCoordinatesEqual(p, h))) {
              return {
                ...h,
                isPathDraft: false,
                isPath: true,
                isPathSelected: false,
                isBranch: false,
                pathId: newPathId,
              };
            }

            return h;
          });
        });

        set(pathsAtom, (prevPaths) => [
          ...prevPaths,
          {
            id: newPathId,
            path: lockedDraftPath,
            volume: 1,
            pan: 0,
            chaos: 1,
            probability: 1,
            solo: false,
            bypass: false,
          },
        ]);

        // Clear the path cache since we've added a new path
        clearPathCache();

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

  // parentPathId and effectConfig removed (unused)

        const { v4: uuidv4 } = await import("uuid");
        const newBranchId = uuidv4();

  // setBranches logic removed (branchesAtom is commented out)

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
                // Don't set isBranch to avoid visual rendering
                branchId: newBranchId,
                // Don't set effect to avoid showing effect letters on hex
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
      if (
        !selectedSample?.name &&
        !selectedEffect?.name &&
        !isPathCreationMode
      ) {
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
        } else if (hex.branchId && !hex.isPath) {
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
    },
    [
      setDraftPath,
      setEffectDraftPath,
      setGuideStep,
      setGuideVisibleAtom,
      setIsOpen,
      setSelectedEffect,
      setSelectedSample,
    ]
  );

  // For UI states
  const anyPathSelected = _.some(hexes, (h) => h.isPathSelected);

  // Debounced for performance
  const debouncedHandleHexMouseEnter = _.debounce(
    (hex) => handleHexMouseEnter(hex),
    15
  );
  const debouncedHandleHexMouseLeave = _.debounce(
    () => handleHexMouseLeave(),
    15
  );

  // Determine the correct ref for each hex
  const getHexRef = (hex) => {
    if (hex.q === 5 && hex.r === -5) return firstHexRef;

    if (
      !hex.isPath &&
      !hex.isBranch &&
      selectedEffect?.type &&
      isAdjacentToPathEnd(hex, paths)
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
          {_.map(hexes, (hex) => {
            return (
              <Hex
                key={`${hex.q},${hex.r}`}
                hex={hex}
                onClick={() => handleHexClick(hex)}
                onMouseDown={() => handleHexMouseDown(hex)}
                onMouseEnter={() => debouncedHandleHexMouseEnter(hex)}
                onMouseLeave={() => debouncedHandleHexMouseLeave()}
                anyPathSelected={anyPathSelected}
                anyBranchSelected={false}
                isAdjacentToPathEnd={isAdjacentToPathEnd(hex, paths)}
                ref={getHexRef(hex)}
              />
            );
          })}
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
