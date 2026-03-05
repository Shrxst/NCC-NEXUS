import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaPaperPlane, FaPlus, FaRegImage, FaXmark } from "react-icons/fa6";

const TABS = ["update", "event", "poll", "media"];

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

export default function CreatePostForm({ onClose, onSubmit, role = "cadet", initialPost = null }) {
  const initialPoll = initialPost?.pollDetails || null;
  const [tab, setTab] = useState(initialPost?.type || "update");
  const [content, setContent] = useState(initialPost?.content || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(initialPost?.tags || []);
  const [eventDetails, setEventDetails] = useState(
    initialPost?.eventDetails || { title: "", date: "", location: "", description: "", eventTag: "Training" }
  );
  const [pollDetails, setPollDetails] = useState(
    initialPoll
      ? {
          ...initialPoll,
          deadline: toDateTimeLocalValue(initialPoll.deadline),
        }
      : {
          question: "",
          options: [
            { id: "opt-1", text: "", votes: 0, voters: [] },
            { id: "opt-2", text: "", votes: 0, voters: [] },
          ],
          deadline: "",
          multiple: false,
          anonymous: false,
        }
  );
  const [mediaFiles, setMediaFiles] = useState({ images: [], videos: [], pdfs: [] });
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaUrlList, setMediaUrlList] = useState(initialPost?.mediaUrls || []);

  const canAddPollOption = useMemo(() => pollDetails.options.length < 5, [pollDetails.options.length]);

  const addTag = () => {
    const normalized = tagInput.trim();
    if (!normalized) return;
    if (tags.some((item) => item.toLowerCase() === normalized.toLowerCase())) return;
    setTags((prev) => [...prev, normalized]);
    setTagInput("");
  };

  const addMediaUrl = () => {
    const normalized = mediaUrlInput.trim();
    if (!normalized) return;
    setMediaUrlList((prev) => [...prev, normalized]);
    setMediaUrlInput("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedTags = tags.filter(Boolean);

    const eventDateValue = eventDetails.date ? new Date(eventDetails.date) : null;
    const eventDate = eventDateValue && !Number.isNaN(eventDateValue.getTime()) ? eventDateValue.toISOString() : eventDetails.date;
    const pollDeadlineValue = pollDetails.deadline ? new Date(pollDetails.deadline) : null;
    const pollDeadline =
      pollDeadlineValue && !Number.isNaN(pollDeadlineValue.getTime()) ? pollDeadlineValue.toISOString() : "";

    if (tab === "poll") {
      if (!pollDeadline) {
        alert("Please select 'Poll active till' date and time.");
        return;
      }
      if (pollDeadlineValue.getTime() <= Date.now()) {
        alert("Poll active till must be a future date and time.");
        return;
      }
    }

    try {
      await onSubmit({
        id: initialPost?.id || `post-${Date.now()}`,
        author: initialPost?.author || role.toUpperCase(),
        authorRole: initialPost?.authorRole || role,
        content: content.trim(),
        type: tab,
        timestamp: Date.now(),
        pinned: initialPost?.pinned || false,
        status: "approved",
        tags: normalizedTags,
        eventDetails: tab === "event" ? { ...eventDetails, date: eventDate } : null,
        pollDetails: tab === "poll" ? { ...pollDetails, deadline: pollDeadline } : null,
        mediaUrls: tab === "media" ? mediaUrlList : [],
        videoUrls: tab === "media" ? [] : [],
        pdfUrls: tab === "media" ? [] : [],
        mediaFiles: tab === "media" ? mediaFiles : { images: [], videos: [], pdfs: [] },
        reactions: initialPost?.reactions || { salute: 0, fire: 0, clap: 0 },
        comments: initialPost?.comments || [],
      });
      onClose();
    } catch (error) {
      alert(error?.message || "Failed to create post");
    }
  };

  const modalContent = (
    <div className="community-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="community-modal-card community-create-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="community-create-head">
          <h3>{initialPost ? "Edit Post" : "Create Post"}</h3>
          <button type="button" className="community-create-close" onClick={onClose} aria-label="Close">
            <FaXmark size={20} />
          </button>
        </div>

        <div className="community-create-body">
        <div className="community-tab-row">
          {TABS.map((name) => (
            <button key={name} type="button" className={tab === name ? "active" : ""} onClick={() => setTab(name)}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          required
          value={content}
          placeholder={
            tab === "update"
              ? "Share an update with the unit..."
              : tab === "event"
                ? "Describe the event..."
                : tab === "poll"
                  ? "Add context for the poll..."
                  : "Describe the media..."
          }
          className="community-create-textarea"
          onChange={(e) => setContent(e.target.value)}
        />

        {tab === "event" ? (
          <div className="community-create-grid">
            <input
              type="text"
              required
              placeholder="Event title"
              value={eventDetails.title}
              onChange={(e) => setEventDetails((prev) => ({ ...prev, title: e.target.value }))}
            />
            <div className="community-create-grid-two">
              <input
                type="text"
                required
                placeholder="Date (e.g. 15 Mar 2026)"
                value={eventDetails.date}
                onChange={(e) => setEventDetails((prev) => ({ ...prev, date: e.target.value }))}
              />
              <input
                type="text"
                required
                placeholder="Location"
                value={eventDetails.location}
                onChange={(e) => setEventDetails((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <input
              type="text"
              placeholder="Additional details"
              value={eventDetails.eventTag}
              onChange={(e) => setEventDetails((prev) => ({ ...prev, eventTag: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Event description"
              value={eventDetails.description}
              onChange={(e) => setEventDetails((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        ) : null}

        {tab === "poll" ? (
          <div className="community-create-grid community-poll-create">
            <input
              type="text"
              required
              placeholder="Poll question"
              value={pollDetails.question}
              onChange={(e) => setPollDetails((prev) => ({ ...prev, question: e.target.value }))}
            />
            {pollDetails.options.map((option, idx) => (
              <input
                key={option.id}
                type="text"
                required
                placeholder={`Option ${idx + 1}`}
                value={option.text}
                onChange={(e) =>
                  setPollDetails((prev) => ({
                    ...prev,
                    options: prev.options.map((item) => (item.id === option.id ? { ...item, text: e.target.value } : item)),
                  }))
                }
              />
            ))}
            {canAddPollOption ? (
              <button
                type="button"
                className="ghost community-add-option-btn"
                onClick={() =>
                  setPollDetails((prev) => ({
                    ...prev,
                    options: [...prev.options, { id: `opt-${Date.now()}`, text: "", votes: 0, voters: [] }],
                  }))
                }
              >
                <FaPlus size={12} /> Add Option
              </button>
            ) : null}
            <div className="community-poll-controls-row">
              <label htmlFor="poll-active-till">Poll active till</label>
              <input
                id="poll-active-till"
                type="datetime-local"
                required
                className="community-poll-date-input"
                value={pollDetails.deadline}
                onChange={(e) => setPollDetails((prev) => ({ ...prev, deadline: e.target.value }))}
              />
              <label className="community-check-label">
                <input
                  type="checkbox"
                  checked={pollDetails.multiple}
                  onChange={(e) => setPollDetails((prev) => ({ ...prev, multiple: e.target.checked }))}
                />
                Allow multiple choices
              </label>
            </div>
          </div>
        ) : null}

        {tab === "media" ? (
          <div className="community-create-grid">
            <div className="community-media-url-row">
              <input
                type="text"
                placeholder="Paste image URL..."
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
              />
              <button type="button" className="community-media-url-btn" onClick={addMediaUrl}>
                <FaRegImage size={17} />
              </button>
            </div>
            <p className="community-media-count">{mediaUrlList.length}/5 media files</p>
            <label className="community-file-input">
              <span>Upload Images</span>
              <input type="file" accept="image/*" multiple onChange={(e) => setMediaFiles((prev) => ({ ...prev, images: Array.from(e.target.files || []) }))} />
            </label>
            <label className="community-file-input">
              <span>Upload Videos</span>
              <input type="file" accept="video/*" multiple onChange={(e) => setMediaFiles((prev) => ({ ...prev, videos: Array.from(e.target.files || []) }))} />
            </label>
            <label className="community-file-input">
              <span>Upload PDFs</span>
              <input type="file" accept="application/pdf" multiple onChange={(e) => setMediaFiles((prev) => ({ ...prev, pdfs: Array.from(e.target.files || []) }))} />
            </label>
          </div>
        ) : null}

        <div className="community-tag-row">
          <input
            type="text"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <button type="button" className="community-tag-add-btn" onClick={addTag}>
            Add
          </button>
        </div>

        {tags.length ? <p className="community-tag-preview">{tags.map((item) => `#${item}`).join(" ")}</p> : null}
        </div>

        <div className="community-modal-actions">
          <button type="submit" className="community-post-submit">
            <FaPaperPlane size={16} />
            {initialPost ? "Save" : "Post"}
          </button>
        </div>
      </form>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
