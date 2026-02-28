import { useCallback, useEffect, useRef, useState } from "react";

const STARTUP_SUPPRESSION_MS = 800;

export function useProctorGuard({ enabled, onCopyBlocked }) {
  const failTriggeredRef = useRef(false);
  const mountedAtRef = useRef(0);
  const activationTimerRef = useRef(null);
  const [isGuardActive, setIsGuardActive] = useState(false);

  const activateGuard = useCallback((delayMs = 0) => {
    if (activationTimerRef.current) {
      window.clearTimeout(activationTimerRef.current);
    }
    activationTimerRef.current = window.setTimeout(() => {
      setIsGuardActive(true);
      activationTimerRef.current = null;
    }, delayMs);
  }, []);

  useEffect(() => {
    if (!enabled) {
      failTriggeredRef.current = false;
      mountedAtRef.current = 0;
      if (activationTimerRef.current) {
        window.clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
      setIsGuardActive(false);
      return undefined;
    }

    mountedAtRef.current = Date.now();

    const blockCopy = () => {
      if (!isGuardActive) return;
      if (failTriggeredRef.current) return;
      failTriggeredRef.current = true;
      onCopyBlocked?.();
      window.setTimeout(() => {
        failTriggeredRef.current = false;
      }, 400);
    };

    const onCopy = (event) => {
      if (Date.now() - mountedAtRef.current < STARTUP_SUPPRESSION_MS) return;
      event.preventDefault();
      event.stopPropagation();
      blockCopy();
    };

    const onKeyDown = (event) => {
      if (Date.now() - mountedAtRef.current < STARTUP_SUPPRESSION_MS) return;
      const key = (event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        event.stopPropagation();
        blockCopy();
      }
    };
    const onCut = (event) => {
      if (Date.now() - mountedAtRef.current < STARTUP_SUPPRESSION_MS) return;
      event.preventDefault();
      event.stopPropagation();
      blockCopy();
    };

    document.addEventListener("copy", onCopy);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("cut", onCut);

    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("cut", onCut);
      if (activationTimerRef.current) {
        window.clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
    };
  }, [enabled, isGuardActive, onCopyBlocked]);

  return {
    isGuardActive,
    activateGuard,
  };
}
