import React, { useState, memo } from "react";
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

import { getPathEdges, hexDistance, areCoordinatesEqual } from "./hexUtils";

const Hex = memo(
  ({
    hex,
    onClick,
    onMouseEnter,
    onMouseLeave,
    anyBranchSelected,
    anyPathSelected,
    anyHexSelected,
  }) => {
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

    const [isHovered, setIsHovered] = useState(false);

    // Get path ends and adjacency information
    const pathEnds = getPathEdges(paths, "last").filter(Boolean);
    const isAdjacentToPathEnd = pathEnds.some(
      (end) => hexDistance(hex, end) === 1
    );

    // Base styles
    let fillColor = "transparent";
    let strokeColor = "grey";
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
        fillColor = "grey";
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
      fillColor = "grey";
    }

    // Selection highlights
    if (isPathSelected && !(isPlaying && sampleName)) {
      fillColor = "#171717";
      strokeWidth = 4;
      strokeColor = "grey";
    }
    if (isBranchSelected) {
      fillColor = "blue";
    }

    // Endpoint styling
    if (!isPathSelected && isPath && lastHexInPath) {
      strokeColor = "red";
      strokeWidth = 1;
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
      cursor = "cursor-pointer";
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
        fillColor = "#ff000033";
        strokeColor = "#ff000033";
        strokeWidth = 1;
        strokeOpacity = 0.2;
      }

      // Draft path visualization
      if (isPathDraft) {
        fillColor = "grey";
        cursor = "cursor-pointer";
      }

      // Adjacent to current hover visualization
      if (draftPath.length > 0) {
        const currentHoverPosition = draftPath[draftPath.length - 1];
        const isAdjacentToHover = hexDistance(hex, currentHoverPosition) === 1;

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
          if (adjacentHexesWouldInterfere) {
            cursor = "cursor-not-allowed";
            fillColor = "#ff000033";
            strokeColor = "#ff0000";
            strokeWidth = 1;
            strokeOpacity = 0.5;
          }
        }

        // Apply to draft path regardless of mouse position
        if (isPathDraft && adjacentHexesWouldInterfere) {
          cursor = "cursor-not-allowed";
        }
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
        transform={`translate(${x}, ${y})`}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cursor}
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
            className="transition-opacity duration-500 opacity-100"
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
);

export default Hex;
