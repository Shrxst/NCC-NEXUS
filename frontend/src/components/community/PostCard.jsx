import React, { useMemo, useState } from "react";
import { FaCommentDots, FaPen, FaThumbtack, FaTrashCan } from "react-icons/fa6";
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
];

export default function PostCard({
  post,
  role,
  canEdit,
  canPost,
  canComment,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onVote,
  onAddComment,
  onAddReply,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const shortContent = useMemo(() => (post.content || "").slice(0, 220), [post.content]);
  const isLong = (post.content || "").length > 220;

  return (
    <div className={`community-post-pair ${showComments ? "comments-open" : ""}`}>
      <article className={`community-post-card ${post.pinned ? "pinned" : ""}`}>
      <header className="community-post-head">
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
        <div className="community-post-right">
          <span className={`community-type-badge ${post.type}`}>{post.type}</span>
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
          {canEdit ? (
            <div className="community-post-tools">
              <button type="button" onClick={() => onEdit(post)}>
                <FaPen size={12} />
                Edit
              </button>
              <button type="button" onClick={() => onDelete(post.id)}>
                <FaTrashCan size={12} />
                Delete
              </button>
            </div>
          ) : null}
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
        <div className="community-reaction-row">
          {reactionKeys.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`community-reaction-pill ${item.key}`}
              onClick={() => onReact(post.id, item.key)}
            >
              <span>{item.icon}</span>
              {Number(post.reactions?.[item.key] || 0)}
            </button>
          ))}
        </div>
        <div className="community-post-foot-actions">
          <button type="button" onClick={() => setShowComments((prev) => !prev)}>
            <FaCommentDots size={18} />
            {(post.comments || []).length}
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

