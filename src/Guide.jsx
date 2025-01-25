// Guide.jsx
import React, { useEffect, useState } from "react";
import { atom, useAtom } from "jotai";

// Atoms specific to Guide
export const guideStepAtom = atom(1);
export const guideVisibleAtom = atom(true);

// Atom for storing element refs
export const guideTargetRefsAtom = atom({
  firstHexRef: null,
  mainHex: null,
  effectDraft: null,
  pathHex: null,
  samplePanel: null,
  playButton: null,
  effectPanel: null,
  pathEnd: null,
});

/**
 * Retrieves the coordinates of an element.
 * @param {React.RefObject} ref - The ref of the target element.
 * @param {boolean} useTopLeft - Whether to use the top-left corner instead of the center.
 * @returns {Object|null} - The x and y coordinates or null if ref is not available.
 */
const getElementCoords = (ref, useTopLeft = false) => {
  if (!ref?.current) return null;
  const rect = ref.current.getBoundingClientRect();
  return {
    x: useTopLeft
      ? rect.left + window.scrollX
      : rect.left + rect.width / 2 + window.scrollX,
    y: useTopLeft
      ? rect.top + window.scrollY + 12
      : rect.top + rect.height / 2 + window.scrollY,
  };
};

const Guide = () => {
  const [currentStep] = useAtom(guideStepAtom);
  const [isVisible] = useAtom(guideVisibleAtom);
  const [targetRefs] = useAtom(guideTargetRefsAtom);
  const [targetCoords, setTargetCoords] = useState({ x: 0, y: 0 });

  const isMobile = window.innerWidth <= 768;

  // Define the guides outside the component to ensure stable reference
  const guides = {
    1: {
      text: "1: Click here to start drafting a path",
      getTarget: (targetRefs) => targetRefs.mainHex,
      // Specific offsets for step 1
      xOffset: 0, // Example: shift 0 pixels horizontally
      yOffset: -75, // Example: shift 75 pixels upwards
      useTopLeft: isMobile ? false : false, // Center position
    },
    2: {
      text: "2: Click any hex in the grid to establish path",
      getTarget: (targetRefs) => targetRefs.firstHex,
      // No additional offsets; uses default
      xOffset: 0,
      yOffset: -75,
      useTopLeft: isMobile ? false : false, // Center position
    },
    3: {
      text: "3: Select a sample",
      getTarget: (targetRefs) => targetRefs.samplePanel,
      // Offsets and top-left position for samplePanel
      xOffset: isMobile ? 0 : -200,
      yOffset: -75,
      useTopLeft: isMobile ? false : true, // Top-left position
    },
    4: {
      text: "4: Place sample anywhere on your path",
      getTarget: (targetRefs) => targetRefs.pathHex,
      // No additional offsets; uses default
      xOffset: 0,
      yOffset: -75,
      useTopLeft: isMobile ? false : false, // Center position
    },
    5: {
      text: "5: Press play to hear your sequence",
      getTarget: (targetRefs) => targetRefs.playButton,
      // Offsets and top-left position for playButton
      xOffset: isMobile ? 0 : -200,
      yOffset: -75,
      useTopLeft: isMobile ? false : true, // Top-left position
    },
    6: {
      text: "6: Click an effect to add",
      getTarget: (targetRefs) => targetRefs.effectPanel,
      // Offsets and top-left position for effectPanel
      xOffset: isMobile ? 0 : -200,
      yOffset: isMobile ? -75 : 75,
      useTopLeft: isMobile ? false : true, // Top-left position
    },
    7: {
      text: "7: Place effect on any neighbouring hex",
      getTarget: (targetRefs) => targetRefs.effectDraft,
      // No additional offsets; uses default
      xOffset: 0,
      yOffset: -75,
      useTopLeft: isMobile ? false : false, // Center position
    },
    8: {
      text: "8: That's the basics. Create more paths and have fun.",
      getTarget: (targetRefs) => targetRefs.mainHex,
      // No additional offsets; uses default
      xOffset: 0,
      yOffset: 75,
      useTopLeft: isMobile ? false : false, // Center position
    },
  };

  // Define the default offsets for the line start coordinates
  const DEFAULT_LINE_START_OFFSET_X = 0; // pixels to subtract from target x for x1
  const DEFAULT_LINE_START_OFFSET_Y = 0; // pixels to subtract from target y for y1

  // Define the default offsets for the guide text
  const DEFAULT_GUIDE_VERTICAL_OFFSET = 10; // pixels above the line's start point (y1)

  useEffect(() => {
    const handleResize = () => {
      const currentGuide = guides[currentStep];
      if (!currentGuide) return;

      const targetRef = currentGuide.getTarget(targetRefs);
      const coords = getElementCoords(targetRef, currentGuide.useTopLeft);
      if (coords) {
        setTargetCoords({
          x: coords.x,
          y: coords.y,
        });
      }
    };

    // Initial calculation
    handleResize();

    // Add window resize listener
    window.addEventListener("resize", handleResize);

    // Add ResizeObserver for element position changes
    const currentGuide = guides[currentStep];
    const targetRef = currentGuide?.getTarget(targetRefs);
    let observer;
    if (targetRef?.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(targetRef.current);
    }

    return () => {
      if (observer && targetRef?.current) {
        observer.disconnect();
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [currentStep, targetRefs]); // Removed 'guides' from dependencies

  if (!isVisible) return null;

  const currentGuide = guides[currentStep];

  // Calculate the line start coordinates with relative offsets
  const x1 =
    targetCoords.x - DEFAULT_LINE_START_OFFSET_X + currentGuide.xOffset;
  const y1 =
    targetCoords.y - DEFAULT_LINE_START_OFFSET_Y + currentGuide.yOffset;

  // Define the line end coordinates (x2, y2) as per original requirement
  const x2 = targetCoords.x;
  const y2 = targetCoords.y;

  return (
    <div className="fixed left-0 top-0 w-full h-full pointer-events-none z-30">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <span
          className="bg-neutral-900 border text-xxs px-2 py-1.5 absolute"
          style={{
            left: x1,
            top: y1 - DEFAULT_GUIDE_VERTICAL_OFFSET,
            transform: "translate(-50%, -25%)",
            borderColor: "#ff8080",
            color: "#ff8080",
            // whiteSpace: "nowrap",
          }}
        >
          {currentGuide.text}
        </span>
        <svg
          width={Math.max(800, window.innerWidth)}
          height={Math.max(800, window.innerHeight)}
          className="absolute top-0 left-0"
          style={{ zIndex: -1 }}
        >
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ff8080"
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
      </div>
    </div>
  );
};

export default Guide;
