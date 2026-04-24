import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { LogOut, Bell } from "lucide-react";
import { closeAnoSidebar, toggleAnoSidebar } from "../../features/ui/uiSlice";
import Sidebar from "./SideBar";
import NotificationPanel from "../Notifications/NotificationPanel";
import { connectNotificationSocket, getNotificationSocket } from "../../features/notifications/notificationSocket";
import { clearAuthStorage, hasAuthFor } from "../../utils/authState";
import { API_BASE_URL } from "../../api/config";
import "./ano.css";

const AnoDashboard = () => {
  const ANO_LAST_ROUTE_KEY = "ano_dashboard_last_route";

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAnoSidebarOpen = useSelector((state) => state.ui.isAnoSidebarOpen);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

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

  // ── Notification fetch + socket ──
  useEffect(() => {
    const tk = localStorage.getItem("token");
    if (!tk) return;

    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const data = await res.json();
        if (!res.ok || !mounted) return;
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.is_read).length);
      } catch (err) {
        console.error("Notification fetch error:", err);
      }
    };

    fetchNotifications();

    const socket = connectNotificationSocket(tk) || getNotificationSocket();
    if (!socket) return () => { mounted = false; };

    const handleNew = (notification) => {
      if (!mounted || !notification) return;
      setNotifications((prev) => [notification, ...prev.filter((n) => n.notification_id !== notification.notification_id)]);
      setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
    };

    socket.on("notification:new", handleNew);

    return () => {
      mounted = false;
      socket.off("notification:new", handleNew);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllReadLocal = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

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

          <div className="topbar-notif-wrapper" ref={notifRef}>
            <button
              type="button"
              className="topbar-notif-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                if (!notifOpen) markAllReadLocal();
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="topbar-notif-badge">{unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="topbar-notif-dropdown">
                <NotificationPanel />
              </div>
            )}
          </div>

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
