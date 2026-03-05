import { useState } from "react";
import { FaMedal, FaLock, FaTimes, FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { connectChatSocket, disconnectChatSocket } from "../../features/ui/socket";
import { connectFeedSocket, disconnectFeedSocket } from "../../features/feed/feedSocket";
import { connectNotificationSocket, disconnectNotificationSocket } from "../../features/notifications/notificationSocket";
import nccLogo from "../assets/ncc-logo.png";

const decodeJwtPayload = (token = "") => {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const LoginPage = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState("CADET");
  const [regimentalNo, setRegimentalNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const payload = {
      regimental_no: regimentalNo.trim(),
      password: password.trim(),
      login_type: role,
    };

    if (!payload.regimental_no || !payload.password) {
      alert(role === "ALUMNI" ? "Please enter alumni email/username and password." : "Please enter regimental number and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/cadet/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Clear stale auth to prevent unauthorized notification/socket noise.
        disconnectChatSocket();
        disconnectFeedSocket();
        disconnectNotificationSocket();
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("system_role");
        localStorage.removeItem("rank");
        localStorage.removeItem("user");

        alert(`Login Failed: ${data.message || "Invalid Credentials"}`);
        return;
      }

      const token = data.token;
      const tokenPayload = decodeJwtPayload(token);
      const normalizedUser = {
        ...(data.user || {}),
        user_id: Number(data.user?.user_id || tokenPayload?.user_id || 0) || undefined,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("system_role", normalizedUser?.role || "");
      localStorage.setItem("rank", normalizedUser?.rank || "");
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      // Connect all real-time channels immediately after login.
      connectChatSocket(token);
      connectFeedSocket(token);
      connectNotificationSocket(token);

      if (role === "SUO") {
        navigate("/suo-dashboard");
      } else if (role === "ALUMNI") {
        navigate("/alumni-dashboard");
      } else {
        navigate("/dashboard");
      }

      if (isModal && onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Cadet Login Error:", error);
      alert("Server error: failed to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="login-card">
      {isModal && (
        <button className="card-close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      )}

      <span className="card-glow" />

      <img src={nccLogo} alt="NCC Logo" className="login-logo" />
      <h1 className="login-title">NCC NEXUS</h1>

      <div className="role-select">
        {["CADET", "SUO", "ALUMNI"].map((item) => (
          <button
            key={item}
            className={role === item ? "active" : ""}
            onClick={() => setRole(item)}
            type="button"
            disabled={loading}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="login-form">
        <div className="input-wrapper">
          <div className="input-group has-icon">
            <FaMedal className="input-icon" />
            <input
              type="text"
              placeholder={role === "ALUMNI" ? "Email / Username / Regimental No." : "Regimental Number"}
              value={regimentalNo}
              onChange={(e) => setRegimentalNo(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="input-wrapper">
          <div className="password-box has-icon">
            <FaLock className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLogin();
                }
              }}
              disabled={loading}
            />
            <div className="password-eye" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </div>
          </div>
        </div>

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </div>
    </div>
  );

  return isModal ? card : <div className="login-page">{card}</div>;
};

export default LoginPage;



