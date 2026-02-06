import React, { useState, useRef } from "react";
import {
  User,
  MapPin,
  Image as ImageIcon,
  LogOut,
  Camera,
  Edit2,
  KeyRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./dashboard.css";
import logoImage from "../assets/ncc-logo.png";
import Feed from "./Feed";
import ResetPasswordModal from "./ResetPasswordModal";
import Chatbot from "./Chatbot";
import { closeCadetSidebar } from "../../features/ui/uiSlice";

export default function CadetDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState("profile");
  const [showReset, setShowReset] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profileImage, setProfileImage] = useState(
    "https://images.unsplash.com/photo-1607746882042-944635dfe10e"
  );

  const [profileData, setProfileData] = useState({
    name: "Shami Dubey",
    rank: "Sergeant (SGT)",
    location: "1 PB BN NCC, Ludhiana",
    bio:
      "Focused on leadership and community service. Dedicated to the NCC motto: Unity and Discipline.",
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
      <div className="cadet-dashboard">
        {showReset && (
          <ResetPasswordModal onClose={() => setShowReset(false)} />
        )}
        <div className="layout">

        {/* ================= SIDEBAR ================= */}
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div>
            <div className="sidebar-header">
              <img src={logoImage} className="sidebar-logo" alt="NCC Logo" />
              <div className="logo-text">
                <h1>NCC NEXUS</h1>
                <p>CADET DASHBOARD</p>
              </div>
            </div>

            <div className="nav-list">
              <button
                className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("profile");
                  setSidebarOpen(false);
                }}
              >
                <User size={18} />
                <span>Profile</span>
              </button>

              <button
                className={`nav-item ${activeTab === "feed" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("feed");
                  setSidebarOpen(false);
                }}
              >
                <MapPin size={18} />
                <span>Feed</span>
              </button>

              <button
                className={`nav-item ${activeTab === "chatbot" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("chatbot");
                  setSidebarOpen(false);
                }}
              >
                🤖 <span>Chatbot</span>
              </button>

              <button className="nav-item" onClick={() => setSidebarOpen(false)}>
                <ImageIcon size={18} />
                <span>Certificates</span>
              </button>

              <button
                className="nav-item"
                onClick={() => {
                  setShowReset(true);
                  setSidebarOpen(false);
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
              dispatch(closeCadetSidebar());
              navigate("/");
            }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </aside>

        {/* ================= BACKDROP (NOW CORRECT POSITION) ================= */}
        {sidebarOpen && (
          <div
            className="cadet-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ================= MAIN ================= */}
        <main className={`main ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="cadet-topbar">
            <button
              type="button"
              className="cadet-sidebar-toggle"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
          </div>

          {activeTab === "chatbot" && <Chatbot />}

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
                  <img src={profileImage} className="profile-photo" />
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

              <h2 className="section-title">Recent Activity</h2>

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



