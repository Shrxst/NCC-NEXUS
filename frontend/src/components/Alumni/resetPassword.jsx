import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import "./resetPassword.css";

const ResetPasswordModal = ({ onClose }) => {
  const navigate = useNavigate();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      alert("All fields are required.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("system_role");
          localStorage.removeItem("rank");
          localStorage.removeItem("user");
          alert("Session expired. Please login again.");
          onClose();
          navigate("/");
          return;
        }

        alert(data.message || "Failed to reset password.");
        return;
      }

      alert(data.message || "Password updated successfully.");
      onClose();
    } catch (error) {
      console.error("Alumni Reset Password Error:", error);
      alert("Server error: unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card reset-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close3" onClick={onClose}>
          X
        </button>

        <h2 className="reset-title">Reset Password</h2>

        <div className="reset-form">
          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
            />
            <span
              className="eye-icon"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
            <span
              className="eye-icon"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={submitting}
            />
            <span
              className="eye-icon"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="reset-actions">
            <button className="reset-cancel" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button className="reset-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Updating..." : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;


