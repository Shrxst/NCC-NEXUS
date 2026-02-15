import React, { useState, useRef } from "react";
import {
  User,
  MapPin,
  Image as ImageIcon,
  LogOut,
  Camera,
  Edit2,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import ChatLayout from "../ChatCommon/ChatLayout";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./dashboard.css";
import logoImage from "../assets/ncc-logo.png"; // Corrected path for nested folder
import Feed from "./feed";
import ResetPasswordModal from "./resetPassword";
// Note: Alumni does not have a chatbot according to your requirements
import { closeAlumniSidebar, toggleAlumniSidebar } from "../../features/ui/uiSlice";

export default function AlumniDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Using Alumni-specific sidebar state
  const isAlumniSidebarOpen = useSelector((state) => state.ui.isAlumniSidebarOpen);

  const [activeTab, setActiveTab] = useState("profile");
  const [showReset, setShowReset] = useState(false);

  const [profileImage, setProfileImage] = useState(
    "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79" // Alumni placeholder
  );

  const [profileData, setProfileData] = useState({
    name: "Rahul Sharma",
    rank: "Ex-Senior Under Officer (SUO)",
    location: "Mumbai, Maharashtra",
    bio:
      "NCC Alumni | Software Engineer | Passionate about mentoring junior cadets and giving back to the community.",
  });

  const fileInputRef = useRef(null);

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setProfileImage(URL.createObjectURL(file));
  };

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState("");

  const startEditBio = () => {
    setTempBio(profileData.bio);
    setIsEditingBio(true);
  };

  const saveBio = () => {
    if (tempBio.trim()) {
      setProfileData({ ...profileData, bio: tempBio.trim() });
    }
    setIsEditingBio(false);
  };

  const cancelEditBio = () => {
    setIsEditingBio(false);
    setTempBio("");
  };

  return (
    <>
      <div className="alumni-dashboard">
        {showReset && (
          <ResetPasswordModal onClose={() => setShowReset(false)} />
        )}
        <div className="layout">
        {/* ================= SIDEBAR ================= */}
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
              navigate("/");
            }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </aside>

        {/* ================= MAIN ================= */}
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
            <Feed
              profileImage={profileImage}
              profileName={profileData.name}
              mode="feed"
            />
          )}

          {activeTab === "profile" && (
            <>
              <div className="banner">
                <div className="profile-photo-wrapper">
                  <img src={profileImage} className="profile-photo" alt="Alumni Profile" />
                  <button
                    className="camera-icon"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    onChange={handleProfileImageChange}
                  />
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
                        <button
                          className="bio-cancel-btn"
                          onClick={cancelEditBio}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bio-display">
                      <p className="bio">"{profileData.bio}"</p>
                      <button
                        className="bio-edit-icon"
                        onClick={startEditBio}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h2 className="section-title">My Mentorship Posts</h2>

              <Feed
                profileImage={profileImage}
                profileName={profileData.name}
                mode="profile"
              />
            </>
          )}
        </main>
        </div>
      </div>
    </>
  );
}
