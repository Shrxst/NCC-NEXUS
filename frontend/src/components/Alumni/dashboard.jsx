import React, { useEffect, useRef, useState } from "react";
import {
  User,
  MapPin,
  LogOut,
  Edit2,
  KeyRound,
  MessageSquare,
  Rss,
  BarChart3,
  Award,
  GraduationCap,
  Video,
  Camera,
} from "lucide-react";
import ChatLayout from "../ChatCommon/ChatLayout";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./dashboard.css";
import logoImage from "../assets/ncc-logo.png";
import Feed from "./feed";
import ResetPasswordModal from "./resetPassword";
import MeetingListPage from "../Meetings/MeetingListPage";
import MeetingDashboardSection from "../Meetings/MeetingDashboardSection";
import { closeAlumniSidebar, toggleAlumniSidebar } from "../../features/ui/uiSlice";
import { API_BASE_URL } from "../../api/config";

export default function AlumniDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAlumniSidebarOpen = useSelector((state) => state.ui.isAlumniSidebarOpen);

  const [activeTab, setActiveTab] = useState("profile");
  const [showReset, setShowReset] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const defaultProfileImage = "";
  const [profileImage, setProfileImage] = useState(defaultProfileImage);

  const [profileData, setProfileData] = useState({
    name: "",
    rank: "",
    location: "",
    bio: "",
  });

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState("");

  const fileInputRef = useRef(null);

    const withCacheBuster = (url) => {
    if (!url) return defaultProfileImage;
    const joiner = String(url).includes("?") ? "&" : "?";
    return `${url}${joiner}v=${Date.now()}`;
  };

  const fetchProfile = async (token, { silent = false } = {}) => {
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
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("system_role");
          localStorage.removeItem("rank");
          localStorage.removeItem("user");
          navigate("/");
          return false;
        }

        if (!silent) {
          alert(`Failed to load profile: ${data.message || "Unknown error"}`);
        }
        return false;
      }

      setProfileData({
        name: data.name || "Alumni",
        rank: data.rank || "-",
        location: [data.unit, data.city].filter(Boolean).join(", "),
        bio: data.bio || "Alumni profile bio is not editable yet.",
      });

      setProfileImage(withCacheBuster(data.profile_image_url));
      return true;
    } catch (error) {
      console.error("Fetch Alumni Profile Error:", error);
      if (!silent) {
        alert("Unable to load profile.");
      }
      return false;
    } finally {
      setLoadingProfile(false);
    }
  };

  const updateProfile = async ({ token, imageFile }) => {
  const formData = new FormData();

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

  return data; // ✅ IMPORTANT
};

// const uploadProfileWithRetry = async (payload, maxAttempts = 2) => {
//   let lastError;

//   for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
//     try {
//       await updateProfile(payload);
//       return;
//     } catch (error) {
//       lastError = error;
//       const isNetworkError =
//         error instanceof TypeError ||
//         String(error?.message || "").toLowerCase().includes("failed to fetch");

//       if (!isNetworkError || attempt >= maxAttempts) {
//         break;
//       }

//       await new Promise((resolve) => setTimeout(resolve, 700));
//     }
//   }

//   throw lastError;
// };

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

  // Show instant preview
  const previewUrl = URL.createObjectURL(file);
  setProfileImage(previewUrl);

  try {
    const data = await updateProfile({
      token,
      imageFile: file,
    });

    // Replace preview with actual saved image
    if (data?.profile_image_url) {
      setProfileImage(data.profile_image_url + "?v=" + Date.now());
    }
  } catch (error) {
  console.error("Image Upload Error:", error);

  alert(`Image upload failed: ${error.message}`);

  // Revert back to last saved image
  const token = localStorage.getItem("token");
  if (token) {
    fetchProfile(token, { silent: true });
  }
}
};

