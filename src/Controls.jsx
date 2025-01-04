// Controls.jsx

import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import * as Tone from "tone";
import _ from "lodash";
import {
  FaPlay,
  FaPause,
  FaMicrophone,
  FaMicrophoneSlash,
  FaStop,
} from "react-icons/fa";

// Import atoms and utility functions from your split files
import {
  isAudioPlayingAtom,
  selectedSampleAtom,
  bpmAtom,
  hexesAtom,
  pathsAtom,
  branchesAtom,
  selectedEffectAtom,
  currentIndicesAtom,
  userSamplesAtom,
  getAllUserSamples,
  addUserSample,
  removeUserSample,
  sampleStore,
  sampleToNoteMap,
  effectStore,
} from "./App";
import { updateHexProperties } from "./hexUtils";

/**
 * Controls component with Play/Pause functionality and additional controls.
 * @param {Object} props - (optional) If you pass `onControlPress`, it will close the mobile panel automatically.
 */
const Controls = ({ onControlPress }) => {
  const [isAudioPlaying, setIsAudioPlaying] = useAtom(isAudioPlayingAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [bpm, setBpm] = useAtom(bpmAtom);
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [paths, setPaths] = useAtom(pathsAtom);
  const [branches, setBranches] = useAtom(branchesAtom);
  const [selectedEffect, setSelectedEffect] = useAtom(selectedEffectAtom);
  const [currentIndices, setCurrentIndices] = useAtom(currentIndicesAtom);

  // userSamples & tab state
  const [userSamples, setUserSamples] = useAtom(userSamplesAtom);
  const [activeSamplesTab, setActiveSamplesTab] = useState("default");

  // Recorder
  const recorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingArmed, setIsRecordingArmed] = useState(false);

  // Load user samples on mount
  useEffect(() => {
    getAllUserSamples().then((samples) => {
      setUserSamples(samples);
    });
  }, [setUserSamples]);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new Tone.Recorder();
    Tone.getDestination().connect(recorderRef.current);

    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose();
      }
    };
  }, []);

  // Auto-start recording if armed
  useEffect(() => {
    const handleRecordingStart = async () => {
      if (isRecordingArmed && isAudioPlaying && !isRecording) {
        await recorderRef.current.start();
        setIsRecording(true);
        setIsRecordingArmed(false);
      }
    };
    handleRecordingStart();
  }, [isAudioPlaying, isRecordingArmed, isRecording]);

  // -----------------------
  //       Main Methods
  // -----------------------

  const togglePlay = async () => {
    if (isAudioPlaying) {
      // If we're recording, stop the recording first
      if (isRecording) {
        const recording = await recorderRef.current.stop();
        setIsRecording(false);

        // Download link
        const url = URL.createObjectURL(recording);
        const link = document.createElement("a");
        link.download = "tendril-loop.wav";
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }

      // Stop playing
      setIsAudioPlaying(false);
      Tone.Transport.cancel();
      Tone.Transport.stop();

      // Reset path indices
      const resetIndices = {};
      paths.forEach((path) => {
        resetIndices[path.id] = path.path.length - 1;
      });
      setCurrentIndices(resetIndices);

      // Clear isPlaying state
      setHexes((prevHexes) =>
        prevHexes.map((hex) => ({
          ...hex,
          isPlaying: false,
        }))
      );
    } else {
      await Tone.start();
      setIsAudioPlaying(true);
    }

    onControlPress?.();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // If currently recording, stop everything
      await togglePlay();
    } else {
      // Arm the recording
      setIsRecordingArmed(!isRecordingArmed);

      // If playing, start immediately
      if (isAudioPlaying) {
        await recorderRef.current.start();
        setIsRecording(true);
        setIsRecordingArmed(false);
      }
    }

    onControlPress?.();
  };

  // -----------------------
  // Path/Branch Deletion
  // -----------------------
  const anyPathSelected = _.some(hexes, (hex) => hex.isPathSelected);
  const anyBranchSelected = _.some(hexes, (hex) => hex.isBranchSelected);

  // Reset the selected path
  const resetPath = () => {
    const selectedHex = _.find(hexes, (hex) => hex.isPathSelected);
    if (!selectedHex) return;
    const pathIdToRemove = selectedHex.pathId;

    setPaths((prevPaths) =>
      _.filter(prevPaths, (pathObj) => pathObj.id !== pathIdToRemove)
    );

    setBranches((prevBranches) =>
      _.filter(
        prevBranches,
        (branchObj) => branchObj.parentPathId !== pathIdToRemove
      )
    );

    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) =>
          hex.pathId === pathIdToRemove ||
          (hex.branchId &&
            branches.some(
              (branch) =>
                branch.id === hex.branchId &&
                branch.parentPathId === pathIdToRemove
            )),
        {
          isPathDraft: false,
          isPath: false,
          isValid: false,
          isPlaying: false,
          sampleName: null,
          effect: { type: null, name: null },
          isHidden: false,
          isPathSelected: false,
          isBranchSelected: false,
          isEffectDraft: false,
          isBranch: false,
          pathId: null,
          branchId: null,
          isHexSelected: false,
        }
      )
    );
  };

  // Delete the selected branch
  const deleteSelectedBranch = () => {
    const selectedHex = hexes.find((hex) => hex.isBranchSelected);
    if (!selectedHex) return;

    const branchIdToRemove = selectedHex.branchId;
    setBranches((prevBranches) =>
      prevBranches.filter((branchObj) => branchObj.id !== branchIdToRemove)
    );

    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) => hex.branchId === branchIdToRemove,
        {
          isPathDraft: false,
          isPath: false,
          isValid: false,
          effect: { type: null, name: null },
          isHidden: false,
          isBranchSelected: false,
          isBranch: false,
          branchId: null,
        }
      )
    );
  };

  // If a branch is selected
  const selectedBranchHex = hexes.find((hex) => hex.isBranchSelected);
  let selectedBranch = null;
  if (selectedBranchHex) {
    selectedBranch = branches.find(
      (branch) => branch.id === selectedBranchHex.branchId
    );
  }

  // The effect definition
  const selectedEffectDefinition = effectStore.find(
    (effect) => effect.name === selectedBranch?.effect.name
  );

  // -----------------------
  //  File Upload Handling
  // -----------------------
  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || file.size === 0) continue;
      if (file.size > 50 * 1024 * 1024) continue; // Arbitrary size limit

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const cleanName = file.name.replace(/\.[^/.]+$/, "");

      // Save the raw ArrayBuffer to IndexedDB
      try {
        await addUserSample({
          name: cleanName,
          data: arrayBuffer,
          note: null, // Handled via fallback in addUserSample
        });
      } catch (err) {
        console.error("Error adding sample to IndexedDB:", err);
      }
    }

    // Refresh local userSamples from DB
    const updated = await getAllUserSamples();
    setUserSamples(updated);

    // Reset the file input
    e.target.value = null;
  }

  // Remove from DB
  const handleRemoveUserSample = async (id) => {
    await removeUserSample(id);
    const updated = await getAllUserSamples();
    setUserSamples(updated);
  };

  // -----------------------
  //       Rendering
  // -----------------------
  return (
    <div className="mt-4 flex flex-col items-center space-y-4 max-w-md mx-auto">
      {/* If no path/branch config is selected, show the sample tabs & effects */}
      {!anyPathSelected &&
      !(anyBranchSelected && selectedBranch && selectedEffectDefinition) ? (
        <div className="w-full flex flex-col items-center justify-center space-y-4">
          {/* Samples Box */}
          <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
            {/* Label */}
            <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
              Samples
            </div>

            {/* Tab Buttons */}
            <div className="flex items-center justify-start px-4 py-2 space-x-4 bg-neutral-900">
              <button
                className={`text-xs px-2 py-1 border ${
                  activeSamplesTab === "default"
                    ? "bg-neutral-800 border-neutral-800"
                    : "border-neutral-800 text-neutral-400"
                }`}
                onClick={() => setActiveSamplesTab("default")}
              >
                Default
              </button>
              <button
                className={`text-xs px-2 py-1 border ${
                  activeSamplesTab === "user"
                    ? "bg-neutral-800 border-neutral-800"
                    : "border-neutral-800 text-neutral-400"
                }`}
                onClick={() => setActiveSamplesTab("user")}
              >
                User Uploaded
              </button>
            </div>

            {/* Content: default vs user samples */}
            {activeSamplesTab === "default" && (
              <div className="p-4">
                <div className="flex flex-wrap gap-3">
                  {_.map(sampleStore, (sample) => (
                    <button
                      key={sample.name}
                      onClick={() => {
                        if (selectedSample.name === sample.name) {
                          setSelectedSample({ name: null, click: 0 });
                        } else {
                          setSelectedSample({ name: sample.name, click: 1 });
                          setSelectedEffect({ type: null, name: null });
                        }
                        setHexes((prevHexes) =>
                          updateHexProperties(
                            prevHexes,
                            (hex) =>
                              hex.isPathSelected ||
                              hex.isBranchSelected ||
                              hex.isHexSelected,
                            {
                              isPathSelected: false,
                              isBranchSelected: false,
                              isHexSelected: false,
                            }
                          )
                        );
                        onControlPress?.();
                      }}
                      className={`inline-flex py-1 px-2 text-xxs border cursor-pointer ${
                        selectedSample.name === sample.name
                          ? "bg-red-800"
                          : "text-red-400"
                      }`}
                    >
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSamplesTab === "user" && (
              <div className="p-4 overflow-y-scroll h-40 space-y-4">
                {/* File Upload (multiple) */}
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleFileUpload}
                  className="block w-full text-xxs text-neutral-300 file:mr-4 file:text-xxs file:py-1 file:px-4 file:border-0 file:text-sm file:bg-neutral-800 file:text-neutral-300 file:rounded-md hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer border border-neutral-700 rounded-md"
                />

                {/* User Samples List */}
                {userSamples && userSamples.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {userSamples.map((sample) => (
                      <div key={sample.id} className="flex flex-col relative">
                        <button
                          onClick={() => {
                            if (selectedSample.name === sample.name) {
                              setSelectedSample({ name: null, click: 0 });
                            } else {
                              setSelectedSample({
                                name: sample.name,
                                click: 1,
                              });
                              setSelectedEffect({ type: null, name: null });
                            }
                            setHexes((prevHexes) =>
                              updateHexProperties(
                                prevHexes,
                                (hex) =>
                                  hex.isPathSelected ||
                                  hex.isBranchSelected ||
                                  hex.isHexSelected,
                                {
                                  isPathSelected: false,
                                  isBranchSelected: false,
                                  isHexSelected: false,
                                }
                              )
                            );
                            onControlPress?.();
                          }}
                          className={`inline-flex py-1 px-2 text-xxs border cursor-pointer ${
                            selectedSample.name === sample.name
                              ? "bg-red-800"
                              : "text-red-400"
                          }`}
                        >
                          {sample.name}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">
                    No user samples yet. Upload to get started.
                  </div>
                )}

                <hr className="border-neutral-800" />

                <div className="text-xs text-neutral-500">
                  Please note all samples are saved locally to your browser
                  storage and are not permanently uploaded.
                </div>
              </div>
            )}
          </div>

          {/* Effects Box */}
          <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
              Effects
            </div>
            <div className="p-4 space-y-4">
              {/* FX Section */}
              <div className="flex flex-wrap gap-3">
                {_.map(
                  effectStore,
                  (effect) =>
                    effect.type === "fx" && (
                      <button
                        key={effect.name}
                        disabled={!paths.length}
                        onClick={() => {
                          if (selectedEffect?.name === effect.name) {
                            setSelectedEffect(null);
                          } else {
                            setSelectedEffect({
                              type: effect.type,
                              name: effect.name,
                            });
                            setSelectedSample({ name: null, click: 0 });
                          }
                          setHexes((prevHexes) =>
                            updateHexProperties(
                              prevHexes,
                              (hex) =>
                                hex.isPathSelected ||
                                hex.isBranchSelected ||
                                hex.isHexSelected,
                              {
                                isPathSelected: false,
                                isBranchSelected: false,
                                isHexSelected: false,
                              }
                            )
                          );
                          onControlPress?.();
                        }}
                        className={`inline-flex py-1 px-2 text-xxs border cursor-pointer ${
                          selectedEffect?.name === effect.name
                            ? "bg-neutral-300 text-black"
                            : "text-neutral-300"
                        } ${!paths.length ? "opacity-50" : ""}`}
                      >
                        {effect.name}
                      </button>
                    )
                )}
              </div>

              {/* Utility Effects Section */}
              <div className="flex flex-wrap gap-3">
                {_.map(
                  effectStore,
                  (effect) =>
                    effect.type === "utility" && (
                      <button
                        key={effect.name}
                        disabled={!paths.length}
                        onClick={() => {
                          if (selectedEffect?.name === effect.name) {
                            setSelectedEffect(null);
                          } else {
                            setSelectedEffect({
                              type: effect.type,
                              name: effect.name,
                            });
                            setSelectedSample({ name: null, click: 0 });
                          }
                          setHexes((prevHexes) =>
                            updateHexProperties(
                              prevHexes,
                              (hex) =>
                                hex.isPathSelected ||
                                hex.isBranchSelected ||
                                hex.isHexSelected,
                              {
                                isPathSelected: false,
                                isBranchSelected: false,
                                isHexSelected: false,
                              }
                            )
                          );
                          onControlPress?.();
                        }}
                        className={`inline-flex py-1 px-2 text-xxs border cursor-pointer ${
                          selectedEffect?.name === effect.name
                            ? "bg-blue-800"
                            : "text-blue-400"
                        } ${!paths.length ? "opacity-50" : ""}`}
                      >
                        {effect.name}
                      </button>
                    )
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Path/Branch Config UI */}
      {anyPathSelected ||
      (anyBranchSelected && selectedBranch && selectedEffectDefinition) ? (
        <div className="w-full flex flex-col items-center justify-center">
          {/* Path Config Box */}
          {anyPathSelected && (
            <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                Path Config
              </div>
              <div className="p-4">
                <p className="text-sm mb-4 text-white">
                  Configure the selected path here.
                </p>
                <button
                  onClick={resetPath}
                  className="text-red-600 cursor-pointer"
                >
                  Delete Path
                </button>
              </div>
            </div>
          )}

          {/* Branch Config Box */}
          {anyBranchSelected && selectedBranch && selectedEffectDefinition && (
            <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                Branch Config
              </div>
              <div className="p-4">
                <p className="text-sm mb-4 text-white">
                  Configure the selected branch here.
                </p>
                {/* Render controls for effect config */}
                <div className="flex flex-wrap gap-3">
                  {Object.keys(selectedBranch.effectConfig).map((paramName) => {
                    const param = selectedBranch.effectConfig[paramName];
                    const effectParam =
                      selectedEffectDefinition.config[paramName];

                    if (effectParam.options) {
                      return (
                        <div key={paramName} className="mb-2">
                          <label className="block text-sm font-medium mb-1 text-white">
                            {paramName}
                          </label>
                          <select
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
                            value={param.value}
                            onChange={(e) => {
                              setBranches((prevBranches) =>
                                prevBranches.map((branch) => {
                                  if (branch.id === selectedBranch.id) {
                                    return {
                                      ...branch,
                                      effectConfig: {
                                        ...branch.effectConfig,
                                        [paramName]: {
                                          ...param,
                                          value: e.target.value,
                                        },
                                      },
                                    };
                                  }
                                  return branch;
                                })
                              );
                            }}
                          >
                            {effectParam.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    } else if (typeof param.value === "number") {
                      return (
                        <div key={paramName} className="mb-2">
                          <label className="block text-sm font-medium mb-1 text-white">
                            {paramName}
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={effectParam.max || 1}
                            step={effectParam.step || 0.01}
                            value={param.value}
                            onChange={(e) => {
                              setBranches((prevBranches) =>
                                prevBranches.map((branch) => {
                                  if (branch.id === selectedBranch.id) {
                                    return {
                                      ...branch,
                                      effectConfig: {
                                        ...branch.effectConfig,
                                        [paramName]: {
                                          ...param,
                                          value: parseFloat(e.target.value),
                                        },
                                      },
                                    };
                                  }
                                  return branch;
                                })
                              );
                            }}
                          />
                          <span className="ml-2 text-sm text-white">
                            {param.value}
                          </span>
                        </div>
                      );
                    } else if (typeof param.value === "string") {
                      return (
                        <div key={paramName} className="mb-2">
                          <label className="block text-sm font-medium mb-1 text-white">
                            {paramName}
                          </label>
                          <input
                            type="text"
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white"
                            value={param.value}
                            onChange={(e) => {
                              setBranches((prevBranches) =>
                                prevBranches.map((branch) => {
                                  if (branch.id === selectedBranch.id) {
                                    return {
                                      ...branch,
                                      effectConfig: {
                                        ...branch.effectConfig,
                                        [paramName]: {
                                          ...param,
                                          value: e.target.value,
                                        },
                                      },
                                    };
                                  }
                                  return branch;
                                })
                              );
                            }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                <span
                  onClick={deleteSelectedBranch}
                  className="text-red-600 mt-4 cursor-pointer"
                >
                  Delete Branch
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Controls Box (Play, BPM, Record) */}
      <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
          Controls
        </div>
        <div className="p-4">
          <div className="w-full flex flex-col items-center justify-center">
            <div className="flex space-x-4">
              <button
                onClick={togglePlay}
                disabled={!paths.length}
                className={`px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none flex items-center gap-2  ${
                  !paths.length ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isAudioPlaying ? <FaStop size={20} /> : <FaPlay size={20} />}
                {isAudioPlaying ? "Stop" : "Play"}
              </button>

              <input
                className="bg-transparent border border-white text-white px-2 rounded"
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min="40"
                max="240"
              />

              <button
                onClick={toggleRecording}
                disabled={
                  (isAudioPlaying && !isRecordingArmed && !isRecording) ||
                  !paths.length
                }
                className={`px-4 py-2 bg-transparent border rounded focus:outline-none flex items-center gap-2 
                  ${
                    isRecording
                      ? "border-red-500 text-red-500"
                      : isRecordingArmed
                      ? "border-orange-500 text-orange-500"
                      : "border-white text-white"
                  }
                  ${
                    isAudioPlaying && !isRecordingArmed && !isRecording
                      ? "opacity-50 cursor-not-allowed"
                      : "opacity-100 cursor-pointer"
                  }
                   ${!paths.length ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {isRecording ? (
                  <FaMicrophoneSlash size={20} />
                ) : (
                  <FaMicrophone size={20} />
                )}
                {isRecording ? "Stop" : "Record"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
