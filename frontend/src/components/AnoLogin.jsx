import { useState } from "react";
import { FaArrowLeft, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

// ✅ FIXED IMPORT PATH
import nccLogo from "./assets/ncc-logo.png"; 

import ResetPasswordModal from "./ResetPasswordModal"; 

const AnoLogin = ({ isModal = false }) => {
  const navigate = useNavigate();

  // 1️⃣ UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // 2️⃣ Form Data & API States
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle Input Change
  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError(""); // Clear error when user types
  };

  // 🔥 HANDLE LOGIN (API INTEGRATION)
  const handleLogin = async () => {
    // Basic Validation
    if (!credentials.email || !credentials.password) {
      setError("Please fill in both Email and Password.");
      return;
    }

    setLoading(true);

    try {
      // API Call
      const response = await fetch("http://localhost:5000/api/auth/ano/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        // ✅ SUCCESS
        // Store Token & Role (Critical for Dashboard Security)
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user.role); // Should be "ANO"
        localStorage.setItem("user", JSON.stringify(data.user));

        // Redirect to ANO Dashboard
        navigate("/ano");
      } else {
        // ❌ FAILURE (Backend Error)
        setError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("Server error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Support "Enter" key submission
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className={isModal ? "ano-login-card" : "ano-login-page"}>

      {/* Back button ONLY for full page */}
      {!isModal && (
        <button className="back-home" onClick={() => navigate("/")}>
          <FaArrowLeft /> Back to Home
        </button>
      )}

      {/* Header */}
      <div className="ano-header">
        <div className="ano-icon">
          <img src={nccLogo} alt="NCC Logo" />
          <span className="alert-dot" />
        </div>

        <h1>ANO Login</h1>
        <p>Associate NCC Officer Access</p>
      </div>

      {/* Login Card */}
      <div className="ano-card">
        <div className="restricted-box">
          <FaLock />
          Restricted access for Authorized NCC Officers only
        </div>

        {/* 🚨 Error Message Display */}
        {error && (
          <div style={{ 
            color: "#d32f2f", 
            backgroundColor: "#ffebee", 
            padding: "10px", 
            borderRadius: "4px", 
            fontSize: "0.9rem",
            marginBottom: "15px",
            textAlign: "center",
            border: "1px solid #ef9a9a"
          }}>
            {error}
          </div>
        )}

        <label>Official Email</label>
        <input
          type="email"
          name="email"
          value={credentials.email}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="officer@ncc.gov.in"
          disabled={loading}
        />

        <label>Secure Password</label>
        <div className="password-box">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={credentials.password}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your password"
            disabled={loading}
          />

          {showPassword ? (
            <FaEyeSlash
              className="password-eye"
              onClick={() => setShowPassword(false)}
            />
          ) : (
            <FaEye
              className="password-eye"
              onClick={() => setShowPassword(true)}
            />
          )}
        </div>

        {/* 🔥 LOGIN BUTTON */}
        <button 
          className="authorize-btn" 
          onClick={handleLogin}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Verifying..." : "Authorize Access"}
        </button>
      </div>

      {/* Footer text */}
      <p className="ano-footer-text">
        This system is for authorized use only. All activities are monitored and logged.
      </p>

      {/* Reset Password Modal */}
      {showReset && (
        <ResetPasswordModal onClose={() => setShowReset(false)} />
      )}
    </div>
  );
};

export default AnoLogin;