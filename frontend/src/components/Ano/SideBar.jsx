import { NavLink } from "react-router-dom";
import { FaUserPlus, FaUsers, FaSignOutAlt } from "react-icons/fa";
import nccLogo from "../assets/ncc-logo.png";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      
      <div className="sidebar-header">
        <img src={nccLogo} alt="NCC Logo" className="sidebar-logo" />
        <div>
          <h3>NCC Nexus</h3>
          <span>ANO Portal</span>
        </div>
      </div>

      <nav className="menu">
        <NavLink to="add-cadet" className="menu-item">
          <FaUserPlus /> Add Cadet
        </NavLink>

        <NavLink to="manage-cadets" className="menu-item">
          <FaUsers /> Manage Cadets
        </NavLink>

        <button className="menu-item logout">
          <FaSignOutAlt /> Logout
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
