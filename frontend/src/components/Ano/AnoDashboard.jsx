import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { closeAnoSidebar, toggleAnoSidebar } from "../../features/ui/uiSlice";
import Sidebar from "./SideBar";
import "./ano.css";

const AnoDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAnoSidebarOpen = useSelector((state) => state.ui.isAnoSidebarOpen);

  // 🔒 SECURITY CHECK
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    // If no token or not an ANO, kick them out
    if (!token || role !== "ANO") {
      navigate("/"); // Redirect to Login Landing Page
    }
  }, [navigate]);

  return (
    <div className="ano-dashboard-layout">
      {/* Mobile backdrop */}
      {isAnoSidebarOpen ? (
        <button
          type="button"
          className="ano-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => dispatch(closeAnoSidebar())}
        />
      ) : null}

      <Sidebar
        isOpen={isAnoSidebarOpen}
        onClose={() => dispatch(closeAnoSidebar())}
      />
      <main className="ano-dashboard-content">
        <div className="ano-topbar">
          <button
            type="button"
            className="ano-sidebar-toggle"
            aria-label="Toggle sidebar"
            onClick={() => dispatch(toggleAnoSidebar())}
          >
            ☰
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AnoDashboard;