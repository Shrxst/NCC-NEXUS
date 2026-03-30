import { useState } from "react";
import { FaArrowLeft, FaLock, FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import nccLogo from "../assets/ncc-logo.png";
import ResetPasswordModal from "../Cadet/ResetPasswordModal";

const AnoLogin = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // 🔥 CORE LOGIC: Handle Login
  const handleLogin = async () => {
    // 1. Basic Validation
    if (!credentials.email || !credentials.password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      // ✅ CORRECT URL: Matches app.js (/api/auth) + auth.routes.js (/ano/login)
      const response = await fetch("http://localhost:5000/api/auth/ano/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        // ✅ SUCCESS: Save Token & Role
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "ANO"); // Critical for security checks
        localStorage.setItem("system_role", data.user?.role || "ANO");
        localStorage.setItem("rank", data.user?.rank || "");
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...(data.user || {}),
            name: data.user?.name || data.user?.username || "ANO",
          })
        );

        // ❌ REMOVED: Alert("✅ Login Successful!"); 

        // Close modal if open
        if (isModal && onClose) {
          onClose();
        }

        // Navigate to Dashboard
        navigate("/ano"); 
      } else {
        // ❌ ERROR from Backend
        alert(`Login Failed: ${data.message || "Invalid Credentials"}`);
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("❌ Server Error: Failed to connect to the backend.");
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="ano-card">
      {/* Close Button Implementation */}
      {isModal && (
        <button 
          className="card-close-btn" 
          onClick={(e) => {
            e.stopPropagation(); 
            if (onClose) onClose(); 
          }}
        >
          <FaTimes />
        </button>
      )}

      <span className="card-glow" />

      <div className="ano-header">
        <div className="ano-icon">
          <img src={nccLogo} alt="NCC Logo" />
        </div>
        <h1>ANO Login</h1>
        <p>Associate NCC Officer Access</p>
      </div>

      <div className="restricted-box">
        <FaLock /> Restricted access for Authorized NCC Officers only
      </div>

      {/* Inputs */}
      <div className="input-wrapper">
        <label>Official Email</label>
        <div className="input-group">
          <input
            type="email"
            placeholder="officer@ncc.gov.in"
            value={credentials.email}
            onChange={(e) => setCredentials({...credentials, email: e.target.value})}
          />
        </div>
      </div>

      <div className="input-wrapper">
        <label>Secure Password</label>
        <div className="password-box">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            // Allow Enter key to trigger login
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />
          <div className="password-eye" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </div>
        </div>
      </div>

      {/* Login Button with onClick handler */}
      <button 
        className="authorize-btn" 
        onClick={handleLogin} 
        disabled={loading}
      >
        {loading ? "Verifying..." : "AUTHORIZE ACCESS"}
      </button>

      <p className="ano-footer-text">
        This system is for authorized use only. All activities are monitored.
      </p>
    </div>
  );

  return (
    <div className={isModal ? "ano-login-card" : "ano-login-page"}>
      {!isModal && (
        <button className="back-home" onClick={() => navigate("/")}>
          <FaArrowLeft /> Back to Home
        </button>
      )}
      {card}
      {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
    </div>
  );
};

export default AnoLogin;
