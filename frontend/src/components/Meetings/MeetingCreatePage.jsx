import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, UserPlus, X } from "lucide-react";
import { createMeetingAsync } from "../../store/meetingSlice";
import { API_BASE_URL } from "../../api/config";
import { MEETING_TYPES, canCreateMeeting, getCurrentRole, getCurrentUser } from "./meetingUtils";
import "./meetingModule.css";

const normalizeRoleLabel = (role = "") => {
  const r = String(role).toUpperCase().trim();
  if (r === "SENIOR UNDER OFFICER") return "SUO";
  if (r === "CADET" || r === "SUO" || r === "ALUMNI" || r === "ANO") return r;
  return r;
};

const MeetingCreatePage = ({ embedded = false, basePath = "/meetings" }) => {
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    dateTime: "",
    meetingType: "General",
    restricted: false,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const roleAllowed = canCreateMeeting(role);

  useEffect(() => {
    if (!roleAllowed) return;

    const token = localStorage.getItem("token");

    const fetchFromAnoCadets = async () => {
      const response = await fetch(`${API_BASE_URL}/api/ano/cadets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      return list.map((cadet) => ({
        id: cadet.regimental_no,
        name: cadet.name || "Unknown",
        email: cadet.email || "",
        unit: cadet.unit || "",
        rank: cadet.rank || "",
        role: normalizeRoleLabel(cadet.role),
      }));
    };

    const fetchFromChatUsers = async () => {
      const response = await fetch(`${API_BASE_URL}/api/chat/users/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const users = data?.data?.users || data?.users || [];
      if (!Array.isArray(users)) return null;
      return users.map((contact) => ({
        id: contact.peer_user_id,
        name: contact.room_name || contact.participants?.[0]?.name || `User #${contact.peer_user_id}`,
        email: "",
        unit: "",
        rank: "",
        role: normalizeRoleLabel(contact.peer_role),
      }));
    };

    const loadUsers = async () => {
      try {
        // ANO can use /api/ano/cadets; SUO falls back to chat users endpoint
        let result = await fetchFromAnoCadets();
        if (!result) {
          result = await fetchFromChatUsers();
        }
        if (result && result.length > 0) {
          setCadets(result);
        } else {
          setFetchError("No users found to invite.");
        }
      } catch {
        setFetchError("Could not connect to server.");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [roleAllowed, currentUser.id]);

  const filteredUsers = useMemo(() => {
    return cadets.filter((user) => {
      const roleMatch = roleFilter === "ALL" || user.role === roleFilter;
      const searchMatch = user.name.toLowerCase().includes(search.toLowerCase());
      return roleMatch && searchMatch;
    });
  }, [cadets, search, roleFilter]);

  const isValid =
    form.title.trim().length > 1 &&
    form.description.trim().length > 1 &&
    form.dateTime &&
    form.meetingType &&
    selectedUsers.length > 0;

  const toggleUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    );
  };

  const removeUser = (id) => {
    setSelectedUsers((prev) => prev.filter((userId) => userId !== id));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid || !roleAllowed) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      dateTime: form.dateTime,
      meetingType: form.meetingType,
      restricted: form.restricted,
      invitedUserIds: [currentUser.id, ...selectedUsers],
      createdBy: currentUser.id,
    };

    dispatch(createMeetingAsync(payload))
      .unwrap()
      .then((created) => {
        navigate(`${basePath}/${created.id}`);
      })
      .catch(() => {
        navigate(basePath);
      });
  };

  if (!roleAllowed) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Only ANO and SUO can schedule meetings.</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-page-head">
        <div>
          <h1>Create Meeting</h1>
          <p>Fill in the details below and select participants.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Meeting Details */}
        <div className="meeting-create-card">
          <div className="meeting-create-card-header">
            <span className="meeting-step-badge">1</span>
            <h3>Meeting Details</h3>
          </div>

          <div className="meeting-create-fields">
            <label className="meeting-form-field meeting-form-field-full">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g. Weekly Parade Briefing"
              />
            </label>

            <label className="meeting-form-field">
              <span>Date & Time</span>
              <input
                type="datetime-local"
                value={form.dateTime}
                onChange={(event) => setForm((prev) => ({ ...prev, dateTime: event.target.value }))}
              />
            </label>

            <label className="meeting-form-field">
              <span>Meeting Type</span>
              <select
                value={form.meetingType}
                onChange={(event) => setForm((prev) => ({ ...prev, meetingType: event.target.value }))}
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="meeting-form-field meeting-form-field-full">
              <span>Description</span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe the agenda and purpose of this meeting..."
              />
            </label>

            <label className="meeting-form-toggle">
              <input
                type="checkbox"
                checked={form.restricted}
                onChange={(event) => setForm((prev) => ({ ...prev, restricted: event.target.checked }))}
              />
              <span>Restricted Meeting (invite-only access)</span>
            </label>
          </div>
        </div>

        {/* Step 2: Invite Users */}
        <div className="meeting-create-card">
          <div className="meeting-create-card-header">
            <span className="meeting-step-badge">2</span>
            <h3>Invite Participants</h3>
            <span className="meeting-create-count">{selectedUsers.length} selected</span>
          </div>

          {/* Selected users chips */}
          {selectedUsers.length > 0 ? (
            <div className="meeting-create-selected">
              {selectedUsers.map((id) => {
                const user = cadets.find((item) => item.id === id);
                if (!user) return null;
                return (
                  <span key={id} className="meeting-create-chip">
                    {user.name}
                    <button type="button" className="meeting-chip-remove" onClick={() => removeUser(id)}>
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* Search and filter bar */}
          <div className="meeting-create-search-bar">
            <div className="meeting-search-input-wrap">
              <Search size={16} />
              <input
                placeholder="Search by name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="ALL">All Roles</option>
              <option value="SUO">SUO</option>
              <option value="CADET">Cadet</option>
              <option value="ALUMNI">Alumni</option>
              <option value="ANO">ANO</option>
            </select>
          </div>

          {/* User list */}
          {loading ? (
            <div className="meeting-empty">Loading registered cadets...</div>
          ) : fetchError ? (
            <div className="meeting-empty">{fetchError}</div>
          ) : cadets.length === 0 ? (
            <div className="meeting-empty">No registered cadets found.</div>
          ) : (
            <div className="meeting-create-user-list">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className={`meeting-create-user-row ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleUser(user.id)}
                  >
                    <div className="meeting-create-user-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="meeting-create-user-info">
                      <strong>{user.name}</strong>
                      {user.unit ? <span>{user.unit}</span> : null}
                    </div>
                    <span className="meeting-user-role">{user.role}</span>
                    {isSelected ? (
                      <span className="meeting-create-check">&#10003;</span>
                    ) : (
                      <UserPlus size={16} className="meeting-create-add-icon" />
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && cadets.length > 0 ? (
                <div className="meeting-empty-inline">No users match your search.</div>
              ) : null}
            </div>
          )}
        </div>

        {/* Submit area */}
        <div className="meeting-create-submit">
          <button
            type="button"
            className="meeting-btn meeting-btn-secondary"
            onClick={() => navigate(basePath)}
          >
            <ArrowLeft size={14} />
            Cancel
          </button>
          <button className="meeting-btn meeting-btn-primary meeting-btn-lg" type="submit" disabled={!isValid}>
            Schedule Meeting
          </button>
        </div>
      </form>
    </div>
  );
};

export default MeetingCreatePage;
