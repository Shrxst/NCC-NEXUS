import React, { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Video,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  X,
  Edit2,
  Reply,
  Eye,
  Smile,
  Flag,
  Pin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "./feed.css";
import { connectFeedSocket, getFeedSocket } from "../../features/feed/feedSocket";

/* ===== TIME FORMATTER ===== */
const formatTime = (timestamp) => {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

/* ===== FORMAT TEXT WITH MENTIONS ===== */
const formatTextWithMentions = (text) => {
  if (!text) return "";
  const mentionRegex = /@(\w+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="mention">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

/* ===== REACTION BUTTON WITH LONG-PRESS PICKER ===== */
const REACTION_EMOJIS = [
  { key: "like", icon: "\u{1F44D}" },
  { key: "love", icon: "\u{2764}\u{FE0F}" },
  { key: "fire", icon: "\u{1F525}" },
  { key: "clap", icon: "\u{1F44F}" },
  { key: "laugh", icon: "\u{1F602}" },
  { key: "wow", icon: "\u{1F62E}" },
];
const HOLD_MS = 500;

function FeedReactButton({ liked, likeCount, onToggleLike, chosenEmoji, onPickEmoji }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const holdTimer = React.useRef(null);
  const didLongPress = React.useRef(false);
  const wrapRef = React.useRef(null);

  const activeEmoji = liked ? (chosenEmoji || "\u{2764}\u{FE0F}") : "\u{1F44D}";

  const startHold = React.useCallback(() => {
    didLongPress.current = false;
    holdTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setPickerOpen(true);
    }, HOLD_MS);
  }, []);

  const cancelHold = React.useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const handleClick = React.useCallback(() => {
    if (didLongPress.current) return;
    const defaultEmoji = "\u{1F44D}";
    onToggleLike(!liked ? defaultEmoji : null);
    if (!liked) onPickEmoji(defaultEmoji);
  }, [onToggleLike, liked, onPickEmoji]);

  const pickReaction = React.useCallback((emoji) => {
    setPickerOpen(false);
    onPickEmoji(emoji);
    onToggleLike(emoji);
  }, [liked, onToggleLike, onPickEmoji]);

  const handleContextMenu = React.useCallback((e) => {
    e.preventDefault();
    setPickerOpen(true);
  }, []);

  React.useEffect(() => {
    if (!pickerOpen) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [pickerOpen]);

  return (
    <div
      className="feed-react-wrap"
      ref={wrapRef}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className={`feed-action-btn${liked ? " liked" : ""}`}
        onClick={handleClick}
      >
        <span className="feed-react-emoji">{activeEmoji}</span>
        <span>{liked ? "Reacted" : "React"}</span>
      </button>
      {pickerOpen ? (
        <div className="feed-reaction-picker">
          {REACTION_EMOJIS.map((item) => (
            <button key={item.key} type="button" onClick={() => pickReaction(item.icon)}>
              {item.icon}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ===== LIKERS POPUP ===== */
function LikersPopup({ likeCount, liked, profileName, onClose }) {
  const popupRef = React.useRef(null);
  const othersCount = liked ? likeCount - 1 : likeCount;

  React.useEffect(() => {
    const close = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  return (
    <div className="feed-likers-popup" ref={popupRef}>
      <div className="feed-likers-header">
        <span>Reactions</span>
        <button type="button" onClick={onClose}>&times;</button>
      </div>
      <div className="feed-likers-list">
        {liked && (
          <div className="feed-liker-item">
            <div className="feed-liker-avatar">{(profileName || "Y").charAt(0)}</div>
            <span className="feed-liker-name">You</span>
          </div>
        )}
        {othersCount > 0 && (
          <div className="feed-liker-item">
            <div className="feed-liker-avatar feed-liker-others">+{othersCount}</div>
            <span className="feed-liker-name">{othersCount} other{othersCount !== 1 ? "s" : ""}</span>
          </div>
        )}
        {likeCount === 0 && (
          <p className="feed-likers-empty">No reactions yet</p>
        )}
      </div>
    </div>
  );
}

function FeedAvatar({ src, name = "", className = "feed-avatar" }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initial = String(name).trim().charAt(0).toUpperCase() || "N";

  if (!src || hasError) {
    return <div className={`${className} feed-avatar-fallback`}>{initial}</div>;
  }

  return (
    <img
      src={src}
      className={className}
      alt={name ? `${name} profile` : "Profile"}
      onError={() => setHasError(true)}
    />
  );
}

/* ===== RECURSIVE REPLY COMPONENT ===== */
const ReplyItem = ({ reply, postId, commentId, profileName, formatTime, toggleReplyLike, deleteReply, setReplyingTo, replyingTo, replyText, setReplyText, addReply, depth = 0 }) => {
  const hasReplies = reply.replies && reply.replies.length > 0;
  const isReplying = replyingTo?.replyId === reply.id;

  return (
    <div className="reply-item" style={{ marginLeft: `${depth * 20}px` }}>
      <div className="comment-header-row">
        <b>{reply.user}</b>
        <span className="comment-time">{formatTime(reply.createdAt)}</span>
      </div>
      <p>{formatTextWithMentions(reply.text)}</p>
      <div className="comment-actions">
        <span 
          className="comment-action-btn"
          onClick={() => toggleReplyLike(postId, commentId, reply.id)}
        >
          <Heart size={12} fill={reply.liked ? "red" : "none"} /> {reply.likes}
        </span>
        <span 
          className="comment-action-btn"
          onClick={() => setReplyingTo(isReplying ? null : { postId, commentId, replyId: reply.id })}
        >
          <Reply size={12} /> Reply
        </span>
        {reply.user === profileName && (
          <span
            className="comment-delete"
            onClick={() => deleteReply(postId, commentId, reply.id)}
          >
            Delete
          </span>
        )}
      </div>

      {/* Reply Input */}
      {isReplying && (
        <div className="reply-input-container">
          <textarea
            className="reply-textarea"
            placeholder={`Reply to ${reply.user}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="reply-actions">
            <button className="reply-send-btn" onClick={() => addReply(postId, commentId, reply.id)}>
              Reply
            </button>
            <button className="reply-cancel-btn" onClick={() => {
              setReplyingTo(null);
              setReplyText("");
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recursive Nested Replies */}
      {hasReplies && (
        <div className="replies-container nested-reply">
          {reply.replies.map((nestedReply) => (
            <ReplyItem
              key={nestedReply.id}
              reply={nestedReply}
              postId={postId}
              commentId={commentId}
              profileName={profileName}
              formatTime={formatTime}
              toggleReplyLike={toggleReplyLike}
              deleteReply={deleteReply}
              setReplyingTo={setReplyingTo}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              addReply={addReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Feed({
  profileImage = "",
  profileName = "",
  mode = "feed", // "profile" | "feed"
}) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);

  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");

  const [commentPost, setCommentPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [commentSort, setCommentSort] = useState("newest"); // "newest" | "oldest"
  const [expandedReplies, setExpandedReplies] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [chosenEmojis, setChosenEmojis] = useState({});
  const [likersPopupId, setLikersPopupId] = useState(null);

  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());

  const FEED_API_URL = "http://localhost:5000/api/posts";

  /* ================= POSTS STATE ================= */
  const [posts, setPosts] = useState([]);

  const normalizePost = (post = {}) => ({
    id: Number(post.id ?? post.post_id ?? Date.now()),
    regimental_no: post.regimental_no,
    post_id: Number(post.post_id ?? post.id ?? Date.now()),
    name: post.name || post.full_name || "Cadet",
    role: post.role || post.rank_name || "CADET",
    createdAt: post.createdAt
      ? Number(post.createdAt)
      : post.created_at
      ? new Date(post.created_at).getTime()
      : Date.now(),
    text: post.text ?? post.content_text ?? post.caption ?? "",
    image: post.image || (post.post_type === "image" ? post.media_url : null),
    video: post.video || (post.post_type === "video" ? post.media_url : null),
    likes: Number(post.likes ?? post.likes_count ?? 0),
    likes_count: Number(post.likes_count ?? post.likes ?? 0),
    liked: Boolean(post.liked_by_me ?? post.liked),
    reactionEmoji: post.reaction_emoji_by_me ?? post.reaction_emoji ?? null,
    comments: Array.isArray(post.comments) ? post.comments : [],
    comments_count: Number(
      post.comments_count ?? (Array.isArray(post.comments) ? post.comments.length : 0)
    ),
    views: Number(post.views ?? post.views_count ?? 0),
    avatar: post.avatar || post.profile_image_url || null,
  });

  const getPostLikeCount = (post) => Number(post.likes ?? post.likes_count ?? 0);

  const getPostCommentCount = (post) => {
    if (Array.isArray(post.comments) && post.comments.length > 0) {
      return getTotalCommentCount(post.comments);
    }
    return Number(post.comments_count ?? 0);
  };

    const mapServerComment = (comment = {}) => ({
    id: Number(comment.comment_id ?? comment.id ?? Date.now()),
    user: comment.full_name || comment.user || "Cadet",
    text: comment.content || comment.text || "",
    createdAt: comment.created_at ? new Date(comment.created_at).getTime() : Date.now(),
    likes: Number(comment.likes_count ?? comment.likes ?? 0),
    liked: Boolean(comment.liked_by_me ?? comment.liked),
    pinned: Boolean(comment.is_pinned ?? comment.pinned),
    parentCommentId:
      comment.parent_comment_id === null || comment.parent_comment_id === undefined
        ? null
        : Number(comment.parent_comment_id),
    replies: Array.isArray(comment.replies)
      ? comment.replies.map((reply) => mapServerComment(reply))
      : [],
  });

  const fetchCommentsForPost = async (postId) => {
    const token = localStorage.getItem("token");
    if (!token) return [];

    const response = await fetch(`${FEED_API_URL}/${postId}/comments`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to load comments");
    }

    return Array.isArray(data) ? data.map((comment) => mapServerComment(comment)) : [];
  };

  const refreshCommentsForPost = async (postId) => {
    const comments = await fetchCommentsForPost(postId);

    setPosts((prev) =>
      prev.map((p) =>
        Number(p.id) === Number(postId)
          ? {
              ...p,
              comments,
              comments_count: getTotalCommentCount(comments),
            }
          : p
      )
    );

    return comments;
  };

  const openComments = async (post) => {
    if (commentPost?.id === post.id) { setCommentPost(null); return; }
    setCommentPost(post);

    try {
      await refreshCommentsForPost(post.id);
    } catch (error) {
      console.error("Load Comments Error:", error);
    }
  };  // Helper function to count total comments including all nested replies
  const getTotalCommentCount = (comments) => {
    const countReplies = (replies) => {
      if (!replies || replies.length === 0) return 0;
      return replies.reduce((count, reply) => {
        return count + 1 + countReplies(reply.replies);
      }, 0);
    };

    return comments.reduce((count, comment) => {
      return count + 1 + countReplies(comment.replies);
    }, 0);
  };

  // Helper function to count direct replies only
  const getReplyCount = (replies) => {
    if (!replies || replies.length === 0) return 0;
    return replies.length;
  };

  // Helper function to count all nested replies recursively
  const getAllNestedRepliesCount = (replies) => {
    if (!replies || replies.length === 0) return 0;
    return replies.reduce((count, reply) => {
      return count + 1 + getAllNestedRepliesCount(reply.replies);
    }, 0);
  };

  // Sort comments
  const getSortedComments = (comments) => {
    const sorted = [...comments];
    if (commentSort === "newest") {
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    }
  };

  // Toggle expand/collapse replies - initialize if not exists
  const toggleReplies = (commentId) => {
    setExpandedReplies((prev) => {
      const newState = { ...prev };
      newState[commentId] = !newState[commentId];
      return newState;
    });
  };

  // Initialize expanded replies for comments that have replies when modal opens
  useEffect(() => {
    if (commentPost) {
      const initialExpanded = {};
      commentPost.comments.forEach((c) => {
        if (c.replies && c.replies.length > 0) {
          initialExpanded[c.id] = true; // Default to expanded
        }
      });
      setExpandedReplies((prev) => ({ ...prev, ...initialExpanded }));
    } else {
      // Reset when modal closes
      setExpandedReplies({});
    }
  }, [commentPost]);


  // Pin comment
  const pinComment = async (postId, commentId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${postId}/comment/${commentId}/pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to pin comment");
      }

      const nextComments = await refreshCommentsForPost(postId);
      if (commentPost?.id === postId) {
        setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      }
    } catch (error) {
      console.error("Pin Comment Error:", error);
      alert(error.message || "Failed to pin comment.");
    }
  };

  // Report comment
  const reportComment = async (postId, commentId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${postId}/comment/${commentId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Inappropriate or abusive" }),
      });

      const data = await response.json();
      if (!response.ok && response.status !== 409) {
        throw new Error(data.message || "Unable to report comment");
      }

      alert(response.status === 409 ? "You already reported this comment." : "Comment reported successfully!");
    } catch (error) {
      console.error("Report Comment Error:", error);
      alert(error.message || "Failed to report comment.");
    }
  };

  /* ================= FILTER LOGIC ================= */
  const visiblePosts =
    mode === "profile"
      ? posts.filter((p) => p.name === profileName)
      : posts.filter((p) => p.name !== profileName);

  const recentAnnouncements = [...visiblePosts]
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
    .slice(0, 5);
  const timelinePosts = visiblePosts;

  const getInitial = (name = "") => String(name).trim().charAt(0).toUpperCase() || "N";

  const scrollToPost = (postId) => {
    const target = document.getElementById(`feed-post-${postId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };


  /* ================= CREATE POST (PROFILE ONLY) ================= */
  const createPost = async () => {
    if (!text.trim() && !selectedImageFile && !selectedVideoFile) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    const formData = new FormData();
    formData.append("content_text", text.trim());

    const mediaFile = selectedImageFile || selectedVideoFile;
    if (mediaFile) {
      formData.append("media", mediaFile);
    }

    try {
      setCreatingPost(true);

      const response = await fetch(FEED_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`Failed to create post: ${data.message || "Unknown error"}`);
        return;
      }

      const createdPost = normalizePost({ ...data, name: profileName, role: "CADET" });
      setPosts((prev) => [createdPost, ...prev.filter((item) => Number(item.id) !== Number(createdPost.id))]);

      setText("");
      setSelectedImage(null);
      setSelectedVideo(null);
      setSelectedImageFile(null);
      setSelectedVideoFile(null);
    } catch (error) {
      console.error("Create Post Error:", error);
      alert("Unable to create post.");
    } finally {
      setCreatingPost(false);
    }
  };

  /* ================= LIKE POST ================= */
  const toggleLike = async (id, reactionEmoji = null) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    const currentPost = posts.find((p) => Number(p.id) === Number(id));
    if (!currentPost) return;

    const wasLiked = Boolean(currentPost.liked);
    const previousLikes = Number(currentPost.likes ?? currentPost.likes_count ?? 0);
    const previousReactionEmoji = currentPost.reactionEmoji ?? null;
    const isReactionUpdate = wasLiked && Boolean(reactionEmoji);

    setPosts((prev) =>
      prev.map((p) =>
        Number(p.id) === Number(id)
          ? {
              ...p,
              liked: isReactionUpdate ? p.liked : !p.liked,
              likes: isReactionUpdate
                ? (p.likes || 0)
                : p.liked
                ? Math.max((p.likes || 0) - 1, 0)
                : (p.likes || 0) + 1,
              likes_count: isReactionUpdate
                ? (p.likes_count || p.likes || 0)
                : p.liked
                ? Math.max((p.likes_count || p.likes || 0) - 1, 0)
                : (p.likes_count || p.likes || 0) + 1,
              reactionEmoji: reactionEmoji || (isReactionUpdate ? p.reactionEmoji : p.liked ? null : "👍"),
            }
          : p
      )
    );

    if (reactionEmoji) {
      setChosenEmojis((prev) => ({ ...prev, [id]: reactionEmoji }));
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${id}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reactionEmoji ? { reaction_emoji: reactionEmoji } : {}),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update like");
      }

      const isLikedNow =
        data.message === "Liked"
          ? true
          : data.message === "Unliked"
          ? false
          : data.message === "Reaction updated"
          ? true
          : !wasLiked;
      const nextLikes = Number(data.likes_count ?? previousLikes + (isLikedNow ? 1 : -1));
      const nextReactionEmoji =
        data.reaction_emoji ?? (isLikedNow ? reactionEmoji || previousReactionEmoji || "👍" : null);

      setPosts((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(id)
            ? {
                ...p,
                liked: isLikedNow,
                likes: Math.max(nextLikes, 0),
                likes_count: Math.max(nextLikes, 0),
                reactionEmoji: nextReactionEmoji,
              }
            : p
        )
      );

      setChosenEmojis((prev) => {
        const next = { ...prev };
        if (nextReactionEmoji) next[id] = nextReactionEmoji;
        else delete next[id];
        return next;
      });
    } catch (error) {
      console.error("Toggle Like Error:", error);
      setPosts((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(id)
            ? {
                ...p,
                liked: wasLiked,
                likes: previousLikes,
                likes_count: previousLikes,
                reactionEmoji: previousReactionEmoji,
              }
            : p
        )
      );
      setChosenEmojis((prev) => {
        const next = { ...prev };
        if (previousReactionEmoji) next[id] = previousReactionEmoji;
        else delete next[id];
        return next;
      });
      alert("Failed to update like.");
    }
  };

  /* ================= DELETE POST ================= */
  const deletePost = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to delete post");
      }

      setPosts((prev) => prev.filter((p) => Number(p.id) !== Number(id)));
      setMenuOpen(null);
    } catch (error) {
      console.error("Delete Post Error:", error);
      alert("Failed to delete post.");
    }
  };

  /* ================= EDIT POST ================= */
  const openEditModal = (post) => {
    setEditingPost(post);
    setEditText(post.text);
    setMenuOpen(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPost?.id || !editText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${editingPost.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content_text: editText.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update post");
      }

      const nextText = data.content_text ?? data.caption ?? editText.trim();
      setPosts((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(editingPost.id)
            ? { ...p, text: nextText }
            : p
        )
      );
      setEditingPost(null);
    } catch (error) {
      console.error("Update Post Error:", error);
      alert("Failed to update post.");
    }
  };

    /* ================= COMMENTS ================= */
  const addComment = async () => {
    const content = commentText.trim();
    if (!content || !commentPost?.id) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${commentPost.id}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to add comment");
      }

      const nextComments = await refreshCommentsForPost(commentPost.id);
      setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      setCommentText("");
    } catch (error) {
      console.error("Add Comment Error:", error);
      alert("Failed to add comment.");
    }
  };

  const toggleCommentLike = async (postId, commentId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${postId}/comment/${commentId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to like comment");
      }

      const nextComments = await refreshCommentsForPost(postId);
      if (commentPost?.id === postId) {
        setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      }
    } catch (error) {
      console.error("Toggle Comment Like Error:", error);
      alert("Failed to update comment like.");
    }
  };

  const deleteComment = async (postId, commentId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${FEED_API_URL}/${postId}/comment/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to delete comment");
      }

      const nextComments = await refreshCommentsForPost(postId);
      if (commentPost?.id === postId) {
        setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      }
    } catch (error) {
      console.error("Delete Comment Error:", error);
      alert("Failed to delete comment.");
    }
  };

  const findCommentById = (comments = [], commentId) => {
    for (const comment of comments) {
      if (Number(comment.id) === Number(commentId)) {
        return comment;
      }
      const nested = findCommentById(comment.replies || [], commentId);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  const editComment = (postId, commentId) => {
    const post = posts.find((p) => p.id === postId);
    const comment = findCommentById(post?.comments || [], commentId);
    if (comment) {
      setEditingComment({ postId, commentId });
      setEditCommentText(comment.text);
    }
  };

  const saveEditComment = async () => {
    if (!editingComment || !editCommentText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const response = await fetch(
        `${FEED_API_URL}/${editingComment.postId}/comment/${editingComment.commentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: editCommentText.trim() }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update comment");
      }

      const nextComments = await refreshCommentsForPost(editingComment.postId);
      if (commentPost?.id === editingComment.postId) {
        setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      }

      setEditingComment(null);
      setEditCommentText("");
    } catch (error) {
      console.error("Update Comment Error:", error);
      alert("Failed to update comment.");
    }
  };

  /* ================= REPLIES ================= */
  const addReply = async (postId, commentId, parentReplyId = null) => {
    if (!replyText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      const targetParentId = parentReplyId || commentId;

      const response = await fetch(`${FEED_API_URL}/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: replyText.trim(),
          parent_comment_id: targetParentId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to add reply");
      }

      const nextComments = await refreshCommentsForPost(postId);
      if (commentPost?.id === postId) {
        setCommentPost((prev) => (prev ? { ...prev, comments: nextComments } : prev));
      }

      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Add Reply Error:", error);
      alert("Failed to add reply.");
    }
  };

  const toggleReplyLike = async (postId, commentId, replyId) => {
    await toggleCommentLike(postId, replyId);
  };

  const deleteReply = async (postId, commentId, replyId) => {
    await deleteComment(postId, replyId);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchFeed = async () => {
      try {
        const response = await fetch(FEED_API_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) return;

        const list = Array.isArray(data) ? data.map((item) => normalizePost(item)) : [];
        setPosts(list);
      } catch (error) {
        console.error("Fetch Feed Error:", error);
      }
    };

    fetchFeed();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = connectFeedSocket(token) || getFeedSocket();
    if (!socket) return;

    const handleNewPost = (incomingPost) => {
      if (!incomingPost) return;

      const normalized = normalizePost(incomingPost);
      setPosts((prev) => [normalized, ...prev.filter((item) => Number(item.id) !== Number(normalized.id))]);
    };

    const handleDeletePost = ({ post_id }) => {
      setPosts((prev) => prev.filter((item) => Number(item.id) !== Number(post_id)));
    };

    const handleUpdatePost = (incomingPost) => {
      if (!incomingPost) return;

      const normalized = normalizePost(incomingPost);
      setPosts((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(normalized.id)
            ? { ...item, text: normalized.text }
            : item
        )
      );
    };

    const handleLikeUpdate = ({ post_id, likes_count }) => {
      setPosts((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(post_id)
            ? { ...item, likes: Number(likes_count), likes_count: Number(likes_count) }
            : item
        )
      );
    };

    const handleCommentUpdate = ({ post_id, comments_count }) => {
      setPosts((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(post_id)
            ? { ...item, comments_count: Number(comments_count) }
            : item
        )
      );
    };

    const handleAvatarUpdate = ({ regimental_no, profile_image_url }) => {
  setPosts((prev) =>
    prev.map((post) =>
      post.regimental_no === regimental_no
        ? {
            ...post,
            avatar: profile_image_url + "?v=" + Date.now(),
          }
        : post
    )
  );
};

    socket.on("feed:new_post", handleNewPost);
    socket.on("feed:delete_post", handleDeletePost);
    socket.on("feed:update_post", handleUpdatePost);
    socket.on("feed:like_update", handleLikeUpdate);
    socket.on("feed:comment_update", handleCommentUpdate);
    socket.on("feed:avatar_update", handleAvatarUpdate);

    return () => {
      socket.off("feed:new_post", handleNewPost);
      socket.off("feed:delete_post", handleDeletePost);
      socket.off("feed:update_post", handleUpdatePost);
      socket.off("feed:like_update", handleLikeUpdate);
      socket.off("feed:comment_update", handleCommentUpdate);
      socket.off("feed:avatar_update", handleAvatarUpdate);
    };
  }, []);

  const incrementPostView = async (postId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${FEED_API_URL}/${postId}/view`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) return;

      setPosts((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(postId)
            ? {
                ...p,
                views: Number(data.views_count ?? (p.views || 0) + 1),
              }
            : p
        )
      );
    } catch (error) {
      console.error("Increment View Error:", error);
    }
  };

  useEffect(() => {
    posts.forEach((post) => {
      if (!post?.id) return;
      if (viewedPostIdsRef.current.has(post.id)) return;

      viewedPostIdsRef.current.add(post.id);
      incrementPostView(post.id);
    });
  }, [posts]);
  // Update commentPost when posts change to keep modal in sync
  useEffect(() => {
    if (commentPost) {
      const updatedPost = posts.find((p) => p.id === commentPost.id);
      if (updatedPost) {
        setCommentPost(updatedPost);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  return (
    <div className="suo-feed">
      {/* ================= EDIT POST MODAL ================= */}
      {editingPost && (
        <div className="edit-modal-overlay" onClick={() => setEditingPost(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h2>Edit Post</h2>
              <button className="edit-close-btn" onClick={() => setEditingPost(null)}>
                <X size={20} />
              </button>
            </div>

            <textarea
              className="edit-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            <button className="edit-save-btn" onClick={handleSaveEdit}>
              Save Changes
            </button>
          </div>
        </div>
      )}


      {/* ================= FEED ================= */}
      <div className="feed-wrapper">
        <h1 className="feed-title">Activity Feed</h1>
        <h3 className="feed-subtitle">Stay Connected With Your NCC Community</h3>

        {/* ===== CREATE POST ===== */}
        {true && (
          <div className="feed-create-card">
            <div className="feed-input-row">
              <FeedAvatar src={profileImage} name={profileName} />
              <input
                className="feed-input"
                placeholder={`Share an update, ${profileName.split(" ")[0]}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {(selectedImage || selectedVideo) && (
              <div className="feed-preview-wrap">
                <button
                  type="button"
                  className="feed-preview-remove"
                  onClick={() => {
                    setSelectedImage(null);
                    setSelectedVideo(null);
                    setSelectedImageFile(null);
                    setSelectedVideoFile(null);
                  }}
                >
                  <X size={14} />
                </button>

                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt="Selected preview"
                    className="feed-preview-media"
                  />
                ) : null}

                {selectedVideo ? (
                  <video className="feed-preview-media" controls preload="metadata">
                    <source src={selectedVideo} />
                  </video>
                ) : null}

                <p className="feed-preview-label">
                  {selectedImageFile?.name || selectedVideoFile?.name}
                </p>
              </div>
            )}

            <div className="divider" />

            <div className="feed-bottom-row">
              <div className="feed-media-actions">
                <button onClick={() => imageRef.current.click()}>
                  <ImageIcon size={18} /> Image
                </button>
                <button onClick={() => videoRef.current.click()}>
                  <Video size={18} /> Video
                </button>
              </div>

              <button className="feed-post-btn" onClick={createPost} disabled={creatingPost}>
                {creatingPost ? "Posting..." : "Post"} <Send size={16} />
              </button>
            </div>

            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSelectedImage(URL.createObjectURL(file));
                setSelectedImageFile(file);
                setSelectedVideo(null);
                setSelectedVideoFile(null);
              }}
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSelectedVideo(URL.createObjectURL(file));
                setSelectedVideoFile(file);
                setSelectedImage(null);
                setSelectedImageFile(null);
              }}
            />
          </div>
        )}
        <aside className="feed-side-panel">
          <h3 className="feed-side-title">Recent Posts</h3>
          {recentAnnouncements.length === 0 ? (
            <p className="feed-side-empty">No recent posts yet.</p>
          ) : (
            recentAnnouncements.map((announcement) => (
              <div className="feed-side-item" key={`pinned-${announcement.id}`}>
                <div className="feed-side-head">
                  <div className="feed-side-avatar">{getInitial(announcement.name)}</div>
                  <div className="feed-side-author">{announcement.name}</div>
                  <span className="feed-side-tag">Recent</span>
                </div>
                <p className="feed-side-text">{announcement.text || "Shared an update."}</p>
                <button
                  type="button"
                  className="feed-side-link"
                  onClick={() => scrollToPost(announcement.id)}
                >
                  View post &rsaquo;
                </button>
              </div>
            ))
          )}
        </aside>



        {/* ===== POSTS ===== */}
        {timelinePosts.map((p) => (
          <div className={`feed-card${commentPost?.id === p.id ? " feed-card-expanded" : ""}`} key={p.id} id={`feed-post-${p.id}`}>
            <div className="feed-card-content">
            <div className="feed-card-header">
              <div className="feed-user">
                <FeedAvatar src={p.avatar} name={p.name} />
                <div>
                  <h3>
                    {p.name} <span className="feed-role">{p.role}</span>
                  </h3>
                  <p className="feed-meta">
                    {formatTime(p.createdAt)} &bull; PUBLIC FEED
                  </p>
                </div>
              </div>

              {mode === "profile" && p.name === profileName && (
                <div className="menu-wrapper">
                  <MoreHorizontal onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)} />
                  {menuOpen === p.id && (
                    <div className="menu-dropdown">
                      <button onClick={() => openEditModal(p)}>Edit</button>
                      <button className="danger" onClick={() => deletePost(p.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="feed-text">{formatTextWithMentions(p.text)}</p>

            {p.image ? (
              <img src={p.image} className="feed-media-image" alt="Post media" />
            ) : null}

            {p.video ? (
              <video className="feed-media-video" controls preload="metadata">
                <source src={p.video} />
              </video>
            ) : null}

            {/* Post Statistics */}
            <div className="post-stats">
              <span className="stat-item">
                <Eye size={13} /> {p.views || 0} views
              </span>
              {getPostLikeCount(p) > 0 ? (
                <span className="stat-item feed-reactions-stat" onClick={() => setLikersPopupId(likersPopupId === p.id ? null : p.id)}>
                  <span className="feed-reaction-icons">
                    {REACTION_EMOJIS
                      .filter((_, i) => i === 0 || ((chosenEmojis[p.id] ?? p.reactionEmoji) && (chosenEmojis[p.id] ?? p.reactionEmoji) === REACTION_EMOJIS[i]?.icon))
                      .slice(0, 3)
                      .map((item, i) => (
                        <span key={item.key} className="feed-reaction-icon-circle" style={{ zIndex: 3 - i }}>
                          {item.icon}
                        </span>
                      ))}
                  </span>
                  {getPostLikeCount(p)} reactions
                  {likersPopupId === p.id && (
                    <LikersPopup
                      likeCount={getPostLikeCount(p)}
                      liked={p.liked}
                      profileName={profileName}
                      onClose={() => setLikersPopupId(null)}
                    />
                  )}
                </span>
              ) : null}
              {getPostCommentCount(p) > 0 ? (
                <span className="stat-item">{getPostCommentCount(p)} comment{getPostCommentCount(p) !== 1 ? "s" : ""}</span>
              ) : null}
            </div>

            <div className="feed-actions-row">
              <FeedReactButton
                liked={p.liked}
                likeCount={getPostLikeCount(p)}
                onToggleLike={(emoji) => toggleLike(p.id, emoji)}
                chosenEmoji={chosenEmojis[p.id] ?? p.reactionEmoji}
                onPickEmoji={(emoji) => setChosenEmojis((prev) => ({ ...prev, [p.id]: emoji }))}
              />

              <button
                type="button"
                className="feed-action-btn"
                onClick={() => openComments(p)}
              >
                <MessageCircle size={15} />
                <span>Comment</span>
              </button>
            </div>
            </div>{/* end feed-card-content */}

            {commentPost?.id === p.id && (
              <div className="feed-comment-panel">
                <div className="comment-panel-header">
                  <h3>Comments</h3>
                  <div className="comment-panel-actions">
                    <select
                      className="comment-sort-select"
                      value={commentSort}
                      onChange={(e) => setCommentSort(e.target.value)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                    <button className="comment-panel-close" onClick={() => setCommentPost(null)}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="comment-panel-list">
                  {getSortedComments(p.comments)
                    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                    .map((c) => (
                    <div key={c.id} className={`comment-item-popup ${c.pinned ? "pinned-comment" : ""}`}>
                      <div className="comment-header-row">
                        <div className="comment-user-info">
                          <b>{c.user}</b>
                          {c.pinned && <Pin size={12} className="pinned-icon" />}
                        </div>
                        <span className="comment-time">{formatTime(c.createdAt)}</span>
                      </div>

                      {editingComment?.postId === p.id && editingComment?.commentId === c.id ? (
                        <div className="comment-edit-mode">
                          <textarea
                            className="comment-edit-textarea"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                          />
                          <div className="comment-edit-actions">
                            <button className="comment-save-btn" onClick={saveEditComment}>Save</button>
                            <button className="comment-cancel-btn" onClick={() => { setEditingComment(null); setEditCommentText(""); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p>{formatTextWithMentions(c.text)}</p>
                      )}

                      <div className="comment-actions">
                        <span className="comment-action-btn" onClick={() => toggleCommentLike(p.id, c.id)}>
                          <Heart size={14} fill={c.liked ? "red" : "none"} /> {c.likes}
                        </span>
                        <span className="comment-action-btn" onClick={() => setReplyingTo(replyingTo?.commentId === c.id ? null : { postId: p.id, commentId: c.id })}>
                          <Reply size={14} /> Reply
                        </span>
                        {c.user === profileName && (
                          <>
                            <span className="comment-action-btn" onClick={() => editComment(p.id, c.id)}><Edit2 size={14} /> Edit</span>
                            <span className="comment-delete" onClick={() => deleteComment(p.id, c.id)}>Delete</span>
                          </>
                        )}
                        {p.name === profileName && (
                          <span className="comment-action-btn" onClick={() => pinComment(p.id, c.id)} title={c.pinned ? "Unpin comment" : "Pin comment"}>
                            <Pin size={14} fill={c.pinned ? "#a6c34e" : "none"} />
                          </span>
                        )}
                        {c.user !== profileName && (
                          <span className="comment-action-btn" onClick={() => reportComment(p.id, c.id)} title="Report comment">
                            <Flag size={14} />
                          </span>
                        )}
                      </div>

                      {c.replies && c.replies.length > 0 && (
                        <div className="view-replies-section">
                          <button className="view-replies-btn" onClick={() => toggleReplies(c.id)}>
                            {expandedReplies[c.id] ? (<><ChevronUp size={14} /> Hide {getAllNestedRepliesCount(c.replies)} replies</>) : (<><ChevronDown size={14} /> View {getAllNestedRepliesCount(c.replies)} replies</>)}
                          </button>
                        </div>
                      )}

                      {c.replies && c.replies.length > 0 && expandedReplies[c.id] && (
                        <div className="replies-container">
                          {c.replies.map((reply) => (
                            <ReplyItem key={reply.id} reply={reply} postId={p.id} commentId={c.id} profileName={profileName} formatTime={formatTime} toggleReplyLike={toggleReplyLike} deleteReply={deleteReply} setReplyingTo={setReplyingTo} replyingTo={replyingTo} replyText={replyText} setReplyText={setReplyText} addReply={addReply} depth={0} />
                          ))}
                        </div>
                      )}

                      {replyingTo?.commentId === c.id && !replyingTo?.replyId && (
                        <div className="reply-input-container">
                          <textarea className="reply-textarea" placeholder={`Reply to ${c.user}...`} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                          <div className="reply-actions">
                            <button className="reply-send-btn" onClick={() => addReply(p.id, c.id)}>Reply</button>
                            <button className="reply-cancel-btn" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="comment-panel-input">
                  <textarea className="comment-panel-textarea" placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <button className="comment-panel-send" onClick={addComment}>Post</button>
                </div>
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}




