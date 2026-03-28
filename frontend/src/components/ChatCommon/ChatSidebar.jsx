import React from 'react';
import ChatTabs from './ChatTabs';
import ChatList from './ChatList';
import nccLogo from '../assets/ncc-logo.png';

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
  return (
    <div className={`chat-sidebar ${isHidden ? 'hidden' : ''}`}>
      <div className="chat-header">
        <div className="chat-sidebar-brand">
          <img src={nccLogo} alt="NCC logo" className="chat-sidebar-logo" />
          <div className="chat-sidebar-title">NCC Chats</div>
        </div>
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
