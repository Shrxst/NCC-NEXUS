import React, { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck, Sparkles } from "lucide-react";
import CreatePostForm from "./CreatePostForm";
import PostCard from "./PostCard";
import ModerationQueue from "./ModerationQueue";
import PinnedPost from "./PinnedPost";
import FilterBar from "./FilterBar";
import { useRole } from "../../context/RoleContext";
import { COMMUNITY_TAGS } from "../../data/communityData";
import { getStoredRole } from "../../utils/authState";
import { communityApi } from "../../api/communityApi";
import nccLogo from "../assets/ncc-logo.png";
import "./community.css";

const COMMUNITY_LOGO_STORAGE_KEY = "community_custom_logo";
const POLL_DEADLINE_FALLBACK = "2099-12-31T23:59:59.000Z";

const REACTION_TO_BACKEND = {
  salute: "LIKE",
  clap: "LOVE",
  fire: "FIRE",
};

const normalizeCommentRole = (item) => {
  if (item.user_role === "ANO") return "ano";
  if (item.user_role === "ALUMNI") return "alumni";
  if (item.rank_name === "Senior Under Officer") return "suo";
  return "cadet";
};

function mapBackendCommentsToUi(comments = []) {
  const byId = new Map();

  comments.forEach((item) => {
    byId.set(Number(item.comment_id), {
      id: Number(item.comment_id),
      authorRole: normalizeCommentRole(item),
      author: item.username || "NCC Cadet",
      text: item.content || "",
      createdAt: new Date(item.created_at || Date.now()).getTime(),
      parentId: item.parent_comment_id ? Number(item.parent_comment_id) : null,
      replies: [],
    });
  });

  const roots = [];
  byId.forEach((comment) => {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId).replies.push({
        id: comment.id,
        authorRole: comment.authorRole,
        author: comment.author,
        text: comment.text,
        createdAt: comment.createdAt,
      });
      return;
    }
    roots.push({
      id: comment.id,
      authorRole: comment.authorRole,
      author: comment.author,
      text: comment.text,
      createdAt: comment.createdAt,
      replies: comment.replies,
    });
  });

  return roots.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
}

function mapBackendPostToUi(post = {}, comments = []) {
  const type = String(post.post_type || "UPDATE").toLowerCase();
  const pollOptions = Array.isArray(post.poll_results) ? post.poll_results : [];
  const mediaItems = Array.isArray(post.media) ? post.media : [];

  return {
    id: String(post.community_post_id),
    author: post.author_name || "NCC Cadet",
    authorRole: post.author_role || "cadet",
    authorAvatar: post.profile_image_url || "",
    content: post.content || "",
    type,
    timestamp: new Date(post.created_at || Date.now()).getTime(),
    pinned: Boolean(post.is_pinned),
    status: String(post.status || "APPROVED").toLowerCase(),
    canEdit: Boolean(post.can_edit),
    canDelete: Boolean(post.can_delete),
    moderationNote: post.moderation_note || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    eventDetails:
      type === "event"
        ? {
            title: post.title || "NCC Event",
            date: post.event_date || new Date().toISOString(),
            location: post.location || "TBD",
            description: post.content || "",
            eventTag: "Event",
          }
        : null,
    pollDetails:
      type === "poll"
        ? {
            question: post.title || post.content || "Poll",
            options: pollOptions.map((option, index) => ({
              id: option.option_id ? String(option.option_id) : `poll-opt-${post.community_post_id}-${index}`,
              text: option.option_text || `Option ${index + 1}`,
              votes: Number(option.votes || 0),
              selected: Boolean(option.user_selected),
              voters: [],
            })),
            deadline: post.poll_deadline || POLL_DEADLINE_FALLBACK,
            multiple: Boolean(post.allow_multiple_choices),
            anonymous: false,
          }
        : null,
    mediaUrls: mediaItems.filter((item) => item.media_type === "IMAGE").map((item) => item.media_url),
    videoUrls: mediaItems.filter((item) => item.media_type === "VIDEO").map((item) => item.media_url),
    pdfUrls: mediaItems
      .filter((item) => item.media_type === "PDF")
      .map((item) => ({ id: item.media_id, name: item.media_name || "document.pdf", url: item.media_url })),
    reactions: {
      salute: Number(post.reactions?.LIKE || 0),
      clap: Number(post.reactions?.LOVE || 0),
      fire: Number(post.reactions?.FIRE || 0),
    },
    comments,
  };
}

