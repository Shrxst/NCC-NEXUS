import { useState } from "react";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import "./ResetPasswordModal.css";

const ResetPasswordModal = ({ onClose }) => {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetPassword = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmNewPassword) {
      alert("Please fill all fields.");
      return;
    }

    if (form.newPassword !== form.confirmNewPassword) {
      alert("New passwords do not match.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Reset failed: ${data.message || "Unable to reset password"}`);
        return;
      }

      alert(data.message || "Password updated successfully.");
      onClose();
    } catch (error) {
      console.error("Reset Password Error:", error);
      alert("Server error: failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card reset-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close3" onClick={onClose}>
          x
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
              value={form.currentPassword}
              onChange={(e) => handleChange("currentPassword", e.target.value)}
              disabled={loading}
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
              value={form.newPassword}
              onChange={(e) => handleChange("newPassword", e.target.value)}
              disabled={loading}
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
              value={form.confirmNewPassword}
              onChange={(e) => handleChange("confirmNewPassword", e.target.value)}
              disabled={loading}
            />
            <span
              className="eye-icon"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="reset-actions">
            <button className="reset-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button className="reset-submit" onClick={handleResetPassword} disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
