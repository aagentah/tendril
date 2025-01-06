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
  FaBars,
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
  effectStore,
  effectDraftPathAtom,
  draftPathAtom,
  dragPreviewAtom,
} from "./App";
import { updateHexProperties } from "./hexUtils";

const Controls = ({ onControlPress }) => {
  const [isAudioPlaying, setIsAudioPlaying] = useAtom(isAudioPlayingAtom);
  const [selectedSample, setSelectedSample] = useAtom(selectedSampleAtom);
  const [bpm, setBpm] = useAtom(bpmAtom);
  const [hexes, setHexes] = useAtom(hexesAtom);
  const [paths, setPaths] = useAtom(pathsAtom);
  const [branches, setBranches] = useAtom(branchesAtom);
  const [, setEffectDraftPath] = useAtom(effectDraftPathAtom);
  const [, setDraftPath] = useAtom(draftPathAtom);
  const [selectedEffect, setSelectedEffect] = useAtom(selectedEffectAtom);
  const [currentIndices, setCurrentIndices] = useAtom(currentIndicesAtom);
  const [dragPreview, setDragPreview] = useAtom(dragPreviewAtom);

  // userSamples & tab state
  const [userSamples, setUserSamples] = useAtom(userSamplesAtom);
  const [activeSamplesTab, setActiveSamplesTab] = useState("default");

  // Recorder
  const recorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingArmed, setIsRecordingArmed] = useState(false);

  // Library toggle
  const [showLibrary, setShowLibrary] = useState(false);

  // Library loading indicator
  const [libraryLoading, setLibraryLoading] = useState(false);

  // ------------------------------------------------
  // Lifecycle / Setup
  // ------------------------------------------------

  useEffect(() => {
    const handleGlobalUp = () => {
      setDragPreview({ show: false, x: 0, y: 0 });
    };

    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [setDragPreview]);

  useEffect(() => {
    const handleMove = (e) => {
      if (dragPreview.show) {
        const coords = e.type === "touchmove" ? e.touches[0] : e;
        setDragPreview((prev) => ({
          ...prev,
          x: coords.clientX,
          y: coords.clientY,
        }));
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
    };
  }, [dragPreview.show, setDragPreview]);

  useEffect(() => {
    getAllUserSamples().then((samples) => {
      setUserSamples(samples);
    });
  }, [setUserSamples]);

  useEffect(() => {
    recorderRef.current = new Tone.Recorder();
    Tone.getDestination().connect(recorderRef.current);

    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose();
      }
    };
  }, []);

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

  // ------------------------------------------------
  // Helpers for JSON I/O
  // ------------------------------------------------

  /**
   * Encodes an ArrayBuffer to a base64 string.
   */
  function encodeArrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Decodes a base64 string to an ArrayBuffer.
   */
  function decodeBase64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Applies loaded JSON state to the current Jotai stores.
   */
  function loadStateFromObject(loadedState) {
    if (isAudioPlaying) {
      togglePlay();
    }

    // Reconstruct user samples
    const reconstructedSamples = [];
    for (const s of loadedState.userSamples || []) {
      if (s.base64) {
        const arrayBuffer = decodeBase64ToArrayBuffer(s.base64);
        reconstructedSamples.push({
          id: s.id,
          name: s.name,
          // Remove note: s.note,
          data: arrayBuffer,
          url: URL.createObjectURL(
            new Blob([arrayBuffer], { type: "audio/*" })
          ),
        });
      } else {
        reconstructedSamples.push(s);
      }
    }

    // Update atoms with loaded state
    setBpm(loadedState.bpm);
    setHexes(loadedState.hexes);
    setPaths(loadedState.paths);
    setBranches(loadedState.branches);
    setUserSamples(reconstructedSamples);

    // Clear selectedEffect
    setSelectedEffect({ type: null, name: null });

    // Clear effectDraftPath
    setEffectDraftPath([]);

    // Clear draftPath
    setDraftPath([]);

    // Deselect all hexes by clearing selection-related properties
    setHexes((prevHexes) =>
      updateHexProperties(prevHexes, () => true, {
        isHexSelected: false,
        isPathSelected: false,
        isBranchSelected: false,
        isPathDraft: false,
        isEffectDraft: false,
      })
    );
  }

  /**
   * Loads state from local file input (existing functionality).
   */
  const handleLoad = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const loadedState = JSON.parse(event.target.result);
        loadStateFromObject(loadedState);

        // Clean up file input
        e.target.value = null;
      } catch (err) {
        console.error("Error parsing or loading JSON state:", err);
      }
    };
    reader.readAsText(file);

    onControlPress?.();
  };

  /**
   * Loads state from a given URL (our "Library" functionality).
   */
  async function handleLibraryLoad(url) {
    setLibraryLoading(true);
    try {
      const response = await fetch(url);
      const loadedState = await response.json();
      loadStateFromObject(loadedState);
      setShowLibrary(false);
    } catch (err) {
      console.error("Error fetching or loading JSON state from URL:", err);
    } finally {
      setLibraryLoading(false);
    }
  }

  // ------------------------------------------------
  // Save / Load (Manual)
  // ------------------------------------------------
  const handleSave = () => {
    // Convert userSamples data into base64
    const userSamplesData = userSamples.map((sample) => {
      const base64 = sample.data
        ? encodeArrayBufferToBase64(sample.data)
        : null;
      return {
        id: sample.id,
        name: sample.name,
        // Remove note: sample.note,
        base64,
      };
    });

    const stateToSave = {
      bpm,
      hexes,
      paths,
      branches,
      userSamples: userSamplesData,
    };

    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "tendril-sequencer-state.json";
    link.click();

    URL.revokeObjectURL(url);
    onControlPress?.();
  };

  // ------------------------------------------------
  // Main Playback Logic
  // ------------------------------------------------
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

      // If already playing, start recording immediately
      if (isAudioPlaying) {
        await recorderRef.current.start();
        setIsRecording(true);
        setIsRecordingArmed(false);
      }
    }

    onControlPress?.();
  };

  // ------------------------------------------------
  // Path/Branch Deletion
  // ------------------------------------------------
  const anyPathSelected = _.some(hexes, (hex) => hex.isPathSelected);
  const anyBranchSelected = _.some(hexes, (hex) => hex.isBranchSelected);

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

  const selectedBranchHex = hexes.find((hex) => hex.isBranchSelected);
  let selectedBranch = null;
  if (selectedBranchHex) {
    selectedBranch = branches.find(
      (branch) => branch.id === selectedBranchHex.branchId
    );
  }

  const selectedEffectDefinition = effectStore.find(
    (effect) => effect.name === selectedBranch?.effect.name
  );

  // ------------------------------------------------
  // File Upload Handling
  // ------------------------------------------------
  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || file.size === 0) continue;
      if (file.size > 50 * 1024 * 1024) continue; // Size limit check

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const cleanName = file.name.replace(/\.[^/.]+$/, "");

      try {
        await addUserSample({
          name: cleanName,
          data: arrayBuffer,
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

  const handleRemoveUserSample = async (id) => {
    await removeUserSample(id);
    const updated = await getAllUserSamples();
    setUserSamples(updated);
  };

  // ------------------------------------------------
  // PREVIEW LOGIC
  // ------------------------------------------------
  async function previewSample(url) {
    try {
      await Tone.start(); // ensure audio context is unmuted
      const player = new Tone.Player().toDestination();
      // Wait for the buffer to load before starting
      await player.load(url);

      player.start();
      player.stop("+2"); // stop after 2 seconds or as you prefer
    } catch (error) {
      console.error("Error loading/playing sample preview:", error);
    }
  }

  // ------------------------------------------------
  // Event Handlers for Samples and Effects
  // ------------------------------------------------

  /**
   * Handles the selection and deselection of a sample.
   * @param {Object} sample - The sample object.
   */
  const handleSampleSelection = async (sample) => {
    // If user clicks same sample again, deselect it
    if (selectedSample.name === sample.name) {
      setSelectedSample({ name: null, click: 0 });
    } else {
      // Otherwise, select new sample and preview
      setSelectedSample({
        name: sample.name,
        click: 1,
      });
      setSelectedEffect({ type: null, name: null });

      await previewSample(sample.url);
    }

    // Clear path/branch/hex selection
    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) =>
          hex.isPathSelected || hex.isBranchSelected || hex.isHexSelected,
        {
          isPathSelected: false,
          isBranchSelected: false,
          isHexSelected: false,
        }
      )
    );
    onControlPress?.();
  };

  /**
   * Handles the mouse down and touch start event for samples.
   * @param {Object} sample - The sample object.
   */
  const handleSampleDragStart = (sample, clientX, clientY) => {
    handleSampleMouseDown(sample)();
    setDragPreview({
      show: true,
      x: clientX,
      y: clientY,
    });
  };

  /**
   * Handles the mouse up and touch end event for samples.
   * @param {Object} sample - The sample object.
   */
  const handleSampleDragEnd = (sample) => {
    handleSampleMouseUp(sample)();
  };

  /**
   * Handles the mouse down and touch start event for effects.
   * @param {Object} effect - The effect object.
   */
  const handleEffectDragStart = (effect, clientX, clientY) => {
    handleEffectMouseDown(effect)();
    setDragPreview({
      show: true,
      x: clientX,
      y: clientY,
    });
  };

  /**
   * Handles the mouse up and touch end event for effects.
   * @param {Object} effect - The effect object.
   */
  const handleEffectDragEnd = (effect) => {
    handleEffectMouseUp(effect)();
  };

  /**
   * Handles the mouse down event for samples.
   * @param {Object} sample - The sample object.
   */
  const handleSampleMouseDown = (sample) => async () => {
    await handleSampleSelection(sample);
  };

  /**
   * Handles the mouse up event for samples.
   * @param {Object} sample - The sample object.
   */
  const handleSampleMouseUp = (sample) => async () => {
    // If user clicks same sample again, deselect it
    if (selectedSample.name === sample.name) {
      setSelectedSample({ name: null, click: 0 });
    } else {
      // Otherwise, select new sample and preview
      setSelectedSample({
        name: sample.name,
        click: 2,
      });
      setSelectedEffect({ type: null, name: null });

      // Optionally, you can preview the sample on mouse up as well
      // await previewSample(sample.url);
    }

    // Clear path/branch/hex selection
    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) =>
          hex.isPathSelected || hex.isBranchSelected || hex.isHexSelected,
        {
          isPathSelected: false,
          isBranchSelected: false,
          isHexSelected: false,
        }
      )
    );
    onControlPress?.();
  };

  /**
   * Handles the selection and deselection of an effect.
   * @param {Object} effect - The effect object.
   */
  const handleEffectSelection = (effect) => () => {
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
          hex.isPathSelected || hex.isBranchSelected || hex.isHexSelected,
        {
          isPathSelected: false,
          isBranchSelected: false,
          isHexSelected: false,
        }
      )
    );
    onControlPress?.();
  };

  /**
   * Handles the mouse down event for effects.
   * @param {Object} effect - The effect object.
   */
  const handleEffectMouseDown = (effect) => () => {
    handleEffectSelection(effect)();
  };

  /**
   * Handles the mouse up event for effects.
   * @param {Object} effect - The effect object.
   */
  const handleEffectMouseUp = (effect) => () => {
    handleEffectSelection(effect)();
  };

  // ------------------------------------------------
  // Rendering
  // ------------------------------------------------

  // Two pre-made library JSONs
  const libraryFiles = [{ label: "aagentah.json", url: "/json/aagentah.json" }];

  return (
    <div className="mt-4 flex flex-col items-center space-y-4 max-w-md mx-auto">
      {/* Show either the main Samples/Effects UI OR the Library Panel */}
      {!showLibrary ? (
        <>
          {/* If no path/branch config is selected, show the sample tabs & effects */}
          {!anyPathSelected &&
          !(anyBranchSelected && selectedBranch && selectedEffectDefinition) ? (
            <div className="w-full flex flex-col items-center justify-center space-y-4">
              {/* Samples Box */}
              <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                  Samples
                </div>

                {/* Tab Buttons */}
                <div className="flex items-center justify-start p-4 pb-0 space-x-4 bg-neutral-900">
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
                          onMouseDown={(e) => {
                            handleSampleDragStart(sample, e.clientX, e.clientY);
                          }}
                          onMouseUp={() => handleSampleDragEnd(sample)}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            handleSampleDragStart(
                              sample,
                              touch.clientX,
                              touch.clientY
                            );
                          }}
                          onTouchEnd={() => handleSampleDragEnd(sample)}
                          className={`inline-flex py-1 px-2 text-xs border cursor-grab items-center ${
                            selectedSample.name === sample.name
                              ? "bg-red-800"
                              : "text-red-400"
                          }`}
                        >
                          <span className="text-white mr-2">
                            <FaBars size={8} />
                          </span>
                          {sample.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeSamplesTab === "user" && (
                  <div className="p-4 overflow-y-scroll h-40 space-y-4">
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-neutral-300 file:mr-4 file:text-xs file:py-1 file:px-4 file:border-0 file:text-sm file:bg-neutral-800 file:text-neutral-300 file:rounded-md hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer border border-neutral-700 rounded-md"
                    />

                    {userSamples && userSamples.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {userSamples.map((sample) => (
                          <div
                            key={sample.id}
                            className="flex flex-col relative"
                          >
                            <button
                              onMouseDown={(e) => {
                                handleSampleDragStart(
                                  sample,
                                  e.clientX,
                                  e.clientY
                                );
                              }}
                              onMouseUp={() => handleSampleDragEnd(sample)}
                              onTouchStart={(e) => {
                                const touch = e.touches[0];
                                handleSampleDragStart(
                                  sample,
                                  touch.clientX,
                                  touch.clientY
                                );
                              }}
                              onTouchEnd={() => handleSampleDragEnd(sample)}
                              className={`inline-flex py-1 px-2 text-xs border cursor-pointer items-center ${
                                selectedSample.name === sample.name
                                  ? "bg-red-800"
                                  : "text-red-400"
                              }`}
                            >
                              <span className="text-white mr-2">
                                <FaBars size={8} />
                              </span>
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
                      Your uploaded samples are temporarily stored in your
                      browser and will be cleared when you close the session. If
                      you decide to "Save" your session, the samples will be
                      included in the downloaded .json file.
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
                            onMouseDown={(e) => {
                              handleEffectDragStart(
                                effect,
                                e.clientX,
                                e.clientY
                              );
                            }}
                            onMouseUp={() => handleEffectDragEnd(effect)}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              handleEffectDragStart(
                                effect,
                                touch.clientX,
                                touch.clientY
                              );
                            }}
                            onTouchEnd={() => handleEffectDragEnd(effect)}
                            className={`inline-flex py-1 px-2 text-xs border cursor-pointer items-center ${
                              selectedEffect?.name === effect.name
                                ? "bg-neutral-300 text-black"
                                : "text-neutral-300"
                            } ${!paths.length ? "opacity-50" : ""}`}
                          >
                            <span className="text-white mr-2">
                              <FaBars size={8} />
                            </span>
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
                            onMouseDown={(e) => {
                              handleEffectDragStart(
                                effect,
                                e.clientX,
                                e.clientY
                              );
                            }}
                            onMouseUp={() => handleEffectDragEnd(effect)}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              handleEffectDragStart(
                                effect,
                                touch.clientX,
                                touch.clientY
                              );
                            }}
                            onTouchEnd={() => handleEffectDragEnd(effect)}
                            className={`inline-flex py-1 px-2 text-xs border cursor-pointer items-center ${
                              selectedEffect?.name === effect.name
                                ? "bg-blue-800"
                                : "text-blue-400"
                            } ${!paths.length ? "opacity-50" : ""}`}
                          >
                            <span className="text-white mr-2">
                              <FaBars size={8} />
                            </span>
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
          {(anyPathSelected ||
            (anyBranchSelected &&
              selectedBranch &&
              selectedEffectDefinition)) && (
            <div className="w-full flex flex-col items-center justify-center">
              {/* Path Config */}
              {anyPathSelected && (
                <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                    Path Config
                  </div>
                  <div className="p-4">
                    <button
                      onClick={resetPath}
                      className="text-red-600 cursor-pointer"
                    >
                      Delete Path
                    </button>
                  </div>
                </div>
              )}

              {/* Branch Config */}
              {anyBranchSelected &&
                selectedBranch &&
                selectedEffectDefinition && (
                  <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
                    <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                      Branch Config
                    </div>
                    <div className="p-4">
                      <p className="text-sm mb-4 text-white">
                        {selectedEffectDefinition.name}
                      </p>

                      <div className="flex flex-wrap gap-3">
                        {Object.keys(selectedBranch.effectConfig).map(
                          (paramName) => {
                            const param =
                              selectedBranch.effectConfig[paramName];
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
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
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
                                    min={effectParam.min || 0}
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
                                                  value: parseFloat(
                                                    Number.isInteger(
                                                      param.value
                                                    )
                                                      ? Math.round(
                                                          e.target.value
                                                        )
                                                      : e.target.value
                                                  ),
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
                          }
                        )}
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
          )}

          {/* Controls Box (Play, BPM, Record, Save/Load) */}
          <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
              Controls
            </div>
            <div className="p-4">
              <div className="w-full flex flex-col items-center justify-center space-y-4">
                <div className="flex flex-wrap sm:flex-nowrap justify-start md:justify-center gap-4 md:gap-2 text-sm">
                  <button
                    onClick={togglePlay}
                    disabled={!paths.length}
                    className={`px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none flex items-center gap-2 ${
                      !paths.length ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isAudioPlaying ? (
                      <FaStop size={12} />
                    ) : (
                      <FaPlay size={12} />
                    )}
                    {isAudioPlaying ? "Stop" : "Play"}
                  </button>

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
                      <FaMicrophoneSlash size={12} />
                    ) : (
                      <FaMicrophone size={12} />
                    )}
                    {isRecording ? "Stop" : "Rec"}
                  </button>

                  <button
                    disabled={!paths.length}
                    onClick={handleSave}
                    className={`px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none  ${
                      !paths.length ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Save
                  </button>

                  <label
                    htmlFor="loadState"
                    className="cursor-pointer px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none"
                  >
                    Load
                    <input
                      id="loadState"
                      type="file"
                      accept=".json"
                      onChange={handleLoad}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center justify-center gap-x-4 relative h-[38px]">
                    <input
                      className="bg-transparent border border-white text-white px-4 rounded h-full w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number"
                      value={bpm}
                      onChange={(e) =>
                        setBpm(Math.min(parseInt(e.target.value) || 40, 999))
                      }
                      min="40"
                      max="999"
                    />
                    <div className="absolute text-xs text-neutral-500 right-4 mt-0.5 pointer-events-none">
                      BPM
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* "Pre-load sequences made by others" Label */}
          <div className="w-full mt-4 flex justify-center items-center">
            <div
              className="text-neutral-500 underline text-sm cursor-pointer"
              onClick={() => setShowLibrary(true)}
            >
              Pre-load sequences made by others.
            </div>
          </div>
        </>
      ) : (
        // -----------------------
        //   Library Panel
        // -----------------------
        <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
            Library
          </div>
          <div className="p-4">
            <p className="text-sm mb-4 text-white">
              Select a shared track to load:
            </p>
            {/* Loading Indicator */}

            <div className="flex flex-col gap-3">
              {libraryFiles.map((file) => (
                <button
                  key={file.url}
                  className="text-neutral-500 underline text-left"
                  onClick={() => handleLibraryLoad(file.url)}
                >
                  {file.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-end h-8">
              {libraryLoading ? (
                <div className="flex items-center gap-2 text-sm text-white">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>Loading...</span>
                </div>
              ) : (
                <button
                  className="px-3 py-1 border border-neutral-600 text-neutral-300 text-sm"
                  onClick={() => setShowLibrary(false)}
                >
                  Back
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {dragPreview.show && (
        <div
          className="fixed size-4 bg-white rounded-full pointer-events-none"
          style={{
            left: dragPreview.x - 10,
            top: dragPreview.y - 26,
          }}
        />
      )}
    </div>
  );
};

export default Controls;
