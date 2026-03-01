import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { LogOut } from "lucide-react";
import { closeAnoSidebar, toggleAnoSidebar } from "../../features/ui/uiSlice";
import Sidebar from "./SideBar";
import { clearAuthStorage, hasAuthFor } from "../../utils/authState";
import "./ano.css";

const AnoDashboard = () => {
  const ANO_LAST_ROUTE_KEY = "ano_dashboard_last_route";

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAnoSidebarOpen = useSelector((state) => state.ui.isAnoSidebarOpen);

  useEffect(() => {
    if (!hasAuthFor(["ANO"])) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (location.pathname.startsWith("/ano")) {
      localStorage.setItem(ANO_LAST_ROUTE_KEY, location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/ano") return;

    const lastRoute = localStorage.getItem(ANO_LAST_ROUTE_KEY);
    if (lastRoute && lastRoute !== "/ano" && lastRoute.startsWith("/ano")) {
      navigate(lastRoute, { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="ano-dashboard-layout">
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
        <div className="ano-tricolor-bar" />
        <div className="ano-topbar">
          <button
            type="button"
            className="ano-sidebar-toggle"
            aria-label="Toggle sidebar"
            onClick={() => dispatch(toggleAnoSidebar())}
          >
            Menu
          </button>
          <button
            className="topbar-logout"
            onClick={() => {
              dispatch(closeAnoSidebar());
              clearAuthStorage();
              navigate("/");
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AnoDashboard;
