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
  deviceTypeAtom,
} from "./App";
import { updateHexProperties } from "./hexUtils";

/**
 * This is a subcomponent for toggling the configuration panel on mobile
 * and for the floating play/stop bar at the bottom on mobile devices.
 */
const MobileControlsBar = ({
  isAudioPlaying,
  handlePlayToggle,
  isConfigOpen,
  setIsConfigOpen,
  showLibrary,
  setShowLibrary,
}) => {
  const [bpm, setBpm] = useAtom(bpmAtom);
  const [paths] = useAtom(pathsAtom);

  return (
    <div className="fixed bottom-8 left-0 right-0 p-4">
      <div className="flex justify-center items-center gap-2 lg:hidden text-xs">
        <button
          onClick={handlePlayToggle}
          disabled={!paths.length}
          className={`px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none flex items-center justify-center gap-2 ${
            !paths.length ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isAudioPlaying ? <FaStop size={12} /> : <FaPlay size={12} />}
          {isAudioPlaying ? "Stop" : "Play"}
        </button>

        <button
          onClick={() => {
            if (paths.length) {
              setIsConfigOpen(true);
              setShowLibrary(false);
            }
          }}
          className={`px-4 py-2 bg-transparent border border-white text-white rounded focus:outline-none min-w-[80px] ${
            !paths.length ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Samples & FX
        </button>

        <div className="flex items-center justify-center gap-x-4 relative h-[34px] min-w-[100px]">
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

      <div className="w-full mt-4 flex justify-center items-center">
        <div
          className="text-neutral-500 underline text-sm cursor-pointer"
          onClick={() => {
            setShowLibrary(true);
            setIsConfigOpen(true);
          }}
        >
          Pre-load sequences made by others.
        </div>
      </div>
    </div>
  );
};

/**
 * This is the sliding/fixed panel for mobile to display the same config
 * (sample selection, effect selection, etc.) that you see on desktop.
 */
const MobileConfigPanel = ({ children, isOpen, setIsOpen }) => {
  const onCloseRef = useRef(null);

  useEffect(() => {
    if (onCloseRef) {
      onCloseRef.current = () => setIsOpen(false);
    }
  }, [setIsOpen]);

  return (
    <>
      {/* Desktop (hidden) */}
      <div className="hidden lg:block w-full relative max-w-lg mx-auto">
        {children}
      </div>

      {/* Mobile view */}
      <div className="block lg:hidden">
        <div
          className={`h-3/4 bottom-0 fixed inset-x-0 bg-neutral-900 z-40 transition-transform duration-300 ease-in-out border-t border-t-neutral-500 rounded-t-xl ${
            isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="h-full relative overflow-y-auto px-4 pt-12 lg:pt-16 pb-8">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-4 z-50 p-2 text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="13.5" y1="4.5" x2="4.5" y2="13.5"></line>
                <line x1="4.5" y1="4.5" x2="13.5" y2="13.5"></line>
              </svg>
            </button>
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

const Controls = () => {
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
  const [deviceType] = useAtom(deviceTypeAtom);
  const [isAudioPlaying, setIsAudioPlaying] = useAtom(isAudioPlayingAtom);

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

  // **Now we manage the mobile config panel open state here:**
  const [isConfigOpen, setIsConfigOpen] = useState(false);

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
      handlePlayToggle();
    }

    // Reconstruct user samples
    const reconstructedSamples = [];
    for (const s of loadedState.userSamples || []) {
      if (s.base64) {
        const arrayBuffer = decodeBase64ToArrayBuffer(s.base64);
        reconstructedSamples.push({
          id: s.id,
          name: s.name,
          // Remove note if you wish, or keep if you track pitch
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

    // Deselect all hexes
    setHexes((prevHexes) =>
      updateHexProperties(prevHexes, () => true, {
        isHexSelected: false,
        isPathSelected: false,
        isBranchSelected: false,
        isEffectDraft: false,
      })
    );
  }

  /**
   * Loads state from local file input.
   */
  const handleLoad = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const loadedState = JSON.parse(event.target.result);
        loadStateFromObject(loadedState);
        e.target.value = null;
      } catch (err) {
        console.error("Error parsing or loading JSON state:", err);
      }
    };
    reader.readAsText(file);
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
  };

  // ------------------------------------------------
  // Main Playback Logic
  // ------------------------------------------------
  const toggleSolo = (pathId) => {
    setPaths((prevPaths) =>
      prevPaths.map((p) => {
        if (p.id === pathId) {
          // If turning on solo, ensure bypass is off
          if (!p.solo) {
            return { ...p, solo: true, bypass: false };
          } else {
            return { ...p, solo: false };
          }
        }
        return p;
      })
    );
  };

  const toggleBypass = (pathId) => {
    setPaths((prevPaths) =>
      prevPaths.map((p) => {
        if (p.id === pathId) {
          // If turning on bypass, ensure solo is off
          if (!p.bypass) {
            return { ...p, bypass: true, solo: false };
          } else {
            return { ...p, bypass: false };
          }
        }
        return p;
      })
    );
  };

  const [anyPathSelected, setAnyPathSelected] = useState(false);
  const [anyBranchSelected, setAnyBranchSelected] = useState(false);

  useEffect(() => {
    setAnyPathSelected(_.some(hexes, (hex) => hex.isPathSelected));
    setAnyBranchSelected(_.some(hexes, (hex) => hex.isBranchSelected));
  }, [hexes]);

  // Replace your existing toggleRecording function with this:
  const toggleRecording = async () => {
    if (isRecording) {
      // If currently recording, stop everything
      await handlePlayToggle();
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
  };

  // ------------------------------------------------
  // Path/Branch Deletion
  // ------------------------------------------------
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

  let previewPlayer = null;

  /**
   * Handles sample preview playback with proper cleanup
   * @param {string} url - URL of the sample to preview
   */
  const previewSample = async (url) => {
    try {
      // Cleanup any existing preview
      if (previewPlayer) {
        previewPlayer.stop();
        previewPlayer.dispose();
      }

      // Initialize audio context if needed
      await Tone.start();

      // Create new player
      previewPlayer = new Tone.Player({
        url,
        autostart: true,
        onload: () => {
          previewPlayer.start();
        },
      }).toDestination();

      // Auto-cleanup after 2 seconds
      previewPlayer.stop("+2");
      setTimeout(() => {
        if (previewPlayer) {
          previewPlayer.dispose();
          previewPlayer = null;
        }
      }, 2100);
    } catch (error) {
      console.error("Error previewing sample:", error);
      if (previewPlayer) {
        previewPlayer.dispose();
        previewPlayer = null;
      }
    }
  };

  // ------------------------------------------------
  // Event Handlers for Samples and Effects
  // ------------------------------------------------
  const handleSampleClick = async (sample) => {
    console.log("Sample clicked:", sample.name);
    if (sample.url) {
      await previewSample(sample.url);
    }
    if (selectedSample?.name === sample.name) {
      setSelectedSample({ name: null });
    } else {
      setSelectedSample({ name: sample.name });
      setSelectedEffect({ type: null, name: null });
    }

    setIsConfigOpen(false);
  };

  const handleEffectClick = (effect) => {
    console.log("Effect clicked:", effect.name);
    if (selectedEffect?.name === effect.name) {
      setSelectedEffect({ type: null, name: null });
    } else {
      setSelectedEffect({ type: effect.type, name: effect.name });
      setSelectedSample({ name: null });
    }

    setIsConfigOpen(false);
  };

  const handleSampleDragStart = (sample, clientX, clientY) => {
    handleSampleMouseDown(sample)();
    setDragPreview({
      show: true,
      x: clientX,
      y: clientY,
    });
  };

  const handleSampleDragEnd = (sample) => {
    handleSampleMouseUp(sample)();
  };

  const handleEffectDragStart = (effect, clientX, clientY) => {
    handleEffectMouseDown(effect)();
    setDragPreview({
      show: true,
      x: clientX,
      y: clientY,
    });
  };

  const handleEffectDragEnd = (effect) => {
    handleEffectMouseUp(effect)();
  };

  const handleSampleMouseDown = (sample) => async () => {
    // optionally handle selection logic
  };

  const handleSampleMouseUp = (sample) => async () => {
    if (selectedSample.name === sample.name) {
      setSelectedSample({ name: null, click: 0 });
    } else {
      setSelectedSample({
        name: sample.name,
        click: 2,
      });
      setSelectedEffect({ type: null, name: null });
    }
    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) =>
          hex.isPathSelected || hex.isBranchSelected || hex.isHexSelected,
        { isPathSelected: false, isBranchSelected: false, isHexSelected: false }
      )
    );

    setIsConfigOpen(false);
  };

  const handleEffectSelection = (effect) => () => {
    if (selectedEffect?.name === effect.name) {
      setSelectedEffect(null);
    } else {
      setSelectedEffect({ type: effect.type, name: effect.name });
      setSelectedSample({ name: null, click: 0 });
    }
    setHexes((prevHexes) =>
      updateHexProperties(
        prevHexes,
        (hex) =>
          hex.isPathSelected || hex.isBranchSelected || hex.isHexSelected,
        { isPathSelected: false, isBranchSelected: false, isHexSelected: false }
      )
    );

    setIsConfigOpen(false);
  };

  const handleEffectMouseDown = (effect) => () => {
    handleEffectSelection(effect)();
  };

  const handleEffectMouseUp = (effect) => () => {
    handleEffectSelection(effect)();
  };

  const handleSetShowLibrary = (bool) => {
    setShowLibrary(bool);
  };

  // ------------------------------------------------
  // Render
  // ------------------------------------------------

  // Some library JSONs
  const libraryFiles = [{ label: "aagentah.json", url: "/json/aagentah.json" }];

  // 2. Replace the handlePlayToggle function with this version
  // Replace your existing togglePlay function with this:
  const handlePlayToggle = async () => {
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

    setSelectedEffect({ type: null, name: null });
    setSelectedSample({ name: null });

    setIsConfigOpen(false);
  };

  return (
    <>
      {/* 
          The mobile-floating bar at the bottom 
          (only visible on small devices) 
      */}
      {deviceType.isSmallDevice && (
        <MobileControlsBar
          isAudioPlaying={isAudioPlaying}
          handlePlayToggle={handlePlayToggle}
          isConfigOpen={isConfigOpen}
          setIsConfigOpen={setIsConfigOpen}
          showLibrary={showLibrary}
          setShowLibrary={handleSetShowLibrary}
        />
      )}

      {/*
        The panel that slides up on mobile, 
        or is just visible on desktop
      */}
      <MobileConfigPanel isOpen={isConfigOpen} setIsOpen={setIsConfigOpen}>
        <div className="hidden lg:block text-lg my-4 text-center">
          <h1 className="text-lg mb-2 text-center mx-auto">tendril</h1>
          <p className="text-center text-sm text-neutral-500">
            Made by{" "}
            <a
              className="text-neutral-500 underline"
              href="https://daniel.aagentah.tech/"
              target="_blank"
              rel="noreferrer"
            >
              daniel.aagentah
            </a>
          </p>
        </div>

        {/* If we do NOT have a selected path or branch config open, show the main Samples/FX UI */}
        {!anyPathSelected &&
        !showLibrary &&
        !(anyBranchSelected && selectedBranch && selectedEffectDefinition) ? (
          <div className="w-full flex flex-col items-center justify-center space-y-4">
            {/* Samples Box */}
            <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                Samples
              </div>

              {/* Tab Buttons */}
              <div className="flex items-center justify-start p-4 space-x-4 bg-neutral-900">
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

              {/* Default vs User samples */}
              {activeSamplesTab === "default" && (
                <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-3">
                    {sampleStore.map((sample) => (
                      <button
                        key={sample.name}
                        onClick={() => handleSampleClick(sample)}
                        type="button"
                        disabled={!paths.length}
                        className={`px-2 py-1 text-xs border ${
                          selectedSample?.name === sample.name
                            ? "bg-red-800 text-white"
                            : "text-red-400"
                        } ${!paths.length ? "opacity-50" : ""}`}
                      >
                        {sample.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeSamplesTab === "user" && (
                <div className="px-4 pb-4 overflow-y-scroll h-40 space-y-4">
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
                        <button
                          key={sample.id}
                          onClick={() => handleSampleClick(sample)}
                          type="button"
                          disabled={!paths.length}
                          className={`px-2 py-1 text-xs border ${
                            selectedSample?.name === sample.name
                              ? "bg-red-800 text-white"
                              : "text-red-400"
                          } ${!paths.length ? "opacity-50" : ""}`}
                        >
                          {sample.name}
                        </button>
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
                    browser’s IndexedDB and will be cleared if you fully reset
                    or close your session. If you save your entire session as
                    JSON, the samples become base64 inside the JSON so you can
                    re-load them later.
                  </div>
                </div>
              )}
            </div>

            {/* Effects Box */}
            <div className="w-full mt-4 border border-neutral-800 rounded-lg">
              <div className="bg-neutral-800 px-4 py-2">Effects</div>
              <div className="p-4 space-y-4">
                {/* FX Effects */}
                <div className="flex flex-wrap gap-2">
                  {effectStore
                    .filter((effect) => effect.type === "fx")
                    .map((effect) => (
                      <button
                        key={effect.name}
                        onClick={() => handleEffectClick(effect)}
                        type="button"
                        disabled={!paths.length}
                        className={`px-2 py-1 text-xs border ${
                          selectedEffect?.name === effect.name
                            ? "bg-neutral-300 text-black"
                            : "text-neutral-300"
                        } ${!paths.length ? "opacity-50" : ""}`}
                      >
                        {effect.name}
                      </button>
                    ))}
                </div>

                {/* Utility Effects */}
                <div className="flex flex-wrap gap-2">
                  {effectStore
                    .filter((effect) => effect.type === "utility")
                    .map((effect) => (
                      <button
                        key={effect.name}
                        onClick={() => handleEffectClick(effect)}
                        type="button"
                        disabled={!paths.length}
                        className={`px-2 py-1 text-xs border ${
                          selectedEffect?.name === effect.name
                            ? "bg-blue-800 text-white"
                            : "text-blue-400"
                        } ${!paths.length ? "opacity-50" : ""}`}
                      >
                        {effect.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Path/Branch config UI */}
        {(anyPathSelected ||
          (anyBranchSelected &&
            selectedBranch &&
            selectedEffectDefinition)) && (
          <div className="w-full flex flex-col items-center justify-center space-y-4">
            {/* Path Config */}
            {anyPathSelected &&
              (() => {
                const selectedHex = _.find(hexes, (hex) => hex.isPathSelected);
                if (!selectedHex) return null;
                const pathId = selectedHex.pathId;
                const currentPath = paths.find((p) => p.id === pathId);
                const volume =
                  currentPath?.volume !== undefined ? currentPath.volume : 1;

                return (
                  <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
                    <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
                      Path Config
                    </div>
                    <div className="p-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">
                          Volume
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={(e) => {
                            const newVolume = parseFloat(e.target.value);
                            setPaths((prevPaths) => {
                              const newPaths = [...prevPaths];
                              const pathIndex = newPaths.findIndex(
                                (p) => p.id === pathId
                              );
                              if (pathIndex !== -1) {
                                newPaths[pathIndex] = {
                                  ...newPaths[pathIndex],
                                  volume: newVolume,
                                };
                              }
                              return newPaths;
                            });
                          }}
                          className="w-full"
                        />
                        <span className="text-white">{volume.toFixed(2)}</span>
                      </div>

                      <div className="border-b border-neutral-800 my-4" />

                      <div className="flex justify-between items-center text-xs">
                        <div className="flex space-x-4">
                          <button
                            onClick={() => toggleSolo(pathId)}
                            className={`px-4 py-2 rounded transition-colors duration-150 ${
                              currentPath?.solo
                                ? "bg-amber-500 hover:bg-amber-600"
                                : "bg-neutral-800 hover:bg-neutral-700"
                            } text-white`}
                          >
                            Solo
                          </button>
                          <button
                            onClick={() => toggleBypass(pathId)}
                            className={`px-4 py-2 rounded transition-colors duration-150 ${
                              currentPath?.bypass
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-neutral-800 hover:bg-neutral-700"
                            } text-white`}
                          >
                            Bypass
                          </button>
                        </div>
                        <button
                          onClick={resetPath}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          Delete Path
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                                                  e.target.value
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
                                  {Number(param.value).toFixed(1)}
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

        {/* Controls Box (Play, BPM, Record, Save/Load) only on Desktop */}
        {!deviceType.isSmallDevice && !showLibrary && (
          <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
              Controls
            </div>
            <div className="p-4">
              <div className="w-full flex flex-col items-center justify-center space-y-4">
                <div className="flex flex-wrap sm:flex-nowrap justify-start md:justify-center gap-4 md:gap-2 text-sm">
                  <button
                    onClick={handlePlayToggle}
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
        )}

        {/* "Pre-load sequences made by others" Label */}
        {!showLibrary && (
          <div className="hidden lg:flex w-full mt-4 justify-center items-center">
            <div
              className="text-neutral-500 underline text-sm cursor-pointer"
              onClick={() => setShowLibrary(true)}
            >
              Pre-load sequences made by others.
            </div>
          </div>
        )}

        {/* Library panel */}
        {showLibrary && (
          <div className="w-full mt-4 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200">
              Library
            </div>
            <div className="p-4">
              <p className="text-sm mb-4 text-white">
                Select a shared track to load:
              </p>

              <div className="flex flex-col gap-3">
                {libraryFiles.map((file) => (
                  <button
                    key={file.url}
                    className="text-neutral-500 underline text-left"
                    onClick={() => {
                      handleLibraryLoad(file.url);
                      setIsConfigOpen(false);
                    }}
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
                    className="hidden lg:visible px-3 py-1 border border-neutral-600 text-neutral-300 text-sm"
                    onClick={() => setShowLibrary(false)}
                  >
                    Back
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </MobileConfigPanel>
    </>
  );
};

export default Controls;
