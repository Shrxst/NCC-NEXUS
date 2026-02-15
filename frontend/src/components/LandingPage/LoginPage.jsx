import { useState } from "react";
import { FaMedal, FaLock, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import nccLogo from "../assets/ncc-logo.png";

const LoginPage = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState("CADET");
  const [regimentalNo, setRegimentalNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const payload = {
      regimental_no: regimentalNo.trim(),
      password: password.trim(),
      login_type: role,
    };

    if (!payload.regimental_no || !payload.password) {
      alert("Please enter regimental number and password.");
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
        alert(`Login Failed: ${data.message || "Invalid Credentials"}`);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", role);
      localStorage.setItem("user", JSON.stringify(data.user));

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
              placeholder="Regimental Number"
              value={regimentalNo}
              onChange={(e) => setRegimentalNo(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="input-wrapper">
          <div className="input-group has-icon">
            <FaLock className="input-icon" />
            <input
              type="password"
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
