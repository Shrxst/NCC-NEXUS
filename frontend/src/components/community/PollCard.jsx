import React, { useEffect, useMemo, useState } from "react";
import { FaChartBar, FaClock } from "react-icons/fa";

function formatTimeLeft(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const d = Math.floor(h / 24);
  if (d > 0) return `In ${d} day${d > 1 ? "s" : ""}`;
  return `In ${h}h`;
}

export default function PollCard({ post, currentRole, onVote }) {
  const poll = post.pollDetails;
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const selectedFromBackend = (poll?.options || [])
      .filter((option) => Boolean(option.selected))
      .map((option) => option.id);
    setSelected(selectedFromBackend);
  }, [poll]);

  const totalVotes = useMemo(
    () => (poll?.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0),
    [poll]
  );

  if (!poll) return null;
  const expired = new Date(poll.deadline).getTime() < Date.now();

  const toggleOption = (optionId) => {
    if (expired) return;
    if (selected.includes(optionId)) return;
    setSelected([optionId]);
    onVote(post.id, [optionId], currentRole);
  };

  return (
    <div className="community-poll-card">
      <div className="community-poll-top">
        <h4>
          <FaChartBar size={16} />
          {poll.question}
        </h4>
      </div>
      <div className="community-poll-list">
        {poll.options.map((option) => {
          const votes = Number(option.votes || 0);
          const shareExact = totalVotes ? (votes / totalVotes) * 100 : 0;
          const share = Math.round(shareExact);
          const isSelected = selected.includes(option.id);
          const visualShare = isSelected ? Math.max(shareExact, 8) : shareExact;
          return (
            <button
              key={option.id}
              type="button"
              className={`community-poll-option ${isSelected ? "selected" : ""}`}
              disabled={expired}
              onClick={() => toggleOption(option.id)}
            >
              <span className="community-poll-fill" style={{ width: `${visualShare}%` }} />
              <div className="community-poll-content-row">
                <span className="community-poll-label">{option.text}</span>
                <span className="community-poll-count">
                  <span>{share}%</span>
                  <span>({votes} votes)</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="community-poll-actions">
        <span>{totalVotes} votes</span>
        <div className="community-poll-actions-right">
          <span className={`community-deadline ${expired ? "expired" : ""}`}>
            <FaClock size={13} />
            {formatTimeLeft(poll.deadline)}
          </span>
        </div>
      </div>
    </div>
  );
}
