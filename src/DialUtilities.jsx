import { useCallback } from "react";
import PropTypes from "prop-types";
import { useAtom } from "jotai";
import { hexesAtom, effectRandomizationAtom } from "./atomStore";
import { effectStore } from "./sampleStore";
import _ from "lodash";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import { FaDice } from "react-icons/fa";

// Simple vertical slider component for utilities and effects
const SliderComponent = ({
  item,
  currentValue,
  onValueChange,
  position,
  isEffect = false,
}) => {
  const [effectRandomization, setEffectRandomization] = useAtom(
    effectRandomizationAtom
  );

  // Check if this item supports randomization (only effects: Chaos, Distortion, PitchShift)
  const supportsRandomization =
    isEffect && ["Chaos", "Distortion", "PitchShift"].includes(item.name);
  const randomizationSettings = supportsRandomization
    ? effectRandomization[item.name]
    : null;
  const isRandomMode = randomizationSettings?.enabled || false;

  // Toggle randomization mode
  const toggleRandomization = useCallback(() => {
    if (!supportsRandomization) return;

    console.log(
      `🎲 Toggling randomization for ${item.name}, current state:`,
      effectRandomization[item.name]
    );

    setEffectRandomization((prev) => {
      const newState = {
        ...prev,
        [item.name]: {
          ...prev[item.name],
          enabled: !prev[item.name].enabled,
          // If enabling, set sensible defaults based on current value
          min: !prev[item.name].enabled
            ? Math.max(
                item.name === "PitchShift" ? -12 : 0,
                (currentValue || 0) - 0.2
              )
            : prev[item.name].min,
          max: !prev[item.name].enabled
            ? Math.min(
                item.name === "PitchShift" ? 12 : 1,
                (currentValue || 0) + 0.2
              )
            : prev[item.name].max,
        },
      };
      console.log(
        `🎲 New randomization state for ${item.name}:`,
        newState[item.name]
      );
      return newState;
    });
  }, [
    supportsRandomization,
    item.name,
    currentValue,
    setEffectRandomization,
    effectRandomization,
  ]);

  // Update randomization range
  const updateRandomizationRange = useCallback(
    (newRange) => {
      if (!supportsRandomization || !isRandomMode) return;

      setEffectRandomization((prev) => ({
        ...prev,
        [item.name]: {
          ...prev[item.name],
          min: newRange[0],
          max: newRange[1],
        },
      }));
    },
    [supportsRandomization, isRandomMode, item.name, setEffectRandomization]
  );

  const getBaseSliderConfig = useCallback(() => {
    switch (item.name) {
      case "Offset":
        return {
          min: item.config.amount.min,
          max: item.config.amount.max,
          step: 0.01,
          value: currentValue || 0,
        };
      case "Speed":
        return {
          min: 0,
          max: 2,
          step: 1,
          value: item.config.rate.options.findIndex(
            (opt) => parseFloat(opt.value) === parseFloat(currentValue || 1)
          ),
        };
      case "Chaos":
        return {
          min: item.config.amount.min,
          max: item.config.amount.max,
          step: 0.01,
          value: currentValue || 0,
        };
      case "Distortion":
        return {
          min: item.config.amount.min,
          max: item.config.amount.max,
          step: 0.01,
          value: currentValue || 0,
        };
      case "Probability":
        return {
          min: item.config.chance.min,
          max: item.config.chance.max,
          step: 0.01,
          value: currentValue || 0,
        };
      case "Volume":
        return {
          min: item.config.volume.min,
          max: item.config.volume.max,
          step: item.config.volume.step,
          value:
            currentValue !== undefined
              ? currentValue
              : item.config.volume.default,
        };
      case "Pan":
        return {
          min: item.config.pan.min,
          max: item.config.pan.max,
          step: item.config.pan.step,
          value:
            currentValue !== undefined ? currentValue : item.config.pan.default,
        };
      case "PitchShift":
        return {
          min: item.config.pitch.min,
          max: item.config.pitch.max,
          step: item.config.pitch.step,
          value:
            currentValue !== undefined
              ? currentValue
              : item.config.pitch.default,
        };
      default:
        return { min: 0, max: 1, step: 0.01, value: currentValue || 0 };
    }
  }, [item, currentValue]);

  const getSliderConfig = useCallback(() => {
    // For randomizable effects in random mode, return range configuration
    if (isRandomMode && supportsRandomization) {
      const baseConfig = getBaseSliderConfig();
      return {
        ...baseConfig,
        value: [randomizationSettings.min, randomizationSettings.max],
        range: true,
      };
    }

    // Normal single-handle slider configuration
    return getBaseSliderConfig();
  }, [
    item,
    currentValue,
    isRandomMode,
    supportsRandomization,
    randomizationSettings,
    getBaseSliderConfig,
  ]);

  const formatDisplayValue = useCallback(
    (value) => {
      // Handle range values in random mode
      if (isRandomMode && Array.isArray(value)) {
        const [min, max] = value;
        const formatSingle = (val) => {
          switch (item.name) {
            case "Chaos":
            case "Distortion":
              return `${Math.round(val * 100)}%`;
            case "PitchShift":
              return `${val >= 0 ? "+" : ""}${val.toFixed(1)}`;
            default:
              return val.toFixed(2);
          }
        };
        return `${formatSingle(min)} ~ ${formatSingle(max)}`;
      }

      // Handle single values
      switch (item.name) {
        case "Speed": {
          const speedOptions = item.config.rate.options;
          const optionIndex = Math.round(value);
          if (speedOptions[optionIndex]) {
            return speedOptions[optionIndex].label;
          }
          return "Normal";
        }
        case "Offset":
        case "Chaos":
        case "Distortion":
        case "Probability":
          return `${Math.round(value * 100)}%`;
        case "Volume":
          return value.toFixed(2);
        case "Pan":
          return `${value.toFixed(1)} dB`;
        case "PitchShift":
          return `${value >= 0 ? "+" : ""}${value.toFixed(1)} st`;
        default:
          return value.toFixed(2);
      }
    },
    [item, isRandomMode]
  );

  const convertSliderValueToUtilityValue = useCallback(
    (sliderValue) => {
      switch (item.name) {
        case "Speed": {
          const speedOptions = item.config.rate.options;
          const optionIndex = Math.round(sliderValue);
          return speedOptions[optionIndex]
            ? parseFloat(speedOptions[optionIndex].value)
            : 1;
        }
        default:
          return parseFloat(sliderValue);
      }
    },
    [item]
  );

  const handleSliderChange = (value) => {
    if (isRandomMode && Array.isArray(value)) {
      // Handle range slider change for randomization
      updateRandomizationRange(value);
    } else {
      // Handle single value slider change
      const sliderValue = parseFloat(value);
      const utilityValue = convertSliderValueToUtilityValue(sliderValue);
      onValueChange(utilityValue);
    }
  };

  const config = getSliderConfig();

  // Different positioning for utilities vs effects
  const utilityPositions = [
    { x: 0, label: "Offset" },
    { x: 90, label: "Speed" },
    { x: 180, label: "Probability" },
    { x: 270, label: "Volume" },
    { x: 360, label: "Pan" },
  ];

  const effectPositions = [
    { x: 0, label: "Chaos" },
    { x: 90, label: "Distortion" },
    { x: 180, label: "PitchShift" },
  ];

  const positions = isEffect ? effectPositions : utilityPositions;
  const pos = positions[position] || { x: 0, label: "Unknown" };

  // Different colors for utilities vs effects
  const sliderColor = isEffect ? "#EF4444" : "#3B82F6"; // Red for effects, blue for utilities

  return (
    <div
      className="slider-utility"
      style={{
        position: "absolute",
        left: `${pos.x}px`,
        top: "0px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "80px",
      }}
    >
      {/* Dice button for randomizable effects */}
      {supportsRandomization && (
        <button
          onClick={toggleRandomization}
          className={`mb-1 p-1 rounded transition-colors duration-150 ${
            isRandomMode
              ? "bg-amber-500 text-white"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
          title={`Toggle randomization for ${item.name}`}
        >
          <FaDice size={10} />
        </button>
      )}

      {/* Vertical slider container */}
      <div className="relative mb-2 flex flex-col items-center">
        <div style={{ height: "64px", width: "12px" }}>
          <Slider
            vertical
            range={config.range}
            min={config.min}
            max={config.max}
            step={config.step}
            value={config.value}
            onChange={handleSliderChange}
            trackStyle={
              config.range
                ? [{ backgroundColor: sliderColor, width: "12px" }]
                : {
                    backgroundColor: sliderColor,
                    width: "12px",
                  }
            }
            railStyle={{
              backgroundColor: "#404040",
              width: "12px",
            }}
            handleStyle={
              config.range
                ? [
                    {
                      borderColor: sliderColor,
                      backgroundColor: sliderColor,
                      width: "16px",
                      height: "16px",
                      marginLeft: "-2px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    },
                    {
                      borderColor: sliderColor,
                      backgroundColor: sliderColor,
                      width: "16px",
                      height: "16px",
                      marginLeft: "-2px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    },
                  ]
                : {
                    borderColor: sliderColor,
                    backgroundColor: sliderColor,
                    width: "16px",
                    height: "16px",
                    marginLeft: "-2px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }
            }
            style={{
              height: "64px",
            }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-300 font-medium text-center mb-1">
        {item.name}
      </div>

      <div className="text-xs text-gray-500 text-center">
        {isRandomMode && config.range
          ? formatDisplayValue(config.value)
          : item.name === "Speed"
          ? formatDisplayValue(
              item.config.rate.options.findIndex(
                (opt) => parseFloat(opt.value) === parseFloat(currentValue || 1)
              )
            )
          : formatDisplayValue(currentValue || 0)}
      </div>
    </div>
  );
};

SliderComponent.propTypes = {
  item: PropTypes.object.isRequired,
  currentValue: PropTypes.number,
  onValueChange: PropTypes.func.isRequired,
  position: PropTypes.number.isRequired,
  isEffect: PropTypes.bool,
};

const DialUtilities = ({ pathId, paths, setPaths, branches, setBranches }) => {
  const [, setHexes] = useAtom(hexesAtom);
  const pathUtilities = branches.filter(
    (branch) => branch.parentPathId === pathId
  );
  const availableUtilities = effectStore.filter(
    (effect) => effect.type === "utility"
  );
  const availableEffects = effectStore.filter(
    (effect) => effect.type === "effect"
  );
  const currentPath = paths.find((p) => p.id === pathId);

  const getCurrentValue = useCallback(
    (item) => {
      const existingBranch = pathUtilities.find(
        (b) => b.effect.name === item.name
      );
      switch (item.name) {
        case "Chaos":
          return currentPath?.chaos || 0;
        case "Distortion":
          return currentPath?.distortion || 0;
        case "PitchShift":
          return currentPath?.pitchShift || 0;
        case "Probability":
          return currentPath?.probability || 0;
        case "Speed":
          return existingBranch?.effectConfig?.rate?.value
            ? parseFloat(existingBranch.effectConfig.rate.value)
            : 1;
        case "Offset":
          return existingBranch?.effectConfig?.amount?.value || 0;
        case "Volume":
          return currentPath?.volume !== undefined ? currentPath.volume : 1;
        case "Pan":
          return currentPath?.pan !== undefined ? currentPath.pan : 0;
        default:
          return 0;
      }
    },
    [pathUtilities, currentPath]
  );

  const handleValueChange = useCallback(
    async (item, newValue) => {
      if (
        item.name === "Chaos" ||
        item.name === "Distortion" ||
        item.name === "PitchShift"
      ) {
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          const pathIndex = newPaths.findIndex((p) => p.id === pathId);
          if (pathIndex !== -1) {
            const pathProperty =
              item.name === "PitchShift"
                ? "pitchShift"
                : item.name.toLowerCase();
            newPaths[pathIndex] = {
              ...newPaths[pathIndex],
              [pathProperty]: newValue,
            };
          }
          return newPaths;
        });

        const existingUtility = pathUtilities.find(
          (u) => u.effect.name === item.name
        );
        if (existingUtility) {
          if (newValue > 0) {
            setBranches((prevBranches) =>
              prevBranches.map((b) => {
                if (b.id === existingUtility.id) {
                  const configKey =
                    item.name === "PitchShift" ? "pitch" : "amount";
                  return {
                    ...b,
                    effectConfig: {
                      ...b.effectConfig,
                      [configKey]: {
                        ...b.effectConfig[configKey],
                        value: newValue,
                      },
                    },
                  };
                }
                return b;
              })
            );
          } else {
            setBranches((prevBranches) =>
              prevBranches.filter((b) => b.id !== existingUtility.id)
            );
            setHexes((prevHexes) =>
              prevHexes.map((h) => {
                if (h.branchId === existingUtility.id) {
                  return { ...h, branchId: null };
                }
                return h;
              })
            );
          }
        } else if (newValue !== 0) {
          const { v4: uuidv4 } = await import("uuid");
          const newBranchId = uuidv4();
          const effectConfig = _.cloneDeep(item.config);
          const configKey = item.name === "PitchShift" ? "pitch" : "amount";
          effectConfig[configKey].value = newValue;

          if (!currentPath || !currentPath.path) return;
          const lastHex = currentPath.path[currentPath.path.length - 1];

          setBranches((prevBranches) => [
            ...prevBranches,
            {
              id: newBranchId,
              parentPathId: pathId,
              effect: { type: item.type, name: item.name },
              effectConfig,
              branch: [lastHex],
            },
          ]);

          setHexes((prevHexes) =>
            prevHexes.map((h) => {
              if (h.q === lastHex.q && h.r === lastHex.r) {
                return { ...h, branchId: newBranchId };
              }
              return h;
            })
          );
        }
        return;
      }

      if (item.name === "Probability") {
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          const pathIndex = newPaths.findIndex((p) => p.id === pathId);
          if (pathIndex !== -1) {
            newPaths[pathIndex] = {
              ...newPaths[pathIndex],
              probability: newValue,
            };
          }
          return newPaths;
        });

        const existingUtility = pathUtilities.find(
          (u) => u.effect.name === item.name
        );
        if (existingUtility) {
          if (newValue > 0) {
            setBranches((prevBranches) =>
              prevBranches.map((b) => {
                if (b.id === existingUtility.id) {
                  return {
                    ...b,
                    effectConfig: {
                      ...b.effectConfig,
                      chance: { ...b.effectConfig.chance, value: newValue },
                    },
                  };
                }
                return b;
              })
            );
          } else {
            setBranches((prevBranches) =>
              prevBranches.filter((b) => b.id !== existingUtility.id)
            );
            setHexes((prevHexes) =>
              prevHexes.map((h) => {
                if (h.branchId === existingUtility.id) {
                  return { ...h, branchId: null };
                }
                return h;
              })
            );
          }
        } else if (newValue > 0) {
          const { v4: uuidv4 } = await import("uuid");
          const newBranchId = uuidv4();
          const effectConfig = _.cloneDeep(item.config);
          effectConfig.chance.value = newValue;

          if (!currentPath || !currentPath.path) return;
          const lastHex = currentPath.path[currentPath.path.length - 1];

          setBranches((prevBranches) => [
            ...prevBranches,
            {
              id: newBranchId,
              parentPathId: pathId,
              effect: { type: item.type, name: item.name },
              effectConfig,
              branch: [lastHex],
            },
          ]);

          setHexes((prevHexes) =>
            prevHexes.map((h) => {
              if (h.q === lastHex.q && h.r === lastHex.r) {
                return { ...h, branchId: newBranchId };
              }
              return h;
            })
          );
        }
        return;
      }

      if (item.name === "Volume") {
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          const pathIndex = newPaths.findIndex((p) => p.id === pathId);
          if (pathIndex !== -1) {
            newPaths[pathIndex] = {
              ...newPaths[pathIndex],
              volume: newValue,
            };
          }
          return newPaths;
        });
        return;
      }

      if (item.name === "Pan") {
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          const pathIndex = newPaths.findIndex((p) => p.id === pathId);
          if (pathIndex !== -1) {
            newPaths[pathIndex] = {
              ...newPaths[pathIndex],
              pan: newValue,
            };
          }
          return newPaths;
        });

        // Update post-effects panner for real-time feedback
        // Note: Pan is now handled by the path effects chain's postPanner node
        // which will be updated during the next audio trigger

        return;
      }

      const existingUtility = pathUtilities.find(
        (u) => u.effect.name === item.name
      );
      const defaultValue = item.name === "Speed" ? 1 : 0;

      if (existingUtility) {
        if (newValue !== defaultValue) {
          const configKey = item.name === "Speed" ? "rate" : "amount";
          setBranches((prevBranches) =>
            prevBranches.map((b) => {
              if (b.id === existingUtility.id) {
                return {
                  ...b,
                  effectConfig: {
                    ...b.effectConfig,
                    [configKey]: {
                      ...b.effectConfig[configKey],
                      value: newValue,
                    },
                  },
                };
              }
              return b;
            })
          );
        } else {
          setBranches((prevBranches) =>
            prevBranches.filter((b) => b.id !== existingUtility.id)
          );
          setHexes((prevHexes) =>
            prevHexes.map((h) => {
              if (h.branchId === existingUtility.id) {
                return { ...h, branchId: null };
              }
              return h;
            })
          );
        }
      } else if (newValue !== defaultValue) {
        const { v4: uuidv4 } = await import("uuid");
        const newBranchId = uuidv4();
        const effectConfig = _.cloneDeep(item.config);
        const configKey = item.name === "Speed" ? "rate" : "amount";
        effectConfig[configKey].value = newValue;

        if (!currentPath || !currentPath.path) return;
        const lastHex = currentPath.path[currentPath.path.length - 1];

        setBranches((prevBranches) => [
          ...prevBranches,
          {
            id: newBranchId,
            parentPathId: pathId,
            effect: { type: item.type, name: item.name },
            effectConfig,
            branch: [lastHex],
          },
        ]);

        setHexes((prevHexes) =>
          prevHexes.map((h) => {
            if (h.q === lastHex.q && h.r === lastHex.r) {
              return { ...h, branchId: newBranchId };
            }
            return h;
          })
        );
      }
    },
    [pathId, pathUtilities, currentPath, setPaths, setBranches, setHexes]
  );

  return (
    <div className="mt-4">
      {/* Utilities Section */}
      <label className="block text-sm font-medium text-white mb-4">
        Utilities
      </label>
      <div
        className="relative mb-6"
        style={{ height: "120px", width: "450px" }}
      >
        {availableUtilities.map((item, index) => (
          <SliderComponent
            key={item.name}
            item={item}
            currentValue={getCurrentValue(item)}
            onValueChange={(value) => handleValueChange(item, value)}
            position={index}
            isEffect={false}
          />
        ))}
      </div>

      {/* Effects Section */}
      <label className="block text-sm font-medium text-white mb-4">
        Effects
      </label>
      <div className="relative" style={{ height: "120px", width: "270px" }}>
        {availableEffects.map((item, index) => (
          <SliderComponent
            key={item.name}
            item={item}
            currentValue={getCurrentValue(item)}
            onValueChange={(value) => handleValueChange(item, value)}
            position={index}
            isEffect={true}
          />
        ))}
      </div>
    </div>
  );
};

DialUtilities.propTypes = {
  pathId: PropTypes.string.isRequired,
  paths: PropTypes.array.isRequired,
  setPaths: PropTypes.func.isRequired,
  branches: PropTypes.array.isRequired,
  setBranches: PropTypes.func.isRequired,
};

export default DialUtilities;
