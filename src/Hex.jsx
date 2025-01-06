// Hex.jsx

import React, { useState, memo } from "react";
import { useAtom } from "jotai";

// Import any atoms or utilities the Hex component needs
import {
  pathsAtom,
  draftPathAtom,
  selectedSampleAtom,
  selectedEffectAtom,
} from "./App";

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

    // Atom states (uncomment if needed; some were commented out in original code)
    // const [paths] = useAtom(pathsAtom);
    // const [branches] = useAtom(branchesAtom);
    const [paths] = useAtom(pathsAtom);
    const [draftPath] = useAtom(draftPathAtom);
    const [selectedSample] = useAtom(selectedSampleAtom);
    const [selectedEffect] = useAtom(selectedEffectAtom);

    // Local state for hover
    const [isHovered, setIsHovered] = useState(false);

    // Determine fill and stroke colors
    let fillColor = "transparent";
    let strokeColor = "grey";
    let strokeOpacity = 0.5;
    let strokeWidth = 0.5;

    if (paths.length === 0 && !selectedSample?.name) {
      strokeOpacity = 0.2;
    }

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
      // strokeColor = "#171717"; // optional
    }

    if (isPathDraft) {
      fillColor = "darkred";
    }

    if (isPlaying && sampleName) {
      fillColor = "grey";
    }

    if (isPathSelected && !(isPlaying && sampleName)) {
      fillColor = "#171717";
      strokeWidth = 4;
      strokeColor = "grey";
    }

    if (isBranchSelected) {
      fillColor = "blue";
    }

    if (isEffectDraft && selectedEffect.type === "fx") {
      fillColor = "grey";
    }

    if (isEffectDraft && selectedEffect.type === "utility") {
      fillColor = "blue";
    }

    if (!isPathSelected && isPath && lastHexInPath) {
      strokeColor = "red";
      // strokeOpacity = 1;
      // strokeWidth = 1;
    }

    if (effect.type === "fx" && isBranch && lastHexInPath) {
      strokeColor = "white";
      strokeOpacity = 1;
      strokeWidth = 1;
    }

    if (effect.type === "utility" && isBranch && lastHexInPath) {
      strokeColor = "blue";
      strokeOpacity = 1;
      strokeWidth = 1;
    }

    if (isHexSelected) {
      strokeColor = "grey";
      strokeWidth = 4;
    }

    // If a hex is selected for sample-moving, highlight potential targets
    if (anyHexSelected && isPathSelected && !sampleName && isHovered) {
      fillColor = "grey";
    }

    // Determine opacity
    let opacityClass = "opacity-100";
    if (isHidden) {
      opacityClass = "opacity-0";
    } else if (anyBranchSelected && !isBranchSelected) {
      opacityClass = "opacity-20";
    } else if (anyPathSelected && !isPathSelected) {
      opacityClass = "opacity-20";
    }

    // Determine text to display
    let text = "";
    if (sampleName) {
      text = sampleName.charAt(0);
    } else if (effect.name) {
      // For debugging
      console.log("effect.name", effect.name);
      text = effect.name.charAt(0);
    } else if (isMainHex) {
      text = draftPath.length > 0 ? `${draftPath.length.toString()}-bar` : "";
    }

    // Determine cursor style
    let cursor = "";
    if (isHexSelected) {
      cursor = "cursor-pointer";
      fillColor = "grey";
    } else if (selectedSample?.name && isPath && isHovered) {
      cursor = "cursor-crosshair";
      fillColor = "grey";
    } else if (isPath && selectedSample?.name && !draftPath.length) {
      cursor = "cursor-crosshair";
      fillColor = "#171717";
      strokeWidth = 4;
      strokeColor = "grey";
    } else if (selectedSample?.name && isPath) {
      cursor = "cursor-crosshair";
      fillColor = "darkred";
    } else if (
      !selectedSample?.name &&
      !selectedEffect?.name &&
      !isPath &&
      !isBranch
    ) {
      cursor = "cursor-crosshair";
    } else if (isEffectDraft && selectedEffect?.name) {
      cursor = "cursor-crosshair";
    } else if (anyHexSelected && isPathSelected && !sampleName && isHovered) {
      cursor = "cursor-crosshair";
    }

    // Event handlers for hover state
    const handleMouseEnter = () => {
      onMouseEnter();
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      onMouseLeave();
      setIsHovered(false);
    };

    return (
      <g
        transform={`translate(${x}, ${y})`}
        // onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseUp={onClick}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          const element = document.elementFromPoint(
            touch.clientX,
            touch.clientY
          );
          if (element === e.currentTarget) {
            handleMouseEnter();
          } else {
            handleMouseLeave();
          }
        }}
        onTouchEnd={onClick}
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
      </g>
    );
  }
);

export default Hex;
