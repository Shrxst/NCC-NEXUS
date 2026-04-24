import React, { useEffect, useRef, useState } from "react";
import {
  User,
  MapPin,
  Image as ImageIcon,
  LogOut,
  Camera,
  Edit2,
  KeyRound,
  MessageSquare,
  Calendar,
  Rss,
  Bot,
  BarChart3,
  Award,
  Users,
  Video,
  ClipboardCheck,
  Mic,
  Bell,
} from "lucide-react";
import ChatLayout from "../ChatCommon/ChatLayout";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./dashboard.css";
import logoImage from "../assets/ncc-logo.png";
import Feed from "./feed";
import ResetPasswordModal from "./resetPassword";
import Chatbot from "./chatbot";
import SuoAttendance from "./SuoAttendance";
import MeetingListPage from "../Meetings/MeetingListPage";
import MeetingCreatePage from "../Meetings/MeetingCreatePage";
import MeetingDetailsPage from "../Meetings/MeetingDetailsPage";
import PostMeetingReport from "../Meetings/PostMeetingReport";
import MeetingRoomPage from "../Meetings/MeetingRoomPage";
import MeetingDashboardSection from "../Meetings/MeetingDashboardSection";
import { canCreateMeeting, getCurrentRole } from "../Meetings/meetingUtils";
import { fetchMeetings } from "../../store/meetingSlice";
import { closeSUOSidebar, toggleSUOSidebar } from "../../features/ui/uiSlice";
import { API_BASE_URL } from "../../api/config";
import QuizModule from "../quiz/QuizModule";
import VoiceCommandsModule from "../VoiceCommands/VoiceCommandsModule";
import CommunityFeed from "../community/CommunityFeed";
import CertificateModule from "../Certificate/CertificateModule";
import NotificationPanel from "../Notifications/NotificationPanel";
import { connectNotificationSocket, getNotificationSocket } from "../../features/notifications/notificationSocket";
import { clearAuthStorage, hasAuthFor } from "../../utils/authState";
import { getStoredDashboardTab, persistDashboardTab } from "../../utils/dashboardState";
import { resolveProfileImage } from "../../utils/profileImage";

const normalizeRankLabel = (value, fallback) => {
  const rank = String(value || "").trim();
  if (!rank) return fallback;

  const normalized = rank.toLowerCase();
  if (normalized === "-" || normalized === "--" || normalized === "n/a" || normalized === "na" || normalized === "null" || normalized === "undefined") {
    return fallback;
  }

  return rank;
};

