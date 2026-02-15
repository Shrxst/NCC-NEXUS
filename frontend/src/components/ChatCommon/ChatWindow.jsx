import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatWindow = ({
  isHidden,
  chatData,
  messages,
  onSendMessage,
  onTyping,
  onBack,
  isMobile,
  currentUserId,
  typingUsers = [],
}) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!chatData) {
    return (
      <div className={`chat-window ${isHidden ? 'hidden' : ''}`}>
        <div className="empty-state">
          <h2>NCC Connect Web</h2>
          <p>Select a conversation to start messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-window ${isHidden ? 'hidden' : ''}`}>
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isMobile && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: '#fff', marginRight: 10, fontSize: '1.2rem' }}
            >
              {'<'}
            </button>
          )}

          <div className="avatar-circle" style={{ width: 35, height: 35, fontSize: '0.8rem' }}>
            {chatData.name.substring(0, 2).toUpperCase()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 500 }}>{chatData.name}</span>
            <span style={{ fontSize: '0.75rem', color: '#8696a0' }}>
              {typingUsers.length > 0 ? 'Typing...' : (chatData.online ? 'Online' : 'Offline')}
            </span>
          </div>
        </div>
      </div>

      <div className="messages-area">
        {messages.map((msg) => (
          <MessageBubble key={msg.message_id} message={msg} currentUserId={currentUserId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={onSendMessage} onTyping={onTyping} disabled={!chatData} />
    </div>
  );
};

export default ChatWindow;
