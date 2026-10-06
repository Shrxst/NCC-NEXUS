// Responsibility: The gender-aware cadet avatar abstraction. Resolves the correct
//   GLB by gender, probes for it, lazy-loads it, and drives the animation contract
//   (Idle / Attention / Salute). If the asset is missing or fails, it falls back to
//   the procedural cadet — never a crash, never a blank. Dropping the real GLBs into
//   /public/models/cadets/ requires NO other code change.
// Layer: Command Center UI (Layer 4) — inside the R3F <Canvas>.
//
// Production assets (see /public/models/README.md):
//   /models/cadets/male-cadet.glb
//   /models/cadets/female-cadet.glb
// Required animation clip names: "Idle", "Attention", "Salute".
// Opening sequence: Attention → Salute (once) → Idle (loop).

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { LoopOnce } from "three";

// Bump MODEL_VERSION whenever the GLB files change — the query string makes
// every browser (and CDN) fetch the new file instead of a stale cached copy.
const MODEL_VERSION = 18;
const MODEL_BY_GENDER = {
  male: `/models/cadets/male-cadet.glb?v=${MODEL_VERSION}`,
  female: `/models/cadets/female-cadet.glb?v=${MODEL_VERSION}`,
};

export function resolveCadetModelUrl(gender) {
  return MODEL_BY_GENDER[gender] || MODEL_BY_GENDER.male;
}

// ── GLB path: plays the animation contract when the real asset exists ──
function GLBCadet({ url, salute }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { actions, names, mixer } = useAnimations(animations, group);

  // Map clips. Blender/Mixamo exports often include a static bind-pose clip
  // named "mixamo.com*" / "T-Pose" — playing it freezes the cadet in T-pose,
  // so those are never candidates.
  const clips = useMemo(() => {
    const usable = names.filter((n) => !/^mixamo\.com|t-?pose/i.test(n));
    const find = (re) => usable.find((n) => re.test(n));
    return {
      idle: find(/idle|breath/i) || find(/attention|savdhan|stand/i) || null,
      salute: find(/salute/i) || null,
      any: usable[0] || null,
    };
  }, [names]);

  useEffect(() => {
    if (!actions) return undefined;
    const idle = clips.idle && actions[clips.idle];
    const sal = clips.salute && actions[clips.salute];
    const any = clips.any && actions[clips.any];

    let onFinished;
    if (salute && sal) {
      // Salute once at FULL weight immediately — fading in would blend from
      // the bind pose (the T-pose), which looks like a glitch. The clip
      // starts and ends at attention, so replays are seamless too.
      sal.stop();
      sal.reset();
      sal.setLoop(LoopOnce, 1);
      sal.clampWhenFinished = true;
      sal.setEffectiveWeight(1);
      sal.play();
      if (idle && mixer) {
        onFinished = (e) => {
          if (e.action !== sal) return;
          sal.crossFadeTo(idle.reset().play(), 0.35, false);
        };
        mixer.addEventListener("finished", onFinished);
      }
    } else if (idle) {
      idle.stop().reset();
      idle.setEffectiveWeight(1);
      idle.play();
    } else if (sal) {
      // No salute wanted and no idle clip: freeze on the salute clip's first
      // frame, which is the attention stance — never the bind pose.
      sal.stop().reset();
      sal.setEffectiveWeight(1);
      sal.play();
      sal.paused = true;
    } else if (any) {
      any.stop().reset();
      any.setEffectiveWeight(1);
      any.play();
    }
    // If the GLB has no clips at all, it simply stands in its bind pose — no crash.

    // Cleanup only detaches the listener. Never fade actions out here: on a
    // salute replay this cleanup runs first, and fading to zero weight shows
    // the bind pose (T-pose) for a moment — the "jump" glitch.
    return () => {
      if (mixer && onFinished) mixer.removeEventListener("finished", onFinished);
    };
  }, [actions, mixer, clips, salute]);

  return <primitive ref={group} object={scene} dispose={null} />;
}

// Any GLB load/parse/runtime failure → the procedural cadet (never a blank).
class CadetBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    if (this.props.onFallback) this.props.onFallback();
  }
  render() {
    if (this.state.failed) {
      return null; // GLB failed — render nothing rather than a placeholder figure
    }
    return this.props.children;
  }
}

/**
 * @param {{gender?: 'male'|'female', salute?: boolean, onFallback?: Function}} props
 */
export default function CadetAvatar({ gender = "male", salute = true, onFallback }) {
  const url = resolveCadetModelUrl(gender);
  const [available, setAvailable] = useState(null); // null=checking

  // Probe for the real asset before attempting useGLTF. In dev, Vite serves
  // index.html for a missing .glb, which makes the loader throw — the probe
  // avoids that entirely: no asset → procedural fallback, reliably.
  useEffect(() => {
    let alive = true;
    setAvailable(null);
    fetch(url, { method: "HEAD" })
      .then((res) => {
        const ct = res.headers.get("content-type") || "";
        if (alive) setAvailable(res.ok && !ct.includes("text/html"));
      })
      .catch(() => {
        if (alive) setAvailable(false);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    if (available === false && onFallback) onFallback();
  }, [available, onFallback]);

  if (available === true) {
    return (
      <CadetBoundary gender={gender} salute={salute} onFallback={onFallback}>
        <Suspense fallback={null}>
          <GLBCadet url={url} salute={salute} />
        </Suspense>
      </CadetBoundary>
    );
  }

  // Checking or unavailable → empty scene (no placeholder figure).
  return null;
}
