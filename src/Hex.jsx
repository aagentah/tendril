import React, { useState, memo, forwardRef, useEffect } from "react";
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

import { guideStepAtom, guideTargetRefsAtom, guideVisibleAtom } from "./Guide";

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
      const [guideStep] = useAtom(guideStepAtom);
      const [guideVisible] = useAtom(guideVisibleAtom);

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

      if (isPath || isBranch) {
        strokeOpacity = 1;
      }

      // Effect placement visualization (now static fill colors, no animations)
      if (!isPath && !isBranch && selectedEffect?.type && isAdjacentToPathEnd) {
        if (selectedEffect.type === "fx") {
          fillColor = "grey"; // Static grey for fx
          strokeWidth = 2;
          strokeOpacity = 1;
          cursor = "cursor-pointer";
        } else if (selectedEffect.type === "utility") {
          fillColor = "#172AA0"; // Static blue-ish for utility
          strokeWidth = 2;
          strokeOpacity = 1;
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
        fillColor = "#172AA0";
      }

      // Endpoint styling
      if (!isPathSelected && isPath && lastHexInPath) {
        strokeColor = "#850D15";
        strokeWidth = 1;
      }
      if (effect.type === "fx" && isBranch && lastHexInPath) {
        strokeColor = "grey";
        strokeWidth = 1;
      }
      if (effect.type === "utility" && isBranch && lastHexInPath) {
        strokeColor = "#172AA0";
        strokeWidth = 1;
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

        if (isPath || isAdjacentToPathEnd) {
          cursor = "cursor-not-allowed";
          fillColor = "#1a1a1a";
          strokeColor = "#666666";
          strokeWidth = 1;
          strokeOpacity = 1;
        }

        if (isPathDraft) {
          fillColor = "#666666";
          cursor = "cursor-pointer";
        }

        if (draftPath.length > 0) {
          const currentHoverPosition = draftPath[draftPath.length - 1];
          const isAdjacentToHover =
            hexDistance(hex, currentHoverPosition) === 1;
          const existingPathHexes = paths.flatMap((path) => path.path);
          const wouldBeAdjacentToPath = existingPathHexes.some(
            (pathHex) => hexDistance(currentHoverPosition, pathHex) === 1
          );

          const adjacentHexesWouldInterfere = pathEnds.some((endHex) => {
            const adjacentPositions = hexes.filter(
              (h) =>
                hexDistance(h, currentHoverPosition) === 1 &&
                !h.isPath &&
                !h.isBranch
            );

            return adjacentPositions.some(
              (adjHex) =>
                hexDistance(adjHex, endHex) === 1 ||
                areCoordinatesEqual(adjHex, endHex)
            );
          });

          if (isAdjacentToHover && !isPath && !isBranch && !isPathDraft) {
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
              fillColor = "#333333";
              strokeColor = "#333333";
              strokeWidth = 1;
              strokeOpacity = 1;
            }
          }

          if (
            isPathDraft &&
            (adjacentHexesWouldInterfere || wouldBeAdjacentToPath) &&
            !isCenterRing
          ) {
            cursor = "cursor-not-allowed";
            fillColor = "#333333";
            strokeColor = "#333333";
            strokeWidth = 1;
            strokeOpacity = 1;
          }
        }
      }

      // Guide step visualization
      if (guideVisible && guideStep === 2) {
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
        } else {
          strokeOpacity = 1;
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

      // Final fill (no flashing, just static conditions)
      let finalFillColor = fillColor;
      let finalFillOpacity = 1;

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
      // If a utility can be placed here
      else if (
        selectedEffect?.type === "utility" &&
        !isPath &&
        !isBranch &&
        isAdjacentToPathEnd
      ) {
        finalFillColor = "#172AA0"; // Static blue for utility
      }

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
            fill={finalFillColor}
            fillOpacity={finalFillOpacity}
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
        </g>
      );
    }
  )
);

export default Hex;
