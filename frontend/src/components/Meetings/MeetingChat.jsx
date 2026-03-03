import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { getCurrentUser } from "./meetingUtils";
import "./meetingModule.css";

const MeetingChat = () => {
  const currentUser = getCurrentUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        userId: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");
  };

  return (
    <div className="meeting-chat">
      <div className="meeting-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="meeting-chat-empty">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`meeting-chat-msg ${msg.userId === currentUser.id ? "meeting-chat-msg-own" : ""}`}
            >
              <div className="meeting-chat-msg-head">
                <strong>{msg.name}</strong>
                <span className="meeting-user-role">{msg.role}</span>
                <span className="meeting-chat-time">{msg.time}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))
        )}
      </div>

      <form className="meeting-chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="meeting-icon-btn" disabled={!input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default MeetingChat;
