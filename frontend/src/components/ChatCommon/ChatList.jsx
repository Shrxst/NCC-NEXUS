import React from 'react';

const ChatList = ({ chats, selectedId, onSelect, isLoading = false, error = '', onRetry }) => {
  if (isLoading) {
    return (
      <div className="empty-state" style={{ height: '200px' }}>
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" style={{ height: '220px', padding: '14px' }}>
        <p style={{ marginBottom: 12 }}>{error}</p>
        <button className="chat-tab-btn active" onClick={onRetry} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (!chats.length) {
    return (
      <div className="empty-state" style={{ height: '200px' }}>
        <p>No users found.</p>
      </div>
    );
  }

  return (
    <div className="chat-list">
      {chats.map((chat) => {
        const disabled = chat.canStartChat === false;

        return (
          <div
            key={chat.id}
            className={`chat-item ${selectedId === chat.id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onSelect(chat.id)}
            style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <div className="avatar-circle">
              {chat.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="chat-info">
              <div className="chat-name-row">
                <span className="chat-name">{chat.name}</span>
                <span className="chat-time">{chat.timestamp}</span>
              </div>

              <div className="chat-preview-row">
                <span className="chat-last-msg">
                  {disabled
                    ? 'Chat not allowed for this role pair'
                    : (chat.lastMessage || 'Start a conversation')}
                </span>

                {chat.unread > 0 && (
                  <div className="unread-badge">{chat.unread}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatList;