function sortPosts(posts, sortBy) {
  if (sortBy === "oldest") {
    return [...posts].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }
  if (sortBy === "reacted") {
    const score = (post) => Object.values(post.reactions || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    return [...posts].sort((a, b) => score(b) - score(a));
  }
  return [...posts].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

function buildPayload(post) {
  const payload = {
    post_type: String(post.type || "update").toUpperCase(),
    content: String(post.content || "").trim(),
    tags: Array.isArray(post.tags) ? post.tags : [],
    media_urls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
    video_urls: Array.isArray(post.videoUrls) ? post.videoUrls : [],
    pdf_urls: Array.isArray(post.pdfUrls) ? post.pdfUrls : [],
  };

  if (payload.post_type === "EVENT") {
    payload.title = post.eventDetails?.title || "NCC Event";
    payload.event_date = post.eventDetails?.date || new Date().toISOString();
    payload.location = post.eventDetails?.location || "";
  }

  if (payload.post_type === "POLL") {
    payload.title = post.pollDetails?.question || "NCC Poll";
    payload.options = (post.pollDetails?.options || [])
      .map((option) => String(option.text || "").trim())
      .filter(Boolean);
    payload.poll_deadline = post.pollDetails?.deadline || null;
    payload.allow_multiple_choices = Boolean(post.pollDetails?.multiple);
  }

  if (payload.post_type === "UPDATE" && post.eventDetails?.title) {
    payload.title = post.eventDetails.title;
  }

  return payload;
}

export default function CommunityFeed() {
  const { role, canComment, grantPoints } = useRole();
  const effectiveRole = String(getStoredRole() || role || "").toLowerCase();
  const canPost = effectiveRole === "ano" || effectiveRole === "suo";
  const canModerate = effectiveRole === "ano";

  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTag, setSelectedTag] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [communityLogo, setCommunityLogo] = useState(nccLogo);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState("");

  const refreshFeed = async () => {
    try {
      setLoadingFeed(true);
      setFeedError("");
      const feedResponse = await communityApi.getFeed();
      const backendPosts = feedResponse?.data?.data || [];

      const postWithComments = await Promise.all(
        backendPosts.map(async (post) => {
          try {
            const commentsResponse = await communityApi.getComments(post.community_post_id);
            const mappedComments = mapBackendCommentsToUi(commentsResponse?.data?.data || []);
            return mapBackendPostToUi(post, mappedComments);
          } catch {
            return mapBackendPostToUi(post, []);
          }
        })
      );

      setPosts(postWithComments);
    } catch (error) {
      setFeedError(error.message || "Failed to load community feed.");
      setPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    refreshFeed();
  }, []);

  useEffect(() => {
    const savedLogo = localStorage.getItem(COMMUNITY_LOGO_STORAGE_KEY);
    if (savedLogo) {
      setCommunityLogo(savedLogo);
    }
  }, []);

  const approvedPosts = useMemo(() => posts.filter((post) => post.status === "approved"), [posts]);
  const pendingPosts = useMemo(() => posts.filter((post) => post.status === "pending"), [posts]);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const filtered = approvedPosts.filter((post) => {
      if (filter !== "all" && post.type !== filter) return false;
      if (selectedTag !== "all" && !(post.tags || []).includes(selectedTag)) return false;
      if (!normalizedQuery) return true;
      const haystack = `${post.author} ${post.content} ${post.eventDetails?.title || ""} ${(post.tags || []).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return sortPosts(filtered, sortBy);
  }, [approvedPosts, filter, selectedTag, search, sortBy]);

  const pinnedPosts = visiblePosts.filter((post) => post.pinned);
  const normalPosts = visiblePosts.filter((post) => !post.pinned);

  const upsertPost = async (newPost) => {
    if (!canPost) return;

    try {
      if (editingPost?.id) {
        await communityApi.updatePost(editingPost.id, buildPayload(newPost), newPost.mediaFiles);
      } else {
        await communityApi.createPost(buildPayload(newPost), newPost.mediaFiles);
      }
      grantPoints(5, newPost.type === "media" ? "media_shooting" : "post");
      await refreshFeed();
      setEditingPost(null);
    } catch (error) {
      throw new Error(error.message || "Failed to save post.");
    }
  };

  const handleDelete = async (postId) => {
    try {
      await communityApi.deletePost(postId);
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to delete post.");
    }
  };

  const handlePinToggle = async (postId) => {
    try {
      await communityApi.togglePin(postId);
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to update pin status.");
    }
  };

  const handleReact = async (postId, reactionType) => {
    const reaction = REACTION_TO_BACKEND[reactionType];
    if (!reaction) return;
    try {
      await communityApi.reactToPost(postId, reaction);
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to react to post.");
    }
  };

  const handleVote = async (postId, selectedOptions) => {
    const optionId = selectedOptions?.[0];
    if (!optionId) return;
    try {
      const response = await communityApi.votePoll(postId, Number(optionId));
      const voteResult = response?.data || {};
      if (voteResult.changed === false || voteResult.unchanged === true) {
        return;
      }
      grantPoints(2, "vote");
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to submit vote.");
    }
  };

  const handleAddComment = async (postId, comment) => {
    try {
      await communityApi.addComment(postId, {
        content: String(comment.text || "").trim(),
      });
      await refreshFeed();
      grantPoints(2, "comment");
    } catch (error) {
      alert(error.message || "Failed to add comment.");
    }
  };

  const handleAddReply = async (postId, commentId, reply) => {
    try {
      await communityApi.addComment(postId, {
        content: String(reply.text || "").trim(),
        parent_comment_id: Number(commentId),
      });
      await refreshFeed();
      grantPoints(2, "comment");
    } catch (error) {
      alert(error.message || "Failed to add reply.");
    }
  };

  const handleApprove = async (postId) => {
    try {
      await communityApi.approvePost(postId);
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to approve post.");
    }
  };

  const handleReject = async (postId, reason) => {
    try {
      await communityApi.rejectPost(postId, reason || "");
      await refreshFeed();
    } catch (error) {
      alert(error.message || "Failed to reject post.");
    }
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result) return;
      setCommunityLogo(result);
      localStorage.setItem(COMMUNITY_LOGO_STORAGE_KEY, result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="community-page">
      <div className="community-layout">
        <section className="community-left-column">
          <div className="community-hero">
            <div className="community-title-icon">
              <img src={communityLogo} alt="Community Logo" className="community-title-logo" />
            </div>
            <div>
              <h1>Community Updates</h1>
              <p>Updates, events, polls &amp; media</p>
              <div className="community-title-tricolor" />
              <div className="community-hero-badges">
                <span className="community-hero-badge">
                  <Sparkles size={14} />
                  {visiblePosts.length} Active Posts
                </span>
                {canModerate ? (
                  <span className="community-hero-badge caution">
                    <ShieldCheck size={14} />
                    {pendingPosts.length} Pending Review
                  </span>
                ) : null}
              </div>
            </div>
            <label className="community-logo-upload-btn">
              Change Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
            {canPost ? (
              <button
                type="button"
                className="community-new-btn"
                onClick={() => {
                  setEditingPost(null);
                  setShowCreateModal(true);
                }}
              >
                <Plus size={16} />
                New Post
              </button>
            ) : null}
          </div>

          <FilterBar
            filter={filter}
            search={search}
            sortBy={sortBy}
            selectedTag={selectedTag}
            tags={COMMUNITY_TAGS}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onSortChange={setSortBy}
            onTagChange={setSelectedTag}
          />

          {canModerate ? <ModerationQueue posts={pendingPosts} onApprove={handleApprove} onReject={handleReject} /> : null}

          <section className="community-post-stack">
            {loadingFeed ? <p className="community-muted-text">Loading community feed...</p> : null}
            {!loadingFeed && feedError ? <p className="community-muted-text">{feedError}</p> : null}

            {pinnedPosts.map((post) => (
              <PinnedPost
                key={post.id}
                post={post}
                role={effectiveRole}
                canEdit={post.canEdit}
                canDelete={post.canDelete}
                canPost={canPost}
                canComment={canComment}
                onEdit={(value) => {
                  setEditingPost(value);
                  setShowCreateModal(true);
                }}
                onDelete={handleDelete}
                onPin={handlePinToggle}
                onReact={handleReact}
                onVote={handleVote}
                onAddComment={handleAddComment}
                onAddReply={handleAddReply}
              />
            ))}

            {normalPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                role={effectiveRole}
                canEdit={post.canEdit}
                canDelete={post.canDelete}
                canPost={canPost}
                canComment={canComment}
                onEdit={(value) => {
                  setEditingPost(value);
                  setShowCreateModal(true);
                }}
                onDelete={handleDelete}
                onPin={handlePinToggle}
                onReact={handleReact}
                onVote={handleVote}
                onAddComment={handleAddComment}
                onAddReply={handleAddReply}
              />
            ))}

            {!loadingFeed && !visiblePosts.length ? (
              <p className="community-muted-text">No posts found for selected filters.</p>
            ) : null}
          </section>
        </section>
      </div>

      {showCreateModal ? (
        <CreatePostForm
          role={effectiveRole}
          initialPost={editingPost}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPost(null);
          }}
          onSubmit={upsertPost}
        />
      ) : null}
    </div>
  );
}
