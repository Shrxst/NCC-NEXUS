import React from 'react';

const MessageBubble = ({ message, currentUserId }) => {
  const isMe = Number(message.sender_user_id) === Number(currentUserId);
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message-bubble ${isMe ? 'sent' : 'received'}`}>
      <div className="msg-text">{message.body}</div>
      <div className="msg-meta">
        <span className="msg-time">{time}</span>
        {isMe && <span style={{ fontSize: '0.8rem', color: '#53bdeb' }}>OK</span>}
      </div>
    </div>
  );
};

export default MessageBubble;
