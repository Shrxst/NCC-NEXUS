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
  profileImage = "https://i.pravatar.cc/150",
  profileName = "Shami Dubey",
  mode = "feed", // "profile" | "feed"
}) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

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

  const imageRef = useRef(null);
  const videoRef = useRef(null);

  /* ================= POSTS STATE ================= */
  const [posts, setPosts] = useState([
    {
      id: 1,
      name: "Shami Dubey",
      role: "CADET",
      createdAt: Date.now() - 3600000,
      text: "Honored to represent our unit at the National Integration Camp.",
      image: null,
      video: null,
      likes: 12,
      liked: false,
      comments: [],
      views: 156,
    },
    {
      id: 2,
      name: "Priya Sharma",
      role: "CADET",
      createdAt: Date.now() - 7200000,
      text: "Proud to be part of NCC 🇮🇳",
      image: null,
      video: null,
      likes: 7,
      liked: false,
      comments: [],
      views: 89,
    },
  ]);

  // Helper function to count total comments including all nested replies
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
  const pinComment = (postId, commentId) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) => ({
                ...c,
                pinned: c.id === commentId ? !c.pinned : false,
              })),
            }
          : p
      )
    );
  };

  // Report comment
  const reportComment = (postId, commentId) => {
    alert("Comment reported successfully!");
  };

  /* ================= FILTER LOGIC ================= */
  const visiblePosts =
    mode === "profile"
      ? posts.filter((p) => p.name === profileName)
      : posts.filter((p) => p.name !== profileName);

  /* ================= CREATE POST (PROFILE ONLY) ================= */
  const createPost = () => {
    if (!text && !selectedImage && !selectedVideo) return;

    setPosts([
      {
        id: Date.now(),
        name: profileName,
        role: "CADET",
        createdAt: Date.now(),
        text,
        image: selectedImage,
        video: selectedVideo,
        likes: 0,
        liked: false,
        comments: [],
        views: 0,
      },
      ...posts,
    ]);

    setText("");
    setSelectedImage(null);
    setSelectedVideo(null);
  };

  /* ================= LIKE POST ================= */
  const toggleLike = (id) => {
    setPosts(
      posts.map((p) =>
        p.id === id
          ? {
              ...p,
              liked: !p.liked,
              likes: p.liked ? p.likes - 1 : p.likes + 1,
            }
          : p
      )
    );
  };

  /* ================= DELETE POST ================= */
  const deletePost = (id) => {
    setPosts(posts.filter((p) => p.id !== id));
    setMenuOpen(null);
  };

  /* ================= EDIT POST ================= */
  const openEditModal = (post) => {
    setEditingPost(post);
    setEditText(post.text);
    setMenuOpen(null);
  };

  const handleSaveEdit = () => {
    setPosts(
      posts.map((p) =>
        p.id === editingPost.id ? { ...p, text: editText } : p
      )
    );
    setEditingPost(null);
  };

  /* ================= COMMENTS ================= */
  const addComment = () => {
    if (!commentText.trim()) return;

    setPosts(
      posts.map((p) =>
        p.id === commentPost.id
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: Date.now(),
                  user: profileName,
                  text: commentText,
                  createdAt: Date.now(),
                  likes: 0,
                  liked: false,
                  replies: [],
                },
              ],
            }
          : p
      )
    );

    setCommentText("");
  };

  const toggleCommentLike = (postId, commentId) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      liked: !c.liked,
                      likes: c.liked ? c.likes - 1 : c.likes + 1,
                    }
                  : c
              ),
            }
          : p
      )
    );
  };

  const deleteComment = (postId, commentId) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.filter((c) => c.id !== commentId),
            }
          : p
      )
    );
  };

  const editComment = (postId, commentId) => {
    const post = posts.find((p) => p.id === postId);
    const comment = post?.comments.find((c) => c.id === commentId);
    if (comment) {
      setEditingComment({ postId, commentId });
      setEditCommentText(comment.text);
    }
  };

  const saveEditComment = () => {
    if (!editCommentText.trim()) return;

    setPosts(
      posts.map((p) =>
        p.id === editingComment.postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === editingComment.commentId
                  ? { ...c, text: editCommentText }
                  : c
              ),
            }
          : p
      )
    );

    setEditingComment(null);
    setEditCommentText("");
  };

  /* ================= REPLIES ================= */
  // Recursive function to add reply at any nesting level
  const addReplyToReplies = (replies, targetId, newReply) => {
    return replies.map((reply) => {
      if (reply.id === targetId) {
        return {
          ...reply,
          replies: [...(reply.replies || []), newReply],
        };
      }
      if (reply.replies && reply.replies.length > 0) {
        return {
          ...reply,
          replies: addReplyToReplies(reply.replies, targetId, newReply),
        };
      }
      return reply;
    });
  };

  const addReply = (postId, commentId, parentReplyId = null) => {
    if (!replyText.trim()) return;

    const newReply = {
      id: Date.now(),
      user: profileName,
      text: replyText,
      createdAt: Date.now(),
      likes: 0,
      liked: false,
      replies: [],
    };

    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      replies: parentReplyId
                        ? // Reply to a reply (unlimited nesting)
                          addReplyToReplies(c.replies || [], parentReplyId, newReply)
                        : // Reply to comment
                          [...(c.replies || []), newReply],
                    }
                  : c
              ),
            }
          : p
      )
    );

    setReplyText("");
    setReplyingTo(null);
  };

  // Recursive function to toggle like at any nesting level
  const toggleLikeInReplies = (replies, targetId) => {
    return replies.map((reply) => {
      if (reply.id === targetId) {
        return {
          ...reply,
          liked: !reply.liked,
          likes: reply.liked ? reply.likes - 1 : reply.likes + 1,
        };
      }
      if (reply.replies && reply.replies.length > 0) {
        return {
          ...reply,
          replies: toggleLikeInReplies(reply.replies, targetId),
        };
      }
      return reply;
    });
  };

  const toggleReplyLike = (postId, commentId, replyId) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      replies: toggleLikeInReplies(c.replies || [], replyId),
                    }
                  : c
              ),
            }
          : p
      )
    );
  };

  // Recursive function to delete reply at any nesting level
  const deleteReplyFromReplies = (replies, targetId) => {
    return replies
      .filter((reply) => reply.id !== targetId)
      .map((reply) => {
        if (reply.replies && reply.replies.length > 0) {
          return {
            ...reply,
            replies: deleteReplyFromReplies(reply.replies, targetId),
          };
        }
        return reply;
      });
  };

  const deleteReply = (postId, commentId, replyId) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      replies: deleteReplyFromReplies(c.replies || [], replyId),
                    }
                  : c
              ),
            }
          : p
      )
    );
  };

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
    <>
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

      {/* ================= COMMENT MODAL ================= */}
      {commentPost && (
        <div className="edit-modal-overlay" onClick={() => setCommentPost(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h2>Comments</h2>
              <div className="comment-header-actions">
                <select
                  className="comment-sort-select"
                  value={commentSort}
                  onChange={(e) => setCommentSort(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <button className="edit-close-btn" onClick={() => setCommentPost(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="comment-popup-list">
              {getSortedComments(commentPost.comments)
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
                  
                  {editingComment?.postId === commentPost.id && editingComment?.commentId === c.id ? (
                    <div className="comment-edit-mode">
                      <textarea
                        className="comment-edit-textarea"
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                      />
                      <div className="comment-edit-actions">
                        <button className="comment-save-btn" onClick={saveEditComment}>
                          Save
                        </button>
                        <button className="comment-cancel-btn" onClick={() => {
                          setEditingComment(null);
                          setEditCommentText("");
                        }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{formatTextWithMentions(c.text)}</p>
                  )}

                  <div className="comment-actions">
                    <span 
                      className="comment-action-btn"
                      onClick={() => toggleCommentLike(commentPost.id, c.id)}
                    >
                      <Heart size={14} fill={c.liked ? "red" : "none"} /> {c.likes}
                    </span>

                    <span 
                      className="comment-action-btn"
                      onClick={() => setReplyingTo(replyingTo?.commentId === c.id ? null : { postId: commentPost.id, commentId: c.id })}
                    >
                      <Reply size={14} /> Reply
                    </span>

                    {c.user === profileName && (
                      <>
                        <span
                          className="comment-action-btn"
                          onClick={() => editComment(commentPost.id, c.id)}
                        >
                          <Edit2 size={14} /> Edit
                        </span>
                        <span
                          className="comment-delete"
                          onClick={() => deleteComment(commentPost.id, c.id)}
                        >
                          Delete
                        </span>
                      </>
                    )}

                    {commentPost.name === profileName && (
                      <span
                        className="comment-action-btn"
                        onClick={() => pinComment(commentPost.id, c.id)}
                        title={c.pinned ? "Unpin comment" : "Pin comment"}
                      >
                        <Pin size={14} fill={c.pinned ? "#a6c34e" : "none"} />
                      </span>
                    )}

                    {c.user !== profileName && (
                      <span
                        className="comment-action-btn"
                        onClick={() => reportComment(commentPost.id, c.id)}
                        title="Report comment"
                      >
                        <Flag size={14} />
                      </span>
                    )}
                  </div>

                  {/* View Replies Count */}
                  {c.replies && c.replies.length > 0 && (
                    <div className="view-replies-section">
                      <button
                        className="view-replies-btn"
                        onClick={() => toggleReplies(c.id)}
                      >
                        {expandedReplies[c.id] ? (
                          <>
                            <ChevronUp size={14} /> Hide {getAllNestedRepliesCount(c.replies)} replies
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} /> View {getAllNestedRepliesCount(c.replies)} replies
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Nested Replies - Unlimited Nesting */}
                  {c.replies && c.replies.length > 0 && expandedReplies[c.id] && (
                    <div className="replies-container">
                      {c.replies.map((reply) => (
                        <ReplyItem
                          key={reply.id}
                          reply={reply}
                          postId={commentPost.id}
                          commentId={c.id}
                          profileName={profileName}
                          formatTime={formatTime}
                          toggleReplyLike={toggleReplyLike}
                          deleteReply={deleteReply}
                          setReplyingTo={setReplyingTo}
                          replyingTo={replyingTo}
                          replyText={replyText}
                          setReplyText={setReplyText}
                          addReply={addReply}
                          depth={0}
                        />
                      ))}
                    </div>
                  )}

                  {/* Reply Input for Comment */}
                  {replyingTo?.commentId === c.id && !replyingTo?.replyId && (
                    <div className="reply-input-container">
                      <textarea
                        className="reply-textarea"
                        placeholder={`Reply to ${c.user}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="reply-actions">
                        <button className="reply-send-btn" onClick={() => addReply(commentPost.id, c.id)}>
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
                </div>
              ))}
            </div>

            <textarea
              className="edit-textarea"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />

            <button className="edit-save-btn" onClick={addComment}>
              Add Comment
            </button>
          </div>
        </div>
      )}

      {/* ================= FEED ================= */}
      <div className="feed-wrapper">
        <h1 className="feed-title">Activity Feed</h1>
        <h3 className="feed-subtitle">Stay Connected With Your NCC Community</h3>

        {/* ===== CREATE POST (PROFILE ONLY) ===== */}
        {mode === "profile" && (
          <div className="feed-create-card">
            <div className="feed-input-row">
              <img src={profileImage} className="feed-avatar" />
              <input
                className="feed-input"
                placeholder={`Share an update, ${profileName.split(" ")[0]}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

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

              <button className="feed-post-btn" onClick={createPost}>
                Post <Send size={16} />
              </button>
            </div>

            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files[0] &&
                setSelectedImage(URL.createObjectURL(e.target.files[0]))
              }
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) =>
                e.target.files[0] &&
                setSelectedVideo(URL.createObjectURL(e.target.files[0]))
              }
            />
          </div>
        )}

        {/* ===== POSTS ===== */}
        {visiblePosts.map((p) => (
          <div className="feed-card" key={p.id}>
            <div className="feed-card-header">
              <div className="feed-user">
                <img src={profileImage} className="feed-avatar" />
                <div>
                  <h3>
                    {p.name} <span className="feed-role">{p.role}</span>
                  </h3>
                  <p className="feed-meta">
                    {formatTime(p.createdAt)} • PUBLIC FEED
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

            {/* Post Statistics */}
            <div className="post-stats">
              <span className="stat-item">
                <Heart size={14} fill="red" /> {p.likes} likes
              </span>
              <span className="stat-item">
                <MessageCircle size={14} /> {getTotalCommentCount(p.comments)} comments
              </span>
              <span className="stat-item">
                <Eye size={14} /> {p.views || 0} views
              </span>
            </div>

            <div className="feed-actions-row">
              <span onClick={() => toggleLike(p.id)}>
                <Heart size={16} fill={p.liked ? "red" : "none"} /> Like
              </span>

              <span onClick={() => setCommentPost(p)}>
                <MessageCircle size={16} /> Comment
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
