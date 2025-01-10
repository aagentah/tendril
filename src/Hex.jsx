import React, { useState, memo } from "react";
import { useAtom } from "jotai";
import _ from "lodash";

// Import any atoms or utilities the Hex component needs
import {
  pathsAtom,
  draftPathAtom,
  selectedSampleAtom,
  selectedEffectAtom,
  isPathCreationModeAtom,
} from "./App";

import { getPathEdges, hexDistance } from "./hexUtils";

/**
 * Single hex cell component.
 */
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
    // Destructure hex properties, including precomputed x, y, and points
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
    const [paths] = useAtom(pathsAtom);
    const [draftPath] = useAtom(draftPathAtom);
    const [selectedSample] = useAtom(selectedSampleAtom);
    const [selectedEffect] = useAtom(selectedEffectAtom);
    const [isPathCreationMode] = useAtom(isPathCreationModeAtom);

    // Local state for hover
    const [isHovered, setIsHovered] = useState(false);

    // ------------------------------------------------
    // Determine base fill and stroke colors
    // ------------------------------------------------
    let fillColor = "transparent";
    let strokeColor = "grey";
    let strokeOpacity = 0.2;
    let strokeWidth = 0.5;
    let cursor = "cursor-default";

    // Base styles when no path or sample is selected
    if (paths.length === 0 && !selectedSample?.name) {
      strokeOpacity = 0.2;
    }

    // Main / Center / Outer ring styling
    if (isMainHex) {
      fillColor = "#171717";
      strokeColor = "#171717";
    }
    if (isCenterRing) {
      fillColor = "#171717";
      strokeColor = "#171717";
    }
    if (isOuterRing) {
      fillColor = "#171717";
    }

    // Path-draft coloring
    if (isPathDraft) {
      fillColor = "darkred";
    }

    // If actual path
    if (isPath) {
      strokeOpacity = 0.75;
    }

    // If playing
    if (isPlaying && sampleName) {
      fillColor = "grey";
    }

    // Path/branch selection highlights
    if (isPathSelected && !(isPlaying && sampleName)) {
      fillColor = "#171717";
      strokeWidth = 4;
      strokeColor = "grey";
    }
    if (isBranchSelected) {
      fillColor = "blue";
    }

    // Effect draft on hover (old logic):
    // if (isEffectDraft && selectedEffect?.type === "fx") {
    //   fillColor = "grey";
    //   strokeColor = "white";
    //   strokeWidth = 2;
    //   cursor = "cursor-pointer";
    // }
    // if (isEffectDraft && selectedEffect?.type === "utility") {
    //   fillColor = "blue";
    //   strokeColor = "white";
    //   strokeWidth = 2;
    //   cursor = "cursor-pointer";
    // }

    // ------------------------------------------------
    // NEW #2: Sample selected ⇒ highlight available path hexes
    // ------------------------------------------------
    if (selectedSample?.name && isPath && !sampleName) {
      // This hex is a path hex and has no sample, so highlight it yellow
      fillColor = "yellow";
    }

    // ------------------------------------------------
    // Figure out adjacency to path ends for effect placement
    // ------------------------------------------------
    const pathEnds = getPathEdges(paths, "last").filter(Boolean);
    const isAdjacentToPathEnd = pathEnds.some(
      (end) => hexDistance(hex, end) === 1
    );

    // ------------------------------------------------
    // NEW #3: Effect selected ⇒ show effect colors if hex is adjacent to a path end
    //         and not itself a path or branch
    // ------------------------------------------------
    if (selectedEffect?.type && isAdjacentToPathEnd && !isPath && !isBranch) {
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

    // ------------------------------------------------
    // Endpoint styling (unchanged logic)
    // ------------------------------------------------
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

    // ------------------------------------------------
    // Path creation mode #1: strokeOpacity = 0.5 for ALL hexes
    // ------------------------------------------------
    if (isPathCreationMode) {
      strokeOpacity = 0.5;
    }

    // ------------------------------------------------
    // If the hex was clicked-and-held (isHexSelected), highlight stroke
    // (unchanged from your original logic)
    // ------------------------------------------------
    if (isHexSelected) {
      strokeColor = "yellow";
    }

    // ------------------------------------------------
    // Determine overall hex opacity
    // ------------------------------------------------
    let opacityClass = "opacity-100";
    if (isHidden) {
      opacityClass = "opacity-0";
    } else if (anyBranchSelected && !isBranchSelected) {
      opacityClass = "opacity-20";
    } else if (anyPathSelected && !isPathSelected) {
      opacityClass = "opacity-20";
    }

    // ------------------------------------------------
    // Determine the text to display on the hex
    // ------------------------------------------------
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
    }

    // Some states override the cursor to show pointer
    if (selectedEffect?.name && isEffectDraft) {
      cursor = "cursor-pointer";
    } else if (isMainHex) {
      cursor = "cursor-pointer";
    } else if (isPath || isBranch) {
      cursor = "cursor-pointer";
    }

    // ------------------------------------------------
    // Hover handlers
    // ------------------------------------------------
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
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {text}
          </text>
        )}

        {/* Additional visual indicator for main hex in path creation mode */}
        {isPathCreationMode && isMainHex && (
          <circle cx="0" cy="0" r="3" fill="white" className="animate-pulse" />
        )}
      </g>
    );
  }
);

export default Hex;
