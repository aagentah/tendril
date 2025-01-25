import React, { useState, memo, forwardRef } from "react";
import { useAtom } from "jotai";
import _ from "lodash";

import {
  pathsAtom,
  draftPathAtom,
  selectedSampleAtom,
  selectedEffectAtom,
  isPathCreationModeAtom,
  hexesAtom,
} from "./App";

import {
  getPathEdges,
  hexDistance,
  areCoordinatesEqual,
  canCreateMorePaths,
} from "./hexUtils";

import { guideStepAtom, guideTargetRefsAtom } from "./Guide";

const Hex = memo(
  forwardRef(
    (
      {
        hex,
        onClick,
        onMouseEnter,
        onMouseLeave,
        anyBranchSelected,
        anyPathSelected,
        anyHexSelected,
      },
      ref
    ) => {
      const {
        x,
        y,
        points,
        isMainHex,
        isCenterRing,
        isOuterRing,
        isPathDraft,
        isPath,
        isBranch,
        isPlaying,
        sampleName,
        effect,
        isHidden,
        isPathSelected,
        isBranchSelected,
        isEffectDraft,
        isHexSelected,
        lastHexInPath,
      } = hex;

      // Atom states
      const [hexes] = useAtom(hexesAtom);
      const [paths] = useAtom(pathsAtom);
      const [draftPath] = useAtom(draftPathAtom);
      const [selectedSample] = useAtom(selectedSampleAtom);
      const [selectedEffect] = useAtom(selectedEffectAtom);
      const [isPathCreationMode] = useAtom(isPathCreationModeAtom);
      const [guideStep, setGuideStep] = useAtom(guideStepAtom);

      const [isHovered, setIsHovered] = useState(false);

      // Get path ends and adjacency information
      const pathEnds = getPathEdges(paths, "last").filter(Boolean);
      const isAdjacentToPathEnd = pathEnds.some(
        (end) => hexDistance(hex, end) === 1
      );

      // Base styles
      let fillColor = "transparent";
      let strokeColor = "#666666";
      let strokeOpacity = 0.2;
      let strokeWidth = 0.5;
      let cursor = "cursor-default";
      let fontSize = 12;

      // Basic styling
      if (paths.length === 0 && !selectedSample?.name) {
        strokeOpacity = 0.2;
      }

      // Main/Center/Outer ring styling
      if (isMainHex || isCenterRing) {
        fillColor = "#171717";
        strokeColor = "#171717";
      }
      if (isOuterRing) {
        fillColor = "#171717";
      }

      // Sample placement highlighting
      if (selectedSample?.name && isPath && !sampleName) {
        fillColor = "#999900";
      }

      if (isPath || isBranch) {
        strokeOpacity = 1;
      }

      // Effect placement visualization
      if (!isPath && !isBranch && selectedEffect?.type && isAdjacentToPathEnd) {
        if (selectedEffect.type === "fx") {
          fillColor = "#666666";
          strokeColor = "white";
          strokeWidth = 2;
          cursor = "cursor-pointer";
        } else if (selectedEffect.type === "utility") {
          fillColor = "blue";
          strokeColor = "white";
          strokeWidth = 2;
          cursor = "cursor-pointer";
        }
      }

      // Playing state
      if (isPlaying && sampleName) {
        fillColor = "#666666";
      }

      // Selection highlights
      if (isPathSelected && !(isPlaying && sampleName)) {
        fillColor = "#171717";
        strokeWidth = 4;
        strokeColor = "#666666";
      }
      if (isBranchSelected) {
        fillColor = "blue";
      }

      // Endpoint styling
      if (!isPathSelected && isPath && lastHexInPath) {
        strokeColor = "red";
        strokeWidth = 0.5;
      }
      if (effect.type === "fx" && isBranch && lastHexInPath) {
        strokeColor = "white";
        strokeWidth = 1;
      }
      if (effect.type === "utility" && isBranch && lastHexInPath) {
        strokeColor = "blue";
        strokeWidth = 1;
      }

      // Hex selection highlight
      if (isHexSelected) {
        strokeColor = "#999900";
      }

      // Opacity classes
      let opacityClass = "opacity-100";
      if (isHidden) {
        opacityClass = "opacity-0";
      } else if (anyBranchSelected && !isBranchSelected) {
        opacityClass = "opacity-20";
      } else if (anyPathSelected && !isPathSelected) {
        opacityClass = "opacity-20";
      }

      // Text display
      let text = "";
      if (sampleName) {
        text = sampleName.charAt(0);
      } else if (effect.name) {
        text = effect.name.charAt(0);
      } else if (isMainHex) {
        text =
          isPathCreationMode && draftPath.length > 0
            ? `${draftPath.length.toString()}-bar`
            : "+";

        fontSize = isPathCreationMode && draftPath.length > 0 ? 12 : 26;
      }

      // Default cursor states
      if (selectedEffect?.name && isEffectDraft) {
        cursor = "cursor-pointer";
      } else if (isMainHex) {
        if (canCreateMorePaths(hexes, paths)) {
          cursor = "cursor-pointer";
        } else {
          cursor = "cursor-not-allowed";
        }
      } else if (
        (isPath || isBranch) &&
        cursor !== "cursor-not-allowed" &&
        !isPathCreationMode
      ) {
        cursor = "cursor-pointer";
      } else if ((isPath || isBranch) && cursor !== "cursor-not-allowed") {
        cursor = "cursor-not-allowed";
      }

      // Path Creation Mode Visualization
      if (isPathCreationMode) {
        strokeOpacity = 0.5;

        // Show existing paths and their adjacents in red
        if (isPath || isAdjacentToPathEnd) {
          cursor = "cursor-not-allowed";
          fillColor = "#1a1a1a";
          strokeColor = "#1a1a1a";
          strokeWidth = 1;
          strokeOpacity = 1;
        }

        // Draft path visualization
        if (isPathDraft) {
          fillColor = "#666666";
          cursor = "cursor-pointer";
        }

        // Adjacent to current hover visualization
        if (draftPath.length > 0) {
          const currentHoverPosition = draftPath[draftPath.length - 1];
          const isAdjacentToHover =
            hexDistance(hex, currentHoverPosition) === 1;

          // Check if current hover position would be adjacent to any existing path hex
          const existingPathHexes = paths.flatMap((path) => path.path);
          const wouldBeAdjacentToPath = existingPathHexes.some(
            (pathHex) => hexDistance(currentHoverPosition, pathHex) === 1
          );

          // Get all hexes adjacent to current hover position
          const adjacentHexesWouldInterfere = pathEnds.some((endHex) => {
            // Find all potential adjacent hexes to the current hover
            const adjacentPositions = hexes.filter(
              (h) =>
                hexDistance(h, currentHoverPosition) === 1 &&
                !h.isPath &&
                !h.isBranch
            );

            // Check if any of these adjacent positions would interfere
            return adjacentPositions.some(
              (adjHex) =>
                hexDistance(adjHex, endHex) === 1 ||
                areCoordinatesEqual(adjHex, endHex)
            );
          });

          if (isAdjacentToHover && !isPath && !isBranch && !isPathDraft) {
            cursor = "cursor-not-allowed";
            fillColor = "#333333";
            strokeColor = "#333333";
            strokeWidth = 1;
            strokeOpacity = 1;
          }

          if (isAdjacentToHover && !isPath && !isBranch && !isPathDraft) {
            if (
              (adjacentHexesWouldInterfere || wouldBeAdjacentToPath) &&
              !isCenterRing
            ) {
              cursor = "cursor-not-allowed";
              fillColor = "#1a1a1a";
              strokeColor = "#1a1a1a";
              strokeWidth = 1;
              strokeOpacity = 1;
            }
          }

          // Apply to draft path regardless of mouse position
          if (
            isPathDraft &&
            (adjacentHexesWouldInterfere || wouldBeAdjacentToPath) &&
            !isCenterRing
          ) {
            cursor = "cursor-not-allowed";
            fillColor = "#1a1a1a";
            strokeColor = "#1a1a1a";
            strokeWidth = 1;
            strokeOpacity = 1;
          }
        }
      }

      // Check if current step is 2 and hex is not in the path
      // Step 2: Reduce opacity if hex is not within the predefined q, r range
      // Step 2: Reduce opacity if hex is NOT in the predefined list of valid hexes
      if (guideStep === 2) {
        const validHexes = [
          { q: 2, r: -2 },
          { q: 3, r: -3 },
          { q: 4, r: -4 },
          { q: 5, r: -5 },
        ];

        const isHexInValidPath = validHexes.some(
          (validHex) => hex.q === validHex.q && hex.r === validHex.r
        );

        if (!isHexInValidPath) {
          strokeOpacity = 0.2;
          // fillColor = "transparent";
        } else {
          strokeOpacity = 1;
          // fillColor = "transparent";
        }
      }

      const handleMouseEnter = () => {
        setIsHovered(true);
        onMouseEnter();
      };

      const handleMouseLeave = () => {
        setIsHovered(false);
        onMouseLeave();
      };

      return (
        <g
          ref={ref}
          transform={`translate(${x}, ${y})`}
          onClick={onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cursor}
          data-coors={`${hex.q}, ${hex.r}`}
        >
          <polygon
            className={`transition-all duration-300 ${opacityClass}`}
            points={points}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
          />

          {text && (
            <text
              className={`transition-opacity duration-500 ${
                canCreateMorePaths(hexes, paths) ? "opacity-100" : "opacity-30"
              }`}
              style={{ pointerEvents: "none" }}
              x="0"
              y="0"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {text}
            </text>
          )}

          {/* {isPathCreationMode && isMainHex && (
          <circle cx="0" cy="0" r="3" fill="white" className="animate-pulse" />
        )} */}
        </g>
      );
    }
  )
);

export default Hex;
