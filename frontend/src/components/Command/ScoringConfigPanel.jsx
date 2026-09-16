// Responsibility: Scoring-config panel (M11) — officers inspect the ACTIVE
//   weights per decision profile (college override / system default / built-in),
//   tune them with a live sum guard, and save a new audited version (ANO only).
// Layer: Command Center UI (Layer 4).
// Depends on: api/intelApi (getConfig/putConfig), scoringConfigPanel.css.
//   Rendered in the ANO shell (/ano/command/weights).
// Must never be depended on by: backend code or the Intelligence/Decision layers.
//
// Weights are edited as PERCENTAGES (they must total 100); the backend
// normalises to fractions and versions every save with who-changed-what.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  AlertTriangle,
  Save,
  RotateCcw,
  History,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { intelApi } from "../../api/intelApi";
import "./scoringConfigPanel.css";

const PROFILES = [
  { value: "general", label: "General" },
  { value: "rdc", label: "RDC" },
  { value: "promotion", label: "Promotion" },
  { value: "certificate", label: "Certificate" },
];

const PILLAR_LABELS = {
  attendance: "Attendance",
  discipline: "Discipline",
  knowledge: "Knowledge",
  participation: "Participation",
  leadership: "Leadership",
  drill: "Drill",
  communication: "Communication",
};

const SOURCE_LABELS = {
  college: "Your college's override",
  default: "System default",
  builtin: "Built-in default",
};

const toPercents = (fractions = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(fractions)) out[k] = Math.round(Number(v) * 100);
  return out;
};

