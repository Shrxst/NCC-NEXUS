// Responsibility: Top-level orchestrator for the 3D Digital Twin experience.
//   Owns data (useTwinData), the premium initialization sequence, error / no-snapshot
//   fallbacks, the lazy-loaded 3D scene, the fixed overlay (identity, callouts,
//   readiness, risk), camera reset, the salute-once guard and responsive layout.
//   Presentation only — no readiness math, existing routes/APIs untouched.
// Layer: Command Center UI (Layer 4).
// Route: /ano/command/cadet/:regimentalNo (ANO) and /twin[/:regimentalNo] (self).

import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  CloudOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTwinData } from "./useTwinData";
import DigitalTwinIdentity from "./overlay/DigitalTwinIdentity";
import DigitalTwinReadiness from "./overlay/DigitalTwinReadiness";
import DigitalTwinRisk from "./overlay/DigitalTwinRisk";
import DigitalTwinCallouts from "./overlay/DigitalTwinCallouts";
import DigitalTwinPillarDetail from "./overlay/DigitalTwinPillarDetail";
import "./digitalTwin.css";

// three.js stays out of the main bundle — loaded only when the Twin opens.
const DigitalTwinScene = lazy(() => import("./scene/DigitalTwinScene"));

// If WebGL / the 3D scene fails for any reason, never blank the screen — the
// intelligence overlay (callouts, readiness, identity) still renders on top.
class SceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { failed: true, message: (err && err.message) || String(err) };
  }
  componentDidCatch(err) {
    // eslint-disable-next-line no-console
    console.error("[DigitalTwin scene error]", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="dt-canvas-note">
          <b>3D view could not start</b>
          <span>{this.state.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// WebGL capability probe — a blank canvas is most often a WebGL/GPU problem.
// Probe ONCE per page load and release the probe context immediately.
// (The old version ran on every render and leaked a WebGL context each time —
// after ~16 renders the browser refuses new contexts and 3D "disappears".)
let webglOk = null;
function webglSupported() {
  if (webglOk !== null) return webglOk;
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    webglOk = !!(window.WebGLRenderingContext && gl);
    gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
  } catch {
    webglOk = false;
  }
  return webglOk;
}

function InitSequence() {
  return (
    <div className="dt-init">
      <div className="dt-init-brand">DIGITAL TWIN</div>
      <div className="dt-init-sub">INITIALIZING</div>
      <ul className="dt-init-lines">
        <li style={{ "--d": "0.15s" }}><span>Identity</span><b>VERIFIED</b></li>
        <li style={{ "--d": "0.55s" }}><span>Readiness</span><b>SYNCED</b></li>
        <li style={{ "--d": "0.95s" }}><span>Intelligence</span><b>ONLINE</b></li>
      </ul>
    </div>
  );
}

export default function DigitalTwinExperience({ embedded = false, gender }) {
  const params = useParams();
  const {
    reg,
    loading,
    error,
    needsCompute,
    recomputing,
    identity,
    risk,
    view,
    reload,
    recompute,
  } = useTwinData(params.regimentalNo);

  // Gender from the NCC regimental number itself: SW = Senior Wing (female),
  // SD = Senior Division (male). Explicit prop still wins if ever provided.
  const resolvedGender =
    gender || (/^[A-Z]{2}\d{4}SW/i.test(reg || "") ? "female" : "male");

  const controlsRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [glbPending, setGlbPending] = useState(false);

  // Salute on every visit, replayable on demand. The tick is passed down as
  // the `salute` prop: any truthy value plays it, and incrementing it re-runs
  // the animation effect — so the Salute button below replays it.
  const [saluteTick, setSaluteTick] = useState(1);
  const replaySalute = () => setSaluteTick((t) => t + 1);

  // Premium init: hold the sequence until data resolves AND a short minimum.
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1150);
    return () => clearTimeout(t);
  }, []);
  const booting = loading || !minElapsed;

  const resetView = () => controlsRef.current?.reset?.();

  // Zoom via buttons (the scroll wheel rotates the model instead).
  const zoomBy = (f) => {
    const c = controlsRef.current;
    if (!c) return;
    const v = c.object.position.clone().sub(c.target);
    v.setLength(Math.min(5.5, Math.max(2.1, v.length() * f)));
    c.object.position.copy(c.target).add(v);
    c.update();
  };

  const pillars = useMemo(() => view?.pillars || [], [view]);

  return (
    <div className={`dt-experience ${embedded ? "dt-embedded" : "dt-standalone"}`}>
      {/* premium initialization overlay */}
      {booting && <InitSequence />}

      {/* ERROR (readiness could not load / not authorised) */}
      {!booting && error && (
        <div className="dt-fallback">
          <div className="dt-fallback-ic dt-fallback-err"><AlertTriangle size={26} /></div>
          <h3>Digital Twin unavailable</h3>
          <p>{error}</p>
          <button className="dt-btn" onClick={reload}>Try again</button>
        </div>
      )}

      {/* NO SNAPSHOT YET */}
      {!booting && needsCompute && !error && (
        <div className="dt-fallback">
          <div className="dt-fallback-ic"><Sparkles size={26} /></div>
          <h3>No readiness snapshot yet</h3>
          <p>Generate the first snapshot to bring this cadet's Digital Twin online.</p>
          <button className="dt-btn" onClick={recompute} disabled={recomputing}>
            <RefreshCw size={15} className={recomputing ? "dt-spin" : ""} />
            {recomputing ? "Computing…" : "Compute readiness"}
          </button>
        </div>
      )}

      {/* THE EXPERIENCE */}
      {!booting && view && !error && (
        <div className="dt-stage">
          {/* 3D scene (rotatable) */}
          <div className="dt-canvas">
            {webglSupported() ? (
              <SceneBoundary>
                <Suspense fallback={<div className="dt-canvas-loading" />}>
                  <DigitalTwinScene
                    salute={saluteTick}
                    gender={resolvedGender}
                    controlsRef={controlsRef}
                    onFallback={() => setGlbPending(true)}
                  />
                </Suspense>
              </SceneBoundary>
            ) : (
              <div className="dt-canvas-note">
                <b>3D not available in this browser</b>
                <span>WebGL appears to be disabled. Enable hardware acceleration in your browser settings, then reload.</span>
              </div>
            )}
          </div>

          {/* fixed overlay — never rotates with the model */}
          <div className="dt-overlay">
            <DigitalTwinIdentity identity={identity} />
            <DigitalTwinRisk risk={risk} />
            <DigitalTwinCallouts pillars={pillars} onSelect={setSelected} />
            <div className="dt-center"><DigitalTwinReadiness overall={view.overall} /></div>

            {/* mobile intelligence rail (side callouts hidden on small screens) */}
            <div className="dt-mobile-rail">
              {pillars.map((p) => (
                <button key={p.key} className="dt-chip" onClick={() => setSelected(p)}>
                  <span>{p.label}</span>
                  <b>{p.score == null ? "—" : Math.round(p.score)}</b>
                </button>
              ))}
            </div>

            {/* toolbar */}
            <div className="dt-toolbar">
              {glbPending && (
                <span className="dt-asset-chip" title="Reference avatar shown until the NCC GLB is provided">
                  <CloudOff size={13} /> Reference avatar · NCC model pending
                </span>
              )}
              <button className="dt-tool-btn" onClick={() => zoomBy(0.8)} title="Zoom in">
                <ZoomIn size={14} />
              </button>
              <button className="dt-tool-btn" onClick={() => zoomBy(1.25)} title="Zoom out">
                <ZoomOut size={14} />
              </button>
              <button
                className="dt-tool-btn"
                onClick={replaySalute}
                title="Play greeting gesture (presentation only)"
              >
                <Sparkles size={14} /> Salute
              </button>
              <button className="dt-tool-btn" onClick={resetView} title="Reset view">
                <RotateCcw size={14} /> Reset View
              </button>
              <button className="dt-tool-btn" onClick={recompute} disabled={recomputing} title="Recompute readiness">
                <RefreshCw size={14} className={recomputing ? "dt-spin" : ""} />
                {recomputing ? "Computing…" : "Recompute"}
              </button>
            </div>

            <div className="dt-note-chip">
              <Sparkles size={12} />
              For visual presentation only — gestures are indicative, not official NCC drill
            </div>
            <div className="dt-hint">Scroll to rotate · + / − to zoom · double-click to inspect · Reset View to return</div>
          </div>

          {/* click-through pillar detail */}
          {selected && <DigitalTwinPillarDetail pillar={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