export default function SUODashboard() {
  const SUO_TAB_STORAGE_KEY = "suo_dashboard_active_tab";
  const SUO_ALLOWED_TABS = ["profile", "feed", "chatbot", "attendance", "meetings", "quiz", "voice", "chat", "community", "certificates"];

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isSUOSidebarOpen = useSelector((state) => state.ui.isSUOSidebarOpen);

  const [activeTab, setActiveTab] = useState(() =>
    getStoredDashboardTab(SUO_TAB_STORAGE_KEY, "profile", SUO_ALLOWED_TABS)
  );
  const [showReset, setShowReset] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const defaultProfileImage = "";
  const [profileImage, setProfileImage] = useState(defaultProfileImage);
  const [selectedImageFile, setSelectedImageFile] = useState(null);

  const [profileData, setProfileData] = useState({
    name: "",
    rank: "",
    location: "",
    bio: "",
  });

  const fileInputRef = useRef(null);

  const fetchProfile = async (token) => {
    try {
      setLoadingProfile(true);
      const response = await fetch(`${API_BASE_URL}/api/cadet/profile?ts=${Date.now()}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`Failed to load profile: ${data.message || "Unknown error"}`);
        return false;
      }

      setProfileData({
        name: data.name || "SUO",
        rank: normalizeRankLabel(data.rank, "Senior Under Officer"),
        location: [data.unit, data.city].filter(Boolean).join(", "),
        bio: data.bio || "Add your bio using edit button.",
      });

      const resolvedImage = await resolveProfileImage(data.profile_image_url, defaultProfileImage);
      setProfileImage(resolvedImage);
      return true;
    } catch (error) {
      console.error("Fetch Profile Error:", error);
      alert("Unable to load profile.");
      return false;
    } finally {
      setLoadingProfile(false);
    }
  };

 const updateProfile = async ({ token, bio, imageFile }) => {
  const formData = new FormData();
  formData.append("bio", bio || "");

  if (imageFile) {
    formData.append("profile_image", imageFile);
  }

  const response = await fetch(`${API_BASE_URL}/api/cadet/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unknown error");
  }

  return data; // MUST return
};

  const handleProfileImageChange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";

  if (!file) return;

  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expired. Please login again.");
    navigate("/");
    return;
  }

  const previousImage = profileImage;
  const previewUrl = URL.createObjectURL(file);
  setProfileImage(previewUrl);

  try {
    const data = await updateProfile({
      token,
      bio: profileData.bio || "",
      imageFile: file,
    });

    if (data?.profile_image_url) {
      const resolvedImage = await resolveProfileImage(data.profile_image_url, previousImage || defaultProfileImage);
      setProfileImage(resolvedImage);
    } else {
      await fetchProfile(token);
    }
  } catch (error) {
    console.error("Image Upload Error:", error);
    alert(`Image upload failed: ${error.message}`);

    // revert if failed
    fetchProfile(token);
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
};

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState("");

  const startEditBio = () => {
    setTempBio(profileData.bio || "");
    setIsEditingBio(true);
  };

  const saveBio = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expired. Please login again.");
    navigate("/");
    return;
  }

  const nextBio = tempBio.trim();

  try {
    const data = await updateProfile({
      token,
      bio: nextBio,
      imageFile: selectedImageFile,
    });

    setProfileData((prev) => ({
      ...prev,
      bio: nextBio,
    }));

    if (data?.profile_image_url) {
      const resolvedImage = await resolveProfileImage(data.profile_image_url, profileImage || defaultProfileImage);
      setProfileImage(resolvedImage);
    } else {
      await fetchProfile(token);
    }

    setSelectedImageFile(null);
    setIsEditingBio(false);
  } catch (error) {
    console.error("Save Bio Error:", error);
    alert(`Failed to update profile: ${error.message}`);
  }
};

  const cancelEditBio = () => {
    setIsEditingBio(false);
    setTempBio("");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!hasAuthFor(["SUO"])) {
      navigate("/");
      return;
    }

    fetchProfile(token);
  }, [navigate]);

  // ── Notification fetch + socket ──
  useEffect(() => {
    const tk = localStorage.getItem("token");
    if (!tk) return;

    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const data = await res.json();
        if (!res.ok || !mounted) return;
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.is_read).length);
      } catch (err) {
        console.error("Notification fetch error:", err);
      }
    };

    fetchNotifications();

    const socket = connectNotificationSocket(tk) || getNotificationSocket();
    if (!socket) return () => { mounted = false; };

    const handleNew = (notification) => {
      if (!mounted || !notification) return;
      setNotifications((prev) => [notification, ...prev.filter((n) => n.notification_id !== notification.notification_id)]);
      setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
    };

    socket.on("notification:new", handleNew);

    return () => {
      mounted = false;
      socket.off("notification:new", handleNew);
    };
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllReadLocal = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  useEffect(() => {
    persistDashboardTab(SUO_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "donations") {
      setActiveTab("profile");
    }
  }, [activeTab]);

  const role = getCurrentRole();
  const canCreate = canCreateMeeting(role);

  // Meeting sub-view: "list" | "create" | "detail" | "report" | "room"
  const [meetingView, setMeetingView] = useState("list");
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);

  const meetingNav = {
    goToList: () => { setMeetingView("list"); setSelectedMeetingId(null); },
    goToCreate: () => { setMeetingView("create"); },
    goToDetail: (id) => { setSelectedMeetingId(id); setMeetingView("detail"); },
    goToReport: (id) => { setSelectedMeetingId(id); setMeetingView("report"); },
    goToRoom: (id) => { setSelectedMeetingId(id); setMeetingView("room"); },
  };

  return (
    <>
      <div className="suo-dashboard">
        {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}

        <div className="layout">
          {isSUOSidebarOpen ? (
            <button
              type="button"
              className="suo-sidebar-backdrop"
              aria-label="Close sidebar"
              onClick={() => dispatch(closeSUOSidebar())}
            />
          ) : null}

          <aside className={`sidebar ${isSUOSidebarOpen ? "open" : "closed"}`}>
            <div className="sidebar-top">
              <div className="sidebar-header">
                <div className="sidebar-logo-ring">
                  <img src={logoImage} className="sidebar-logo" alt="NCC Logo" />
                </div>
                <div className="sidebar-brand">
                  <h1>NCC NEXUS</h1>
                  <p>SUO DASHBOARD</p>
                </div>
              </div>

              <div className="sidebar-divider" />

              <div className="nav-list">
                <button
                  className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("profile");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <User size={18} />
                  <span>Profile</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "feed" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("feed");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Rss size={18} />
                  <span>Feed</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "chatbot" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("chatbot");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Bot size={18} />
                  <span>Chatbot</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "attendance" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("attendance");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Calendar size={18} />
                  <span>Attendance</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "meetings" ? "active" : ""}`}
                  onClick={() => {
                    setMeetingView("list");
                    setSelectedMeetingId(null);
                    setActiveTab("meetings");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Video size={18} />
                  <span>Meetings</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "quiz" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("quiz");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <ClipboardCheck size={18} />
                  <span>Quiz & Mock Tests</span>
                </button>
                <button
                  className={`nav-item ${activeTab === "voice" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("voice");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Mic size={18} />
                  <span>Voice Commands</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("chat");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <MessageSquare size={18} />
                  <span>Chat</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "community" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("community");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <Users size={18} />
                  <span>Community</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "certificates" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("certificates");
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <KeyRound size={18} />
                  <span>Certificates</span>
                </button>
                <button
                  className="nav-item"
                  onClick={() => {
                    setShowReset(true);
                    dispatch(closeSUOSidebar());
                  }}
                >
                  <KeyRound size={18} />
                  <span>Reset Password</span>
                </button>
              </div>
            </div>

          </aside>

          <main className={`main ${isSUOSidebarOpen ? "sidebar-open" : ""} ${activeTab === "chatbot" ? "chatbot-active" : ""}`}>
            <div className="tricolor-bar" />
            <div className="cadet-topbar">
              <button
                type="button"
                className="cadet-sidebar-toggle"
                aria-label="Toggle sidebar"
                onClick={() => dispatch(toggleSUOSidebar())}
              >
                Menu
              </button>

              <div className="topbar-notif-wrapper" ref={notifRef}>
                <button
                  type="button"
                  className="topbar-notif-btn"
                  aria-label="Notifications"
                  onClick={() => {
                    setNotifOpen((prev) => !prev);
                    if (!notifOpen) markAllReadLocal();
                  }}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="topbar-notif-badge">{unreadCount}</span>
                  )}
                </button>

                {notifOpen && (
                  <div className="topbar-notif-dropdown">
                    <NotificationPanel />
                  </div>
                )}
              </div>

              <button
                className="topbar-logout"
                onClick={() => {
                  dispatch(closeSUOSidebar());
                  clearAuthStorage();
                  navigate("/");
                }}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>

            {activeTab === "chat" && (
              <div className="chat-panel">
                <ChatLayout userRole="suo" />
              </div>
            )}

            {activeTab === "attendance" && <SuoAttendance />}

            {activeTab === "chatbot" && (
              <div className="chatbot-panel">
                <Chatbot />
              </div>
            )}
            {activeTab === "quiz" && (
              <QuizModule
                participantName={profileData.name || "SUO"}
                participantRank={normalizeRankLabel(profileData.rank, "Senior Under Officer")}
              />
            )}

            {activeTab === "voice" && <VoiceCommandsModule />}

            {activeTab === "meetings" && (
              <div className="meeting-tab-shell">
                {meetingView === "list" && (
                  <MeetingListPage
                    embedded
                    basePath="/meetings"
                    onViewDetails={meetingNav.goToDetail}
                    onJoinRoom={meetingNav.goToRoom}
                    onViewReport={meetingNav.goToReport}
                    onCreateMeeting={meetingNav.goToCreate}
                  />
                )}
                {meetingView === "create" && (
                  <MeetingCreatePage
                    embedded
                    basePath="/meetings"
                    onCreated={() => { dispatch(fetchMeetings()); meetingNav.goToList(); }}
                    onCancel={meetingNav.goToList}
                  />
                )}
                {meetingView === "detail" && selectedMeetingId && (
                  <MeetingDetailsPage
                    embedded
                    basePath="/meetings"
                    meetingIdProp={selectedMeetingId}
                    onBack={meetingNav.goToList}
                    onJoinRoom={meetingNav.goToRoom}
                    onViewReport={meetingNav.goToReport}
                  />
                )}
                {meetingView === "report" && selectedMeetingId && (
                  <PostMeetingReport
                    embedded
                    basePath="/meetings"
                    meetingIdProp={selectedMeetingId}
                    onBack={meetingNav.goToList}
                    onViewDetails={meetingNav.goToDetail}
                  />
                )}
                {meetingView === "room" && selectedMeetingId && (
                  <MeetingRoomPage
                    embedded
                    basePath="/meetings"
                    meetingIdProp={selectedMeetingId}
                    onBack={meetingNav.goToList}
                    onViewDetails={meetingNav.goToDetail}
                  />
                )}
              </div>
            )}

            {activeTab === "feed" && (
              <Feed profileImage={profileImage} profileName={profileData.name} mode="feed" />
            )}

            {activeTab === "community" && <CommunityFeed />}

            {activeTab === "certificates" && <CertificateModule storageKey="suo_certificates" />}

            {activeTab === "profile" && (
              <div className="profile-page">
                {loadingProfile ? <p className="loading-text">Loading profile...</p> : null}

                <div className="welcome-card">
                  <div className="welcome-text">
                    <h1>Welcome back, {profileData.name ? profileData.name.split(" ")[0] : "SUO"}!</h1>
                    <p>Here's your dashboard overview</p>
                  </div>
                  <span className="welcome-motto">UNITY &amp; DISCIPLINE</span>
                </div>

                <div className="stat-cards">
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-red">
                      <User size={18} />
                    </div>
                    <div className="stat-info">
                      <h3>{normalizeRankLabel(profileData.rank, "SUO")}</h3>
                      <p>Current Rank</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-blue">
                      <BarChart3 size={18} />
                    </div>
                    <div className="stat-info">
                      <h3>85%</h3>
                      <p>Attendance</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-indigo">
                      <Award size={18} />
                    </div>
                    <div className="stat-info">
                      <h3>C Certificate</h3>
                      <p>NCC Certificate</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-green">
                      <Users size={18} />
                    </div>
                    <div className="stat-info">
                      <h3>Leadership</h3>
                      <p>Squad Leader</p>
                    </div>
                  </div>
                </div>

                <div className="cadet-quiz-launch-card">
                  <div>
                    <h3>Quiz &amp; Mock Tests</h3>
                    <p>Attempt NCC Practice &amp; Exam Mode Tests</p>
                  </div>
                  <button className="quiz-btn-primary" onClick={() => setActiveTab("quiz")}>
                    Start Quiz
                  </button>
                </div>

                {canCreate ? (
                  <div className="suo-meeting-launch-card">
                    <div className="suo-meeting-launch-icon">
                      <Video size={22} />
                    </div>
                    <div className="suo-meeting-launch-info">
                      <h3>Create Meeting</h3>
                      <p>Schedule &amp; host video meetings with cadets</p>
                    </div>
                    <button
                      className="suo-meeting-launch-btn"
                      onClick={() => {
                        setMeetingView("create");
                        setActiveTab("meetings");
                      }}
                    >
                      <Calendar size={15} />
                      Schedule Now
                    </button>
                  </div>
                ) : null}

                <MeetingDashboardSection
                  sectionTitle="My Meetings"
                  mode="MY"
                  basePath="/meetings"
                  onNavigate={(target) => {
                    if (target === "create") {
                      setMeetingView("create");
                    } else {
                      setMeetingView("list");
                    }
                    setActiveTab("meetings");
                  }}
                  onViewDetails={(id) => { setSelectedMeetingId(id); setMeetingView("detail"); setActiveTab("meetings"); }}
                  onJoinRoom={(id) => { setSelectedMeetingId(id); setMeetingView("room"); setActiveTab("meetings"); }}
                  onViewReport={(id) => { setSelectedMeetingId(id); setMeetingView("report"); setActiveTab("meetings"); }}
                />

                <div className="banner">
                  <span className="banner-watermark">UNITY AND DISCIPLINE</span>
                </div>

                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-photo-wrapper">
                      <div className="profile-photo-ring">
                        <img src={profileImage || logoImage} className="profile-photo" alt="SUO Profile" />
                      </div>
                      <button className="camera-icon" onClick={() => fileInputRef.current.click()}>
                        <Camera size={14} />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        hidden
                        accept="image/*"
                        onChange={handleProfileImageChange}
                      />
                    </div>

                    <div className="profile-header-text">
                      <h1 className="profile-name">{profileData.name}</h1>
                      <div className="profile-meta">
                        <span className="profile-role-badge">{normalizeRankLabel(profileData.rank, "SUO")}</span>
                        <div className="info-pill">
                          <MapPin size={14} />
                          {profileData.location}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="profile-card-divider" />

                  <div className="bio-container">
                    {isEditingBio ? (
                      <div className="bio-edit-mode">
                        <textarea
                          className="bio-edit-textarea"
                          value={tempBio}
                          onChange={(e) => setTempBio(e.target.value)}
                          placeholder="Write something about yourself..."
                        />
                        <div className="bio-edit-actions">
                          <button className="bio-save-btn" onClick={saveBio}>
                            Save
                          </button>
                          <button className="bio-cancel-btn" onClick={cancelEditBio}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bio-display">
                        <p className="bio">"{profileData.bio || "Add your bio using edit button."}"</p>
                        <button className="bio-edit-icon" onClick={startEditBio}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="section-title">SUO Activity Log</h2>

                <Feed profileImage={profileImage} profileName={profileData.name} mode="profile" />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}



