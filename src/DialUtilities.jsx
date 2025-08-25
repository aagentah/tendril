import { useCallback } from "react";
import PropTypes from "prop-types";
import { useAtom } from "jotai";
import { hexesAtom } from "./atomStore";
import { effectStore } from "./sampleStore";
import _ from "lodash";

// Simple vertical slider component for utilities and effects
const SliderComponent = ({
  item,
  currentValue,
  onValueChange,
  position,
  isEffect = false,
}) => {
  const getSliderConfig = useCallback(() => {
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
      case "Probability":
        return {
          min: item.config.chance.min,
          max: item.config.chance.max,
          step: 0.01,
          value: currentValue || 0,
        };
      default:
        return { min: 0, max: 1, step: 0.01, value: currentValue || 0 };
    }
  }, [item, currentValue]);

  const formatDisplayValue = useCallback(
    (value) => {
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
        case "Probability":
          return `${Math.round(value * 100)}%`;
        default:
          return value.toFixed(2);
      }
    },
    [item]
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

  const handleSliderChange = (event) => {
    const sliderValue = parseFloat(event.target.value);
    const utilityValue = convertSliderValueToUtilityValue(sliderValue);
    onValueChange(utilityValue);
  };

  const config = getSliderConfig();

  // Different positioning for utilities vs effects
  const utilityPositions = [
    { x: 0, label: "Offset" },
    { x: 90, label: "Speed" },
    { x: 180, label: "Probability" },
  ];

  const effectPositions = [{ x: 0, label: "Chaos" }];

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
      {/* Vertical slider container */}
      <div className="relative mb-2 flex flex-col items-center">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={config.value}
          onChange={handleSliderChange}
          className="h-16 w-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            writingMode: "bt-lr",
            WebkitAppearance: "slider-vertical",
            background: `linear-gradient(to top, ${sliderColor} 0%, ${sliderColor} ${
              ((config.value - config.min) / (config.max - config.min)) * 100
            }%, #404040 ${
              ((config.value - config.min) / (config.max - config.min)) * 100
            }%, #404040 100%)`,
          }}
        />
      </div>

      <div className="text-xs text-gray-300 font-medium text-center mb-1">
        {item.name}
      </div>

      <div className="text-xs text-gray-500 text-center">
        {item.name === "Speed"
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
        case "Probability":
          return currentPath?.probability || 0;
        case "Speed":
          return existingBranch?.effectConfig?.rate?.value
            ? parseFloat(existingBranch.effectConfig.rate.value)
            : 1;
        case "Offset":
          return existingBranch?.effectConfig?.amount?.value || 0;
        default:
          return 0;
      }
    },
    [pathUtilities, currentPath]
  );

  const handleValueChange = useCallback(
    async (item, newValue) => {
      if (item.name === "Chaos") {
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          const pathIndex = newPaths.findIndex((p) => p.id === pathId);
          if (pathIndex !== -1) {
            newPaths[pathIndex] = { ...newPaths[pathIndex], chaos: newValue };
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
                      amount: { ...b.effectConfig.amount, value: newValue },
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
          effectConfig.amount.value = newValue;

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
        style={{ height: "120px", width: "270px" }}
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
      <div className="relative" style={{ height: "120px", width: "90px" }}>
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
