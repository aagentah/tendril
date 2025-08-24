import { useState, memo, forwardRef } from "react";
import { useAtom } from "jotai";
import PropTypes from "prop-types";

// Import atoms from centralized store instead of App.jsx
import {
  pathsAtom,
  draftPathAtom,
  selectedSampleAtom,
  selectedEffectAtom,
  isPathCreationModeAtom,
  hexesAtom,
  guideStepAtom,
  guideVisibleAtom,
} from "./atomStore";

import { canCreateMorePaths } from "./hexUtils";

// Import the styling utility
import { getHexStyling } from "./animationUtils";

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
        isAdjacentToPathEnd,
      },
      ref
    ) => {
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

      // Get styling using the shared utility function
      const styleState = {
        selectedSample,
        selectedEffect,
        isPathCreationMode,
        hexes,
        paths,
        draftPath,
        isAdjacentToPathEnd,
      };

      const styling = getHexStyling(hex, styleState, isHovered);

      // Text display
      let text = "";
      let fontSize = styling.fontSize;

      if (hex.sampleName) {
        text = hex.sampleName.charAt(0);
      } else if (hex.effect.name) {
        text = hex.effect.name.charAt(0);
      } else if (hex.isMainHex) {
        text =
          isPathCreationMode && draftPath.length > 0
            ? `${draftPath.length.toString()}-step`
            : "+";

        fontSize = isPathCreationMode && draftPath.length > 0 ? 10 : 26;
      } else if (hex.isPathDraft) {
        // Add counter text for path draft hexes
        const index = draftPath.findIndex(
          (dh) => dh.q === hex.q && dh.r === hex.r
        );
        if (index >= 0) {
          text = (index + 1).toString();
          fontSize = 10;
        }
      }

      // Opacity classes
      let opacityClass = "opacity-100";
      if (hex.isHidden) {
        opacityClass = "opacity-0";
      } else if (anyBranchSelected && !hex.isBranchSelected) {
        opacityClass = "opacity-20";
      } else if (anyPathSelected && !hex.isPathSelected) {
        opacityClass = "opacity-20";
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
          styling.strokeOpacity = 0.2;
        } else {
          styling.strokeOpacity = 1;
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
          transform={`translate(${hex.x}, ${hex.y})`}
          onClick={onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={styling.cursor}
          data-coors={`${hex.q}, ${hex.r}`}
        >
          <polygon
            className={opacityClass}
            points={hex.points}
            fill={styling.finalFillColor}
            fillOpacity={styling.finalFillOpacity}
            stroke={styling.strokeColor}
            strokeWidth={styling.strokeWidth}
            strokeOpacity={styling.strokeOpacity}
          />

          {text && (
            <text
              className={`${
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

Hex.propTypes = {
  hex: PropTypes.shape({
    q: PropTypes.number.isRequired,
    r: PropTypes.number.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    points: PropTypes.array.isRequired,
    isMainHex: PropTypes.bool,
    isCenterRing: PropTypes.bool,
    isOuterRing: PropTypes.bool,
    isPathDraft: PropTypes.bool,
    isPath: PropTypes.bool,
    isBranch: PropTypes.bool,
    isPlaying: PropTypes.bool,
    sampleName: PropTypes.string,
    effect: PropTypes.shape({
      type: PropTypes.string,
      name: PropTypes.string,
    }),
    isHidden: PropTypes.bool,
    isPathSelected: PropTypes.bool,
    isBranchSelected: PropTypes.bool,
    isEffectDraft: PropTypes.bool,
    isHexSelected: PropTypes.bool,
    lastHexInPath: PropTypes.bool,
  }).isRequired,
  onClick: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  anyBranchSelected: PropTypes.bool,
  anyPathSelected: PropTypes.bool,
  isAdjacentToPathEnd: PropTypes.bool,
};

// Add default props
Hex.defaultProps = {
  isAdjacentToPathEnd: false,
  onClick: () => {},
  onMouseEnter: () => {},
  onMouseLeave: () => {},
  anyBranchSelected: false,
  anyPathSelected: false,
};

export default Hex;
