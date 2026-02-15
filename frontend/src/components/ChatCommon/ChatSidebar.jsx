import React from 'react';
import ChatTabs from './ChatTabs';
import ChatList from './ChatList';

const ChatSidebar = ({
  isHidden,
  userRole,
  currentUserName,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  conversations,
  selectedChatId,
  onSelectChat,
  isLoading,
  error,
  onRetry,
}) => {
  const initials = String(currentUserName || 'Me').substring(0, 2).toUpperCase();

  return (
    <div className={`chat-sidebar ${isHidden ? 'hidden' : ''}`}>
      <div className="chat-header">
        <div className="avatar-circle" style={{ width: 35, height: 35, fontSize: '0.8rem' }}>
          {initials}
        </div>
        <div style={{ fontWeight: 'bold' }}>NCC Chats</div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search chats"
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <ChatTabs userRole={userRole} activeTab={activeTab} onTabChange={setActiveTab} />

      <ChatList
        chats={conversations}
        selectedId={selectedChatId}
        onSelect={onSelectChat}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    </div>
  );
};

export default ChatSidebar;
