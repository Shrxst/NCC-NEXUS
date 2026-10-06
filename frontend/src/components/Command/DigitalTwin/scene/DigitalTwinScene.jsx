// Responsibility: The R3F <Canvas> for the Digital Twin — composes lighting, the
//   avatar, camera controls and a faint command-floor grid. Lazy-loaded so three.js
//   stays out of the main bundle. Pauses the render loop when the tab is hidden and
//   disposes GL resources on unmount. Contains NO data/UI (callouts live outside).
// Layer: Command Center UI (Layer 4).

import React, { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import DigitalTwinLighting from "./DigitalTwinLighting";
import DigitalTwinControls from "./DigitalTwinControls";
import CadetAvatar from "./CadetAvatar";

// Pause the render loop while the tab is hidden (battery/GPU friendly).
function FrameloopManager() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setFrameloop]);
  return null;
}

export default function DigitalTwinScene({ salute = true, gender = "male", controlsRef, onFallback }) {
  // Defer creating the WebGL <Canvas> until after the first commit. Under
  // React.StrictMode (dev), a Canvas mounted during the initial synchronous
  // double-invoke can end up blank (the GL context is created then torn down and
  // not reinitialised). Mounting one commit later guarantees a single, stable
  // canvas — this is the standard R3F StrictMode workaround.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <div className="dt-canvas-loading" />;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0.3, 1.25, 3.62], fov: 34, near: 0.1, far: 100 }}
    >
      <FrameloopManager />
      <DigitalTwinLighting />

      <group position={[0, 0, 0]} name="cadet-root">
        <CadetAvatar gender={gender} salute={salute} onFallback={onFallback} />
      </group>

      {/* faint command-floor grid */}
      <Grid
        position={[0, 0, 0]}
        args={[16, 16]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#c8cfe8"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9aa5d8"
        fadeDistance={11}
        fadeStrength={1.6}
        followCamera={false}
        infiniteGrid
      />

      <DigitalTwinControls controlsRef={controlsRef} />
    </Canvas>
  );
}
