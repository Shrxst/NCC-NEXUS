import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { connectNotificationSocket, getNotificationSocket, disconnectNotificationSocket } from "../../features/notifications/notificationSocket";
import logoImage from "../assets/ncc-logo.png";

const NavBar = ({ onCadetLogin, onAnoLogin }) => {
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("token");

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [notifications]);

  const scrollToSection = (id) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let mounted = true;

    const fetchInitialNotifications = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/notifications", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok || !mounted) return;

        const list = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((item) => !item.is_read).length);
      } catch (error) {
        console.error("Notification fetch error:", error);
      }
    };

    fetchInitialNotifications();

    const socket = connectNotificationSocket(token) || getNotificationSocket();
    if (!socket) return () => { mounted = false; };

    const handleNewNotification = (notification) => {
      if (!mounted || !notification) return;

      setNotifications((prev) => {
        const next = [notification, ...prev.filter((item) => item.notification_id !== notification.notification_id)];
        return next;
      });

      setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      mounted = false;
      socket.off("notification:new", handleNewNotification);
    };
  }, [token]);

  const markAllAsReadLocal = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="brand cursor-pointer" onClick={() => scrollToSection("home")}>
        <div className="brand-mark">
          <img src={logoImage} alt="NCC Nexus logo" />
        </div>
        <div className="brand-text">
          <span className="brand-title">NCC NEXUS</span>
          <span className="brand-subtitle">National Cadet Corps</span>
        </div>
      </div>

      <nav className="nav-links">
        <button onClick={() => scrollToSection("home")} className="nav-btn">Home</button>
        <button onClick={() => scrollToSection("about")} className="nav-btn">About NCC</button>
        <button onClick={() => scrollToSection("structure")} className="nav-btn">Structure</button>

        {token ? (
          <div className="notification-dropdown" ref={notificationRef} style={{ position: "relative" }}>
            <button
              className="nav-btn"
              type="button"
              onClick={() => {
                setNotificationOpen((prev) => !prev);
                if (!notificationOpen) markAllAsReadLocal();
              }}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FaBell />
              {unreadCount > 0 ? (
                <span
                  className="unread-badge"
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "999px",
                    background: "#e53935",
                    color: "#fff",
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                  }}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {notificationOpen ? (
              <div
                className="notification-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: "320px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.97)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: "12px",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
                  padding: "8px",
                  zIndex: 1000,
                }}
              >
                {sortedNotifications.length === 0 ? (
                  <div style={{ padding: "12px", color: "#5a6078", fontSize: "0.88rem" }}>No notifications yet.</div>
                ) : (
                  sortedNotifications.map((item) => (
                    <div
                      key={item.notification_id}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #f1f5f9",
                        background: item.is_read ? "#fff" : "#f8fafc",
                        borderRadius: "8px",
                        marginBottom: "2px",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", color: "#1a1d2e" }}>{item.message}</div>
                      <div style={{ fontSize: "0.72rem", color: "#5a6078", marginTop: "4px" }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "Just now"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="login-dropdown" ref={dropdownRef}>
            <button className="nav-login" type="button" onClick={() => setOpen(!open)}>
              Login
            </button>

            {open && (
              <div className="login-menu">
                <button onClick={() => { setOpen(false); onCadetLogin(); }}>
                  Cadet Login
                </button>
                <button onClick={() => { setOpen(false); onAnoLogin(); }}>
                  ANO Login
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
};

export default NavBar;

