import React from 'react';

const ChatTabs = ({ userRole, activeTab, onTabChange }) => {
  const getTabsForRole = (role) => {
    const baseTabs = ['All', 'Unread', 'Groups'];

    switch (String(role || '').toLowerCase()) {
      case 'cadet':
        return [...baseTabs, 'Cadets', 'SUO', 'Alumni', 'ANO'];
      case 'suo':
        return [...baseTabs, 'Cadets', 'Alumni', 'ANO'];
      case 'alumni':
        return [...baseTabs, 'Cadets', 'SUO', 'ANO'];
      case 'ano':
        return [...baseTabs, 'Cadets', 'SUO', 'Alumni'];
      default:
        return baseTabs;
    }
  };

  const tabs = getTabsForRole(userRole);

  return (
    <div className="chat-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`chat-tab-btn ${activeTab === tab ? 'active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default ChatTabs;
