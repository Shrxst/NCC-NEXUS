import { NavLink, useNavigate } from "react-router-dom";
import { FaUserPlus, FaUsers, FaSignOutAlt } from "react-icons/fa";
import nccLogo from "../assets/ncc-logo.png";

const Sidebar = ({ isOpen = true, onClose }) => {
  const navigate = useNavigate();

  // 🔥 Logout handler
  const handleLogout = () => {
    // 1. Clear Credentials
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    // 2. Close Sidebar (Mobile)
    if (typeof onClose === "function") onClose();

    // 3. Redirect to Landing Page
    navigate("/"); 
  };

  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      {/* Header */}
      <div className="sidebar-header">
        <img src={nccLogo} alt="NCC Logo" className="sidebar-logo" />
        <div>
          <h3>NCC Nexus</h3>
          <span>ANO Portal</span>
        </div>
      </div>

      {/* Menu */}
      <nav className="menu">
        <NavLink
          to="add-cadet"
          className="menu-item"
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <FaUserPlus /> Add Cadet
        </NavLink>

        <NavLink
          to="manage-cadets"
          className="menu-item"
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <FaUsers /> Manage Cadets
        </NavLink>

        {/* 🔥 Logout */}
        <button
          type="button"
          className="menu-item logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt /> Logout
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;