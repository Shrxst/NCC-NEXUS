import React, { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck, Sparkles } from "lucide-react";
import CreatePostForm from "./CreatePostForm";
import PostCard from "./PostCard";
import ModerationQueue from "./ModerationQueue";
import PinnedPost from "./PinnedPost";
import FilterBar from "./FilterBar";
import { useRole } from "../../context/RoleContext";
import { COMMUNITY_STORAGE_KEY, COMMUNITY_TAGS, defaultCommunityPosts } from "../../data/communityData";
import { API_BASE_URL } from "../../api/config";
import { resolveProfileImage } from "../../utils/profileImage";
import { getStoredRole } from "../../utils/authState";
import nccLogo from "../assets/ncc-logo.png";
import "./community.css";

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

export default function CommunityFeed() {
  const { role, canComment, grantPoints } = useRole();
  const effectiveRole = String(getStoredRole() || role || "").toLowerCase();
  const canPost = effectiveRole === "ano" || effectiveRole === "suo";
  const canEdit = effectiveRole === "ano" || effectiveRole === "suo";
  const canModerate = effectiveRole === "ano";
  const [posts, setPosts] = useState(defaultCommunityPosts);
  const [currentUserName, setCurrentUserName] = useState(effectiveRole ? effectiveRole.toUpperCase() : "CADET");
  const [currentUserAvatar, setCurrentUserAvatar] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTag, setSelectedTag] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (saved) {
      try {
        setPosts(JSON.parse(saved));
      } catch {
        setPosts(defaultCommunityPosts);
      }
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    })();
    const localName = user?.name || user?.full_name || "";
    const localAvatar = user?.profile_image_url || user?.avatar || "";

    if (localName) setCurrentUserName(localName);
    if (localAvatar) setCurrentUserAvatar(localAvatar);

    if (!token) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cadet/profile?ts=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.name) setCurrentUserName(data.name);
        if (data?.profile_image_url) {
          const resolved = await resolveProfileImage(data.profile_image_url, localAvatar || "");
          setCurrentUserAvatar(resolved || data.profile_image_url);
        }
      } catch {
        // keep local fallback values
      }
    };

    fetchProfile();
  }, [effectiveRole, role]);

  useEffect(() => {
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

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

  const upsertPost = (newPost) => {
    if (!canPost && !editingPost) return;
    if (!canEdit && editingPost) return;

    setPosts((prev) => {
      const exists = prev.some((post) => post.id === newPost.id);
      if (exists) {
        return prev.map((post) =>
          post.id === newPost.id
            ? {
                ...post,
                ...newPost,
                authorAvatar: newPost.authorAvatar || post.authorAvatar || "",
              }
            : post
        );
      }
      return [
        {
          ...newPost,
          author: newPost.author || currentUserName || effectiveRole.toUpperCase(),
          authorRole: newPost.authorRole || effectiveRole,
          authorAvatar: newPost.authorAvatar || currentUserAvatar || "",
          status: canPost ? "approved" : "pending",
          comments: newPost.comments || [],
          reactions: newPost.reactions || { salute: 0, fire: 0, clap: 0 },
        },
        ...prev,
      ];
    });
    if (!editingPost) grantPoints(5, newPost.type === "media" ? "media_shooting" : "post");
  };

  const handleDelete = (postId) => {
    if (!canEdit) return;
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const handlePinToggle = (postId) => {
    if (!canPost) return;
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)));
  };

  const handleReact = (postId, reactionType) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              reactions: {
                ...post.reactions,
                [reactionType]: Number(post.reactions?.[reactionType] || 0) + 1,
              },
            }
          : post
      )
    );
  };

  const handleVote = (postId, selectedOptions, voterRole) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId || post.type !== "poll" || !post.pollDetails) return post;
        return {
          ...post,
          pollDetails: {
            ...post.pollDetails,
            options: post.pollDetails.options.map((option) => {
              if (!selectedOptions.includes(option.id)) return option;
              return {
                ...option,
                votes: Number(option.votes || 0) + 1,
                voters: [...(option.voters || []), voterRole],
              };
            }),
          },
        };
      })
    );
    grantPoints(2, "vote");
  };

  const handleAddComment = (postId, comment) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, comments: [...(post.comments || []), comment] } : post)));
    grantPoints(2, "comment");
  };

  const handleAddReply = (postId, commentId, reply) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: (post.comments || []).map((comment) =>
                comment.id === commentId ? { ...comment, replies: [...(comment.replies || []), reply] } : comment
              ),
            }
          : post
      )
    );
  };

  const handleApprove = (postId) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, status: "approved" } : post)));
  };

  const handleReject = (postId, reason) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, status: "rejected", moderationNote: reason || "Rejected by moderator." } : post
      )
    );
  };

  return (
    <div className="community-page">
      <div className="community-layout">
        <section className="community-left-column">
          <div className="community-hero">
            <div className="community-title-icon">
              <img src={nccLogo} alt="NCC" className="community-title-logo" />
            </div>
            <div>
              <h1>Community</h1>
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
            {canPost ? (
              <button type="button" className="community-new-btn" onClick={() => setShowCreateModal(true)}>
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
            {pinnedPosts.map((post) => (
              <PinnedPost
                key={post.id}
                post={post}
                role={effectiveRole}
                canEdit={canEdit}
                canPost={canPost}
                canComment={canComment}
                onEdit={(value) => {
                  if (!canEdit) return;
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
                canEdit={canEdit}
                canPost={canPost}
                canComment={canComment}
                onEdit={(value) => {
                  if (!canEdit) return;
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
            {!visiblePosts.length ? <p className="community-muted-text">No posts found for selected filters.</p> : null}
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

