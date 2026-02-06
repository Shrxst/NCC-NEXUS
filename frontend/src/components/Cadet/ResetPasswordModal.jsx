import { useState } from "react";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import "./ResetPasswordModal.css";


const ResetPasswordModal = ({ onClose }) => {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card reset-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button className="modal-close3" onClick={onClose}>
          ✕
        </button>

        <h2 className="reset-title">Reset Password</h2>

        <div className="reset-form">
          {/* Current Password */}
          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Current Password"
            />
            <span
              className="eye-icon"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* New Password */}
          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password"
            />
            <span
              className="eye-icon"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <div className="input-icon-wrapper">
              <FaLock className="input-icon" />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password"
            />
            <span
              className="eye-icon"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="reset-actions">
            <button className="reset-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="reset-submit">
              Reset Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;