const startEditBio = () => {
    setTempBio(profileData.bio || "");
    setIsEditingBio(true);
  };

  const saveBio = () => {
    alert("Alumni profile editing is not supported by backend yet.");
    setIsEditingBio(false);
  };

  const cancelEditBio = () => {
    setIsEditingBio(false);
    setTempBio("");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "ALUMNI") {
      navigate("/");
      return;
    }

    fetchProfile(token);
  }, [navigate]);

  return (
    <>
      <div className="alumni-dashboard">
        {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
        <div className="layout">
          {isAlumniSidebarOpen ? (
            <button
              type="button"
              className="alumni-sidebar-backdrop"
              aria-label="Close sidebar"
              onClick={() => dispatch(closeAlumniSidebar())}
            />
          ) : null}

          <aside className={`sidebar ${isAlumniSidebarOpen ? "open" : "closed"}`}>
            <div className="sidebar-top">
              <div className="sidebar-header">
                <div className="sidebar-logo-ring">
                  <img src={logoImage} className="sidebar-logo" alt="NCC Logo" />
                </div>
                <div className="sidebar-brand">
                  <h1>NCC NEXUS</h1>
                  <p>ALUMNI DASHBOARD</p>
                </div>
              </div>

              <div className="sidebar-divider" />

              <div className="nav-list">
                <button
                  className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("profile");
                    dispatch(closeAlumniSidebar());
                  }}
                >
                  <User size={18} />
                  <span>Profile</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "feed" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("feed");
                    dispatch(closeAlumniSidebar());
                  }}
                >
                  <Rss size={18} />
                  <span>Network Feed</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "meetings" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("meetings");
                    dispatch(closeAlumniSidebar());
                  }}
                >
                  <Video size={18} />
                  <span>Meetings</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("chat");
                    dispatch(closeAlumniSidebar());
                  }}
                >
                  <MessageSquare size={18} />
                  <span>Chat</span>
                </button>

                <button
                  className="nav-item"
                  onClick={() => {
                    setShowReset(true);
                    dispatch(closeAlumniSidebar());
                  }}
                >
                  <KeyRound size={18} />
                  <span>Reset Password</span>
                </button>
              </div>
            </div>
          </aside>

          <main className={`main ${isAlumniSidebarOpen ? "sidebar-open" : ""}`}>
            <div className="tricolor-bar" />
            <div className="cadet-topbar">
              <button
                type="button"
                className="cadet-sidebar-toggle"
                aria-label="Toggle sidebar"
                onClick={() => dispatch(toggleAlumniSidebar())}
              >
                Menu
              </button>
              <button
                className="topbar-logout"
                onClick={() => {
                  dispatch(closeAlumniSidebar());
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
                <ChatLayout userRole="alumni" />
              </div>
            )}

            {activeTab === "meetings" && (
              <div className="meeting-tab-shell">
                <MeetingListPage embedded basePath="/meetings" />
              </div>
            )}

            {activeTab === "feed" && (
              <Feed profileImage={profileImage || logoImage} profileName={profileData.name} mode="feed" />
            )}

            {activeTab === "profile" && (
              <div className="profile-page">
                {loadingProfile ? <p className="loading-text">Loading profile...</p> : null}

                <div className="welcome-card">
                  <div className="welcome-text">
                    <h1>Welcome back, {profileData.name ? profileData.name.split(" ")[0] : "Alumni"}!</h1>
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
                      <h3>{profileData.rank || "Alumni"}</h3>
                      <p>Former Rank</p>
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
                      <GraduationCap size={18} />
                    </div>
                    <div className="stat-info">
                      <h3>Alumni</h3>
                      <p>Network Status</p>
                    </div>
                  </div>
                </div>

                <MeetingDashboardSection sectionTitle="Invited Meetings" mode="INVITED" basePath="/meetings" />

                <div className="banner">
                  <div className="banner-watermark">UNITY AND DISCIPLINE</div>
                </div>

                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-photo-wrapper">
                      <div className="profile-photo-ring">
                        <img src={profileImage || logoImage} className="profile-photo" alt="Alumni Profile" />
                      </div>
                      <button
                        className="camera-icon"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
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
                        <span className="profile-role-badge">{profileData.rank || "Alumni"}</span>
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
                        <p className="bio">"{profileData.bio || "Alumni profile bio is not editable yet."}"</p>
                        <button className="bio-edit-icon" onClick={startEditBio}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="section-title">My Mentorship Posts</h2>

                <Feed profileImage={profileImage || logoImage} profileName={profileData.name} mode="profile" />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}







