import { useState } from "react";
import {
  FaMedal,
  FaLock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "/src/index.css";
import nccLogo from "./assets/ncc-logo.png";

const LoginPage = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("CADET");

  const handleLogin = () => {
    if (role === "CADET") {
      navigate("/dashboard");
    } else if (role === "SUO") {
      alert("SUO dashboard not implemented yet");
    } else {
      alert("Alumni dashboard not implemented yet");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* LIGHT OVERLAY FOR RIGHT-SIDE GLOW */}
        <span className="card-glow" />

        {/* LOGO */}
        <img src={nccLogo} alt="NCC Logo" className="login-logo" />
        <h1 className="login-title">NCC NEXUS</h1>

        <div className="login-form">
          <div className="input-group">
            <FaMedal className="input-icon" />
            <input type="text" placeholder="REGIMENTAL NUMBER" />
          </div>

          <div className="input-group">
            <FaLock className="input-icon" />
            <input type="password" placeholder="PASSWORD" />
          </div>

          {/* ROLE SWITCH */}
          <div className="role-select">
            {["CADET", "SUO", "ALUMNI"].map((item) => (
              <button
                key={item}
                className={role === item ? "active" : ""}
                onClick={() => setRole(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          {/* LOGIN BUTTON */}
          <button className="login-btn" onClick={handleLogin}>
            LOGIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