export default function ScoringConfigPanel() {
  const [profile, setProfile] = useState("general");
  const [view, setView] = useState(null); // { resolved, history, builtin }
  const [edited, setEdited] = useState({}); // pillar -> percent
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedTick, setSavedTick] = useState(false);

  const load = useCallback(async (p) => {
    setLoading(true);
    setError("");
    try {
      const res = await intelApi.getConfig(p);
      setView(res.data);
      setEdited(toPercents(res.data?.resolved?.weights || {}));
    } catch (err) {
      setView(null);
      setError(
        err?.response?.status === 403
          ? "Only officers (ANO/SUO) can view scoring weights."
          : err?.response?.data?.message || "Failed to load the scoring configuration."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(profile);
  }, [profile, load]);

  const total = useMemo(
    () => Object.values(edited).reduce((a, b) => a + (Number(b) || 0), 0),
    [edited]
  );
  const totalOk = total === 100;

  const dirty = useMemo(() => {
    const current = toPercents(view?.resolved?.weights || {});
    const keys = new Set([...Object.keys(current), ...Object.keys(edited)]);
    for (const k of keys) if ((current[k] || 0) !== (Number(edited[k]) || 0)) return true;
    return false;
  }, [view, edited]);

  const setWeight = (pillar, value) => {
    setEdited((prev) => {
      // A pillar can only take what is left of the 100% budget, so the
      // combined total can never exceed 100.
      const othersTotal = Object.entries(prev).reduce(
        (a, [k, v]) => (k === pillar ? a : a + (Number(v) || 0)),
        0
      );
      const budget = Math.max(0, 100 - othersTotal);
      const num = Math.max(0, Math.min(budget, Math.round(Number(value) || 0)));
      return { ...prev, [pillar]: num };
    });
  };

  const resetToActive = () => setEdited(toPercents(view?.resolved?.weights || {}));
  const resetToBuiltin = () => setEdited(toPercents(view?.builtin || {}));

  const save = async () => {
    if (!totalOk || saving) return;
    setSaving(true);
    setError("");
    try {
      const weights = {};
      for (const [k, v] of Object.entries(edited)) if (Number(v) > 0) weights[k] = Number(v);
      await intelApi.putConfig(profile, weights);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2200);
      await load(profile);
    } catch (err) {
      setError(
        err?.response?.status === 403
          ? "Only an ANO can change scoring weights."
          : err?.response?.data?.message || "Failed to save the new version."
      );
    } finally {
      setSaving(false);
    }
  };

  const resolved = view?.resolved;
  const pillars = useMemo(() => {
    const keys = new Set([
      ...Object.keys(view?.builtin || {}),
      ...Object.keys(edited),
    ]);
    return [...keys].sort((a, b) => (edited[b] || 0) - (edited[a] || 0));
  }, [view, edited]);

  return (
    <div className="scp-page">
      <div className="scp-hero">
        <div>
          <h1 className="scp-title">
            <SlidersHorizontal size={21} /> Scoring Weights
          </h1>
          <p className="scp-sub">
            Tune how each pillar counts per decision profile — every save is a new audited version
          </p>
        </div>
        <div className="scp-profiles">
          {PROFILES.map((p) => (
            <button
              key={p.value}
              className={`scp-profile-btn ${profile === p.value ? "scp-active" : ""}`}
              onClick={() => setProfile(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="scp-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="scp-loading">
          <Loader2 size={18} className="scp-spin" /> Loading weights…
        </div>
      ) : view ? (
        <div className="scp-layout">
          {/* editor */}
          <section className="scp-card">
            <header className="scp-card-head">
              <div>
                <h2>Active weights — {PROFILES.find((p) => p.value === profile)?.label}</h2>
                <p className="scp-source">
                  <BadgeCheck size={13} /> {SOURCE_LABELS[resolved?.source] || resolved?.source}
                  {resolved?.version ? ` · v${resolved.version}` : ""}
                </p>
              </div>
              <span className={`scp-total ${totalOk ? "scp-total-ok" : "scp-total-bad"}`}>
                Total {total}%
              </span>
            </header>

            <div className="scp-rows">
              {pillars.map((pillar) => (
                <div key={pillar} className="scp-row">
                  <span className="scp-pillar">{PILLAR_LABELS[pillar] || pillar}</span>
                  <input
                    className="scp-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={edited[pillar] || 0}
                    onChange={(e) => setWeight(pillar, e.target.value)}
                  />
                  <div className="scp-numwrap">
                    <input
                      className="scp-num"
                      type="number"
                      min="0"
                      max="100"
                      value={edited[pillar] || 0}
                      onChange={(e) => setWeight(pillar, e.target.value)}
                    />
                    <span>%</span>
                  </div>
                  <div className="scp-bar">
                    <div className="scp-bar-fill" style={{ width: `${edited[pillar] || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {!totalOk && (
              <p className="scp-hint">
                Weights must total exactly 100% before saving — currently {total}%.
              </p>
            )}

            <div className="scp-actions">
              <button className="scp-btn scp-btn-ghost" onClick={resetToActive} disabled={!dirty}>
                <RotateCcw size={14} /> Reset to active
              </button>
              <button className="scp-btn scp-btn-ghost" onClick={resetToBuiltin}>
                <RotateCcw size={14} /> Load built-in default
              </button>
              <button
                className="scp-btn scp-btn-primary"
                onClick={save}
                disabled={!totalOk || !dirty || saving}
                title={!dirty ? "No changes to save" : undefined}
              >
                {saving ? <Loader2 size={14} className="scp-spin" /> : <Save size={14} />}
                {savedTick ? "Saved ✓" : "Save as new version"}
              </button>
            </div>
            <p className="scp-note">
              Saving affects profile-weighted views (e.g. the Camp Selection Board) immediately.
              Stored snapshots themselves are never rewritten. ANO only.
            </p>
          </section>

          {/* history */}
          <aside className="scp-card scp-history">
            <header className="scp-card-head">
              <h2>
                <History size={15} /> Version history
              </h2>
            </header>
            {view.history?.length ? (
              <ul className="scp-hist-list">
                {view.history.map((h) => (
                  <li key={h.id} className={h.is_active ? "scp-hist-active" : ""}>
                    <div className="scp-hist-top">
                      <b>v{h.version}</b>
                      {h.is_active && <span className="scp-hist-badge">active</span>}
                      <span className="scp-hist-date">
                        {new Date(h.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="scp-hist-weights">
                      {(() => {
                        // Stored rows may hold fractions (~1) or percents (~100).
                        const entries = Object.entries(h.weights || {});
                        const sum = entries.reduce((a, [, v]) => a + (Number(v) || 0), 0);
                        const scale = sum > 1.5 ? 1 : 100;
                        return entries
                          .map(
                            ([k, v]) =>
                              `${(PILLAR_LABELS[k] || k).slice(0, 4)} ${Math.round(v * scale)}%`
                          )
                          .join(" · ");
                      })()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="scp-hist-empty">
                No saved versions for this profile yet — the {SOURCE_LABELS[resolved?.source]?.toLowerCase()} is in force.
              </p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
