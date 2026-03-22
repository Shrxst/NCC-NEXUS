import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCommentDots, FaEye, FaPen, FaThumbtack, FaTrashCan } from "react-icons/fa6";
import EventCard from "./EventCard";
import PollCard from "./PollCard";
import MediaViewer from "./MediaViewer";
import CommentSection from "./CommentSection";

const ROLE_CLASS = {
  ano: "ano",
  suo: "suo",
  cadet: "cadet",
  alumni: "alumni",
};

function timeAgo(ts) {
  const ms = Date.now() - Number(ts || 0);
  const m = Math.floor(ms / (1000 * 60));
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const reactionKeys = [
  { key: "salute", icon: "\u{1F44D}" },
  { key: "clap", icon: "\u{2764}\u{FE0F}" },
  { key: "fire", icon: "\u{1F525}" },
  { key: "applause", icon: "\u{1F44F}" },
  { key: "laugh", icon: "\u{1F602}" },
  { key: "wow", icon: "\u{1F62E}" },
];

const HOLD_MS = 500;

export default function PostCard({
  post,
  role,
  canEdit,
  canDelete,
  canPost,
  canComment,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onVote,
  onAddComment,
  onAddReply,
  activeReaction,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const likersRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const holdTimer = useRef(null);
  const didLongPress = useRef(false);
  const wrapRef = useRef(null);
  const shortContent = useMemo(() => (post.content || "").slice(0, 220), [post.content]);

  const activeEmoji = useMemo(() => {
    if (!activeReaction) return null;
    const found = reactionKeys.find((r) => r.key === activeReaction);
    return found ? found.icon : null;
  }, [activeReaction]);

  const totalReactions = useMemo(
    () => reactionKeys.reduce((sum, r) => sum + Number(post.reactions?.[r.key] || 0), 0),
    [post.reactions]
  );

  const startHold = useCallback(() => {
    didLongPress.current = false;
    holdTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setPickerOpen(true);
    }, HOLD_MS);
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const handleTriggerClick = useCallback(() => {
    if (didLongPress.current) return;
    if (activeReaction === "salute") {
      onReact(post.id, "salute");
    } else {
      onReact(post.id, "salute");
    }
  }, [activeReaction, onReact, post.id]);

  const pickReaction = useCallback(
    (key) => {
      setPickerOpen(false);
      onReact(post.id, key);
    },
    [onReact, post.id]
  );

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutsideClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!showLikers) return;
    const close = (e) => {
      if (likersRef.current && !likersRef.current.contains(e.target)) setShowLikers(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showLikers]);

  const isLong = (post.content || "").length > 220;

  return (
    <div className={`community-post-pair ${showComments ? "comments-open" : ""}`}>
      <article className={`community-post-card ${post.pinned ? "pinned" : ""}`}>
      <header className="community-post-head">
        <div className="community-author-block">
          <div className="community-author-meta">
            <div className="community-avatar">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt={post.author || "Profile"} />
              ) : (
                (post.author || "N").slice(0, 1)
              )}
            </div>
            <div>
              <strong>{post.author}</strong>
              <div className="community-meta-row">
                <span className={`community-role-badge ${ROLE_CLASS[post.authorRole] || "cadet"}`}>{post.authorRole}</span>
                <span className="community-time-meta">{timeAgo(post.timestamp)}</span>
              </div>
            </div>
          </div>
          {canEdit || canDelete ? (
            <div className="community-post-tools community-post-tools-left">
              {canEdit ? (
                <button type="button" onClick={() => onEdit(post)}>
                  <FaPen size={12} />
                  Edit
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" onClick={() => onDelete(post.id)}>
                  <FaTrashCan size={12} />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={`community-post-right ${canPost ? "with-pin" : "without-pin"}`}>
          {canPost ? (
            <button
              type="button"
              className={`community-pin-icon-btn ${post.pinned ? "pinned" : ""}`}
              onClick={() => onPin(post.id)}
              aria-label={post.pinned ? "Unpin post" : "Pin post"}
              title={post.pinned ? "Unpin post" : "Pin post"}
            >
              <FaThumbtack size={13} />
            </button>
          ) : null}
          <span className={`community-type-badge ${post.type}`}>{post.type}</span>
        </div>
      </header>

      <div className="community-post-content">
        <p>{expanded || !isLong ? post.content : `${shortContent}...`}</p>
        {(post.tags || []).length ? <span className="community-hash-tag">#{post.tags[0].toLowerCase()}</span> : null}
        {isLong ? (
          <button type="button" className="community-read-toggle" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      {post.type === "event" ? <EventCard eventDetails={post.eventDetails} /> : null}
      {post.type === "poll" ? <PollCard post={post} currentRole={role} onVote={onVote} /> : null}
      {post.type === "media" ? (
        <MediaViewer mediaUrls={post.mediaUrls || []} videoUrls={post.videoUrls || []} pdfUrls={post.pdfUrls || []} />
      ) : null}

      <footer className="community-post-footer">
        <div className="community-post-stats">
          <span className="community-stat-item">
            <FaEye size={13} />
            {post.views || 0} views
          </span>
          {totalReactions > 0 ? (
            <span className="community-stat-item community-reactions-stat" onClick={() => setShowLikers((v) => !v)}>
              <span className="community-reaction-icons">
                {reactionKeys
                  .filter((r) => Number(post.reactions?.[r.key] || 0) > 0)
                  .map((item, i) => (
                    <span key={item.key} className="community-reaction-icon-circle" style={{ zIndex: 3 - i }}>
                      {item.icon}
                    </span>
                  ))}
              </span>
              {totalReactions} reactions
              {showLikers && (
                <div className="community-likers-popup" ref={likersRef}>
                  <div className="community-likers-header">
                    <span>Reactions</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowLikers(false); }}>&times;</button>
                  </div>
                  <div className="community-likers-list">
                    {activeReaction && (
                      <div className="community-liker-item">
                        <div className="community-liker-avatar">You</div>
                        <span className="community-liker-name">You</span>
                      </div>
                    )}
                    {(activeReaction ? totalReactions - 1 : totalReactions) > 0 && (
                      <div className="community-liker-item">
                        <div className="community-liker-avatar community-liker-others">+{activeReaction ? totalReactions - 1 : totalReactions}</div>
                        <span className="community-liker-name">{activeReaction ? totalReactions - 1 : totalReactions} other{(activeReaction ? totalReactions - 1 : totalReactions) !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </span>
          ) : null}
          {(post.comments || []).length > 0 ? (
            <span className="community-stat-item">{post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}</span>
          ) : null}
        </div>

        <div className="community-actions-row">
          <div
            className="community-reaction-trigger-wrap"
            ref={wrapRef}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={() => { cancelHold(); }}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onContextMenu={handleContextMenu}
          >
            <button
              type="button"
              className={`community-action-btn${activeReaction ? " reacted" : ""}`}
              onClick={handleTriggerClick}
            >
              <span className="community-action-emoji">{activeEmoji || "\u{1F44D}"}</span>
              <span>React</span>
            </button>
            {pickerOpen ? (
              <div className="community-reaction-picker">
                {reactionKeys.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={activeReaction === item.key ? "active" : ""}
                    onClick={() => pickReaction(item.key)}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="community-action-btn" onClick={() => setShowComments((prev) => !prev)}>
            <FaCommentDots size={14} />
            <span>Comment</span>
          </button>
        </div>
      </footer>

      </article>

      <CommentSection
        post={post}
        role={role}
        canComment={canComment}
        onAddComment={onAddComment}
        onAddReply={onAddReply}
      />
    </div>
  );
}

