import { useState, useEffect, useMemo } from "react";
import { Bell, Check } from "lucide-react";
import { connectNotificationSocket, getNotificationSocket } from "../../features/notifications/notificationSocket";
import { API_BASE_URL } from "../../api/config";
import "./notificationPanel.css";

const NotificationPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [notifications]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !mounted) return;

        const list = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((item) => !item.is_read).length);
      } catch (err) {
        console.error("Notification fetch error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNotifications();

    const socket = connectNotificationSocket(token) || getNotificationSocket();
    if (!socket) return () => { mounted = false; };

    const handleNew = (notification) => {
      if (!mounted || !notification) return;
      setNotifications((prev) => {
        const next = [notification, ...prev.filter((item) => item.notification_id !== notification.notification_id)];
        return next;
      });
      setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
    };

    socket.on("notification:new", handleNew);

    return () => {
      mounted = false;
      socket.off("notification:new", handleNew);
    };
  }, [token]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "Just now";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "Just now";
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <div className="notif-panel-title">
          <Bell size={18} />
          <h3>Notifications</h3>
          {unreadCount > 0 && (
            <span className="notif-unread-badge">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="notif-mark-read" onClick={markAllRead} type="button">
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="notif-panel-list">
        {loading ? (
          <div className="notif-empty">Loading notifications...</div>
        ) : sortedNotifications.length === 0 ? (
          <div className="notif-empty">No notifications yet.</div>
        ) : (
          sortedNotifications.map((item) => (
            <div
              key={item.notification_id}
              className={`notif-item ${item.is_read ? "" : "notif-item-unread"}`}
            >
              <div className="notif-dot" />
              <div className="notif-item-content">
                <p className="notif-message">{item.message}</p>
                <span className="notif-time">{formatTime(item.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
