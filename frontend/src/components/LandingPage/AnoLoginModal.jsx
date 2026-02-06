import AnoLogin from "./AnoLogin";
import "./AnoLoginModal.css";

const AnoLoginModal = ({ onClose }) => {
  return (
    <div className="modal-overlay ano-login-modal" onClick={onClose}>
      <div className="modal-content ano-login-content" onClick={(e) => e.stopPropagation()}>
        
        {/* 🔥 CRITICAL FIX: Passing onClose prop to the child */}
        <AnoLogin isModal={true} onClose={onClose} />
        
      </div>
    </div>
  );
};

export default AnoLoginModal;
