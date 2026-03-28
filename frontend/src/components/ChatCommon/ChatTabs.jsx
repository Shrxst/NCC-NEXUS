import React, { useEffect, useRef, useState } from 'react';

const ChatTabs = ({ userRole, activeTab, onTabChange }) => {
  const tabsViewportRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  useEffect(() => {
    const tabsViewport = tabsViewportRef.current;

    if (!tabsViewport) return undefined;

    const updateArrowState = () => {
      const remainingRight =
        tabsViewport.scrollWidth - tabsViewport.clientWidth - tabsViewport.scrollLeft;
      setCanScrollRight(remainingRight > 8);
    };

    updateArrowState();
    tabsViewport.addEventListener('scroll', updateArrowState);
    window.addEventListener('resize', updateArrowState);

    return () => {
      tabsViewport.removeEventListener('scroll', updateArrowState);
      window.removeEventListener('resize', updateArrowState);
    };
  }, [tabs.length]);

  const handleScrollRight = () => {
    if (!tabsViewportRef.current) return;

    tabsViewportRef.current.scrollBy({
      left: 150,
      behavior: 'smooth',
    });
  };

  return (
    <div className="chat-tabs-shell">
      <div className="chat-tabs-viewport" ref={tabsViewportRef}>
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
      </div>

      {canScrollRight && (
        <div className="chat-tabs-arrow-wrap">
          <button
            type="button"
            className="chat-tabs-arrow"
            onClick={handleScrollRight}
            aria-label="Show more chat tabs"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatTabs;
