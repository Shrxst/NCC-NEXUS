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
import MeetingDashboardSection from "../Meetings/MeetingDashboardSection";
import { canCreateMeeting, getCurrentRole } from "../Meetings/meetingUtils";
import { closeSUOSidebar, toggleSUOSidebar } from "../../features/ui/uiSlice";
import { API_BASE_URL } from "../../api/config";
import QuizModule from "../quiz/QuizModule";

export default function SUODashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isSUOSidebarOpen = useSelector((state) => state.ui.isSUOSidebarOpen);

  const [activeTab, setActiveTab] = useState("profile");
  const [showReset, setShowReset] = useState(false);
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
      const response = await fetch(`${API_BASE_URL}/api/cadet/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`Failed to load profile: ${data.message || "Unknown error"}`);
        return false;
      }

      if (data.role !== "SUO") {
        alert("This account is not authorized for SUO dashboard.");
        navigate("/dashboard");
        return false;
      }

      setProfileData({
        name: data.name || "SUO",
        rank: data.rank || "Senior Under Officer",
        location: [data.unit, data.city].filter(Boolean).join(", "),
        bio: data.bio || "Add your bio using edit button.",
      });

      setProfileImage(data.profile_image_url || defaultProfileImage);
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
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      navigate("/");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setProfileImage(previewUrl);
    setSelectedImageFile(file);

    try {
      await updateProfile({
        token,
        bio: profileData.bio || "",
        imageFile: file,
      });
      setSelectedImageFile(null);
      await fetchProfile(token);
    } catch (error) {
      console.error("Image Upload Error:", error);
      alert(`Image upload failed: ${error.message}`);
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
      await updateProfile({
        token,
        bio: nextBio,
        imageFile: selectedImageFile,
      });

      setProfileData((prev) => ({ ...prev, bio: nextBio }));
      setSelectedImageFile(null);
      await fetchProfile(token);
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
    const role = localStorage.getItem("role");

    if (!token || role !== "SUO") {
      navigate("/");
      return;
    }

    fetchProfile(token);
  }, [navigate]);

  const role = getCurrentRole();
  const canCreate = canCreateMeeting(role);

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

          <main className={`main ${isSUOSidebarOpen ? "sidebar-open" : ""}`}>
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
              <button
                className="topbar-logout"
                onClick={() => {
                  dispatch(closeSUOSidebar());
                  localStorage.removeItem("token");
                  localStorage.removeItem("role");
                  localStorage.removeItem("system_role");
                  localStorage.removeItem("rank");
                  localStorage.removeItem("user");
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

            {activeTab === "chatbot" && <Chatbot />}
            {activeTab === "quiz" && (
              <QuizModule
                participantName={profileData.name || "SUO"}
                participantRank={profileData.rank || "Senior Under Officer"}
              />
            )}

            {activeTab === "meetings" && (
              <div className="meeting-tab-shell">
                <MeetingListPage embedded basePath="/meetings" />
                {canCreate ? <MeetingCreatePage embedded basePath="/meetings" /> : null}
              </div>
            )}

            {activeTab === "feed" && (
              <Feed profileImage={profileImage} profileName={profileData.name} mode="feed" />
            )}

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
                      <h3>{profileData.rank || "SUO"}</h3>
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

                <MeetingDashboardSection sectionTitle="My Meetings" mode="MY" basePath="/meetings" />

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
                        <span className="profile-role-badge">{profileData.rank || "SUO"}</span>
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
