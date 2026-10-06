// Responsibility: Camera interaction for the Digital Twin — smooth damped orbit
//   (drag to rotate 360°, limited vertical tilt, scroll/pinch zoom), no panning,
//   with an imperative reset exposed via a ref for the "Reset View" button and
//   double-click. The avatar rotates; the 2D callout layer stays fixed (it lives
//   outside the <Canvas>).
// Layer: Command Center UI (Layer 4) — inside the R3F <Canvas>.

import React, { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// The framing "Reset View" must return to. OrbitControls captures its reset
// state at construction — BEFORE the target prop is applied — so without an
// explicit saveState() the reset target is (0,0,0): the floor at the cadet's
// feet. We set the pose ourselves and save it as the official reset state.
const HOME_TARGET = [0, 1.02, 0];
const HOME_POSITION = [0.3, 1.25, 3.62]; // full figure: plume to boots with margin

export default function DigitalTwinControls({ controlsRef }) {
  const inner = useRef(null);
  const { gl, camera, scene } = useThree();

  useEffect(() => {
    const c = inner.current;
    if (!c) return;
    c.target.set(...HOME_TARGET);
    c.object.position.set(...HOME_POSITION);
    c.update();
    c.saveState(); // reset() now returns exactly to this framing
  }, []);

  // Scroll wheel ROTATES the cadet (much easier than dragging). Zooming is
  // done with the +/- toolbar buttons, so the wheel is free for rotation.
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e) => {
      e.preventDefault();
      const c = inner.current;
      if (!c) return;
      const angle = e.deltaY * 0.0026;
      const v = camera.position.clone().sub(c.target);
      const s = Math.sin(angle), co = Math.cos(angle);
      const x = v.x * co - v.z * s;
      const z = v.x * s + v.z * co;
      v.x = x;
      v.z = z;
      camera.position.copy(c.target).add(v);
      c.update();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, camera]);

  // Double-click to FOCUS: raycast the click — hit the cadet and the camera
  // dives to that exact spot (face, belt, boots, anything); hit nothing and
  // the view resets to the full-figure framing.
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const onDblClick = (e) => {
      const c = inner.current;
      if (!c) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(ndc, camera);
      // only count hits on the cadet herself — the infinite floor grid is a
      // mesh too and was swallowing every "empty floor" double-click.
      const isOnCadet = (o) => {
        for (let p = o; p; p = p.parent) if (p.name === "cadet-root") return true;
        return false;
      };
      const hit = ray
        .intersectObjects(scene.children, true)
        .find((h) => h.object.isMesh && h.object.visible && isOnCadet(h.object));
      if (hit) {
        const dir = camera.position.clone().sub(hit.point).normalize();
        c.target.copy(hit.point);
        camera.position.copy(hit.point).add(dir.multiplyScalar(1.05));
        c.update();
      } else {
        c.reset();
      }
    };
    el.addEventListener("dblclick", onDblClick);
    return () => el.removeEventListener("dblclick", onDblClick);
  }, [gl, camera, scene]);

  return (
    <OrbitControls
      ref={(r) => {
        inner.current = r;
        if (controlsRef) controlsRef.current = r;
      }}
      makeDefault
      target={[0, 1.02, 0]}
      enablePan={false}
      enableZoom={false} // wheel is rotation now; zoom via the +/- buttons
      enableDamping
      dampingFactor={0.11}
      rotateSpeed={1.0}
      zoomSpeed={0.7}
      minDistance={0.55} // close enough for face/boot inspection via double-click focus
      maxDistance={5.5}
      // limit vertical tilt so the cadet is never viewed from extreme angles
      minPolarAngle={Math.PI * 0.28}
      maxPolarAngle={Math.PI * 0.62}
    />
  );
}
