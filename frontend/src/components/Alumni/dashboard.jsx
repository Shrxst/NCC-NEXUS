import React, { useEffect, useState } from "react";
import {
  User,
  MapPin,
  Image as ImageIcon,
  LogOut,
  Edit2,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import ChatLayout from "../ChatCommon/ChatLayout";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./dashboard.css";
import logoImage from "../assets/ncc-logo.png";
import Feed from "./feed";
import ResetPasswordModal from "./resetPassword";
import { closeAlumniSidebar, toggleAlumniSidebar } from "../../features/ui/uiSlice";

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

  const fetchProfile = async (token) => {
    try {
      setLoadingProfile(true);
      const response = await fetch("http://localhost:5000/api/cadet/profile", {
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
        name: data.name || "Alumni",
        rank: data.rank || "-",
        location: [data.unit, data.city].filter(Boolean).join(", "),
        bio: data.bio || "Alumni profile bio is not editable yet.",
      });

      setProfileImage(data.profile_image_url || defaultProfileImage);
      return true;
    } catch (error) {
      console.error("Fetch Alumni Profile Error:", error);
      alert("Unable to load profile.");
      return false;
    } finally {
      setLoadingProfile(false);
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
            <div>
              <div className="sidebar-header">
                <img src={logoImage} className="sidebar-logo" alt="NCC Logo" />
                <div className="logo-text">
                  <h1>NCC NEXUS</h1>
                  <p>ALUMNI DASHBOARD</p>
                </div>
              </div>

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
                  <MapPin size={18} />
                  <span>Network Feed</span>
                </button>

                <button className="nav-item">
                  <ImageIcon size={18} />
                  <span>Wall of Fame</span>
                </button>

                <button
                  className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("chat");
                    if (!isAlumniSidebarOpen) dispatch(toggleAlumniSidebar());
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

            <button
              className="logout-item"
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
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </aside>

          <main className={`main ${isAlumniSidebarOpen ? "sidebar-open" : ""}`}>
            <div className="cadet-topbar">
              <button
                type="button"
                className="cadet-sidebar-toggle"
                aria-label="Toggle sidebar"
                onClick={() => dispatch(toggleAlumniSidebar())}
              >
                Menu
              </button>
            </div>

            {activeTab === "chat" && (
              <div className="chat-panel">
                <ChatLayout userRole="alumni" />
              </div>
            )}

            {activeTab === "feed" && (
              <Feed profileImage={profileImage || logoImage} profileName={profileData.name} mode="feed" />
            )}

            {activeTab === "profile" && (
              <>
                {loadingProfile ? <p className="section-title">Loading profile...</p> : null}

                <div className="banner">
                  <div className="profile-photo-wrapper">
                    <img src={profileImage || logoImage} className="profile-photo" alt="Alumni Profile" />
                  </div>
                </div>

                <div className="profile-details">
                  <h1 className="profile-name">{profileData.name}</h1>

                  <div className="profile-info">
                    <div className="info-pill">
                      <User size={16} />
                      {profileData.rank}
                    </div>
                    <div className="info-pill">
                      <MapPin size={16} />
                      {profileData.location}
                    </div>
                  </div>

                  <div className="bio-container">
                    {isEditingBio ? (
                      <div className="bio-edit-mode">
                        <textarea
                          className="bio-edit-textarea"
                          value={tempBio}
                          onChange={(e) => setTempBio(e.target.value)}
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
                          <Edit2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="section-title">My Mentorship Posts</h2>

                <Feed profileImage={profileImage || logoImage} profileName={profileData.name} mode="profile" />
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
