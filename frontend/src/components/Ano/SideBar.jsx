import { NavLink } from "react-router-dom";
import { FaUserPlus, FaUsers, FaComments, FaClipboardList, FaTachometerAlt, FaVideo, FaBullhorn } from "react-icons/fa";
import nccLogo from "../assets/ncc-logo.png";

const Sidebar = ({ isOpen = true, onClose }) => {
  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      <div className="sidebar-top-section">
        <div className="sidebar-header">
          <div className="sidebar-logo-ring">
            <img src={nccLogo} alt="NCC Logo" className="sidebar-logo" />
          </div>
          <div className="sidebar-brand">
            <h3>NCC NEXUS</h3>
            <span>ANO COMMAND PORTAL</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="menu">
          <NavLink
            to="/ano"
            end
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaTachometerAlt /> <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="add-cadet"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaUserPlus /> <span>Add Cadet</span>
          </NavLink>

          <NavLink
            to="manage-cadets"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaUsers /> <span>Manage Cadets</span>
          </NavLink>

          <NavLink
            to="ano-attendance"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaClipboardList /> <span>Attendance</span>
          </NavLink>

          <NavLink
            to="meetings"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaVideo /> <span>Meetings</span>
          </NavLink>

          <NavLink
            to="chat"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaComments /> <span>Chat</span>
          </NavLink>

          <NavLink
            to="community"
            className="menu-item"
            onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
          >
            <FaBullhorn /> <span>Community</span>
          </NavLink>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
