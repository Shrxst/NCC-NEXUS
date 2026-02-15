import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import './chatCommon.css';
import {
  getAuthContext,
  fetchChatListApi,
  fetchCollegeUsersApi,
  fetchRoomMessagesApi,
  markAsReadApi,
  createDirectRoomApi,
  sendMessageApi,
} from '../../features/ui/chatApi';
import {
  connectChatSocket,
  disconnectChatSocket,
  bindChatSocketEvents,
  getSocket,
  joinSocketRoom,
  leaveSocketRoom,
  sendSocketMessage,
  emitTyping,
} from '../../features/ui/socket';

function formatTimestamp(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toConversation(item) {
  return {
    id: item.entry_id,
    roomId: item.room_id ? Number(item.room_id) : null,
    itemType: item.item_type || 'room',
    peerUserId: item.peer_user_id ? Number(item.peer_user_id) : null,
    peerRole: item.peer_role || null,
    name: item.room_name || 'Direct Chat',
    type: item.room_type === 'group' ? 'group' : 'individual',
    roleCategory: item.role_category || 'All',
    lastMessage: item.last_message?.body || '',
    lastMessageSender: item.last_message?.sender_role || '',
    timestamp: formatTimestamp(item.last_message_at || item.last_message?.created_at),
    unread: Number(item.unread_count || 0),
    online: Boolean(item.online),
    participants: item.participants || [],
    canStartChat: item.can_start_chat !== false,
  };
}

function mergeMessages(existing, incoming) {
  const map = new Map(existing.map((msg) => [Number(msg.message_id), msg]));
  map.set(Number(incoming.message_id), incoming);
  return [...map.values()].sort((a, b) => Number(a.message_id) - Number(b.message_id));
}

const ChatLayout = ({ userRole = 'cadet' }) => {
  const [conversations, setConversations] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [typingByRoom, setTypingByRoom] = useState({});

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  const activeTabRef = useRef('All');
  const selectedRoomRef = useRef(null);
  const joinedRoomRef = useRef(null);

  const auth = useMemo(() => getAuthContext(userRole), [userRole]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const fetchAndSetList = useCallback(async (filter, options = {}) => {
    if (!auth.token || !auth.userId) return [];

    const { silent = false } = options;
    if (!silent) setLoadingList(true);
    setListError('');

    const normalizedFilter = String(filter || 'All').toLowerCase();

    try {
      let chatsPayload = await fetchChatListApi({
        userId: auth.userId,
        token: auth.token,
        filter: normalizedFilter,
      });

      let entries = (chatsPayload.data?.chats || []).map(toConversation);

      if (entries.length === 0) {
        const usersPayload = await fetchCollegeUsersApi({
          userId: auth.userId,
          token: auth.token,
          filter: normalizedFilter,
        });

        entries = (usersPayload.data?.users || []).map(toConversation);
      }

      if (entries.length === 0 && normalizedFilter !== 'all') {
        const allChatsPayload = await fetchChatListApi({
          userId: auth.userId,
          token: auth.token,
          filter: 'all',
        });

        let allEntries = (allChatsPayload.data?.chats || []).map(toConversation);

        if (allEntries.length === 0) {
          const allUsersPayload = await fetchCollegeUsersApi({
            userId: auth.userId,
            token: auth.token,
            filter: 'all',
          });
          allEntries = (allUsersPayload.data?.users || []).map(toConversation);
        }

        if (allEntries.length > 0) {
          setActiveTab('All');
          entries = allEntries;
        }
      }

      setConversations(entries);
      return entries;
    } catch (error) {
      setConversations([]);
      setListError(error.message || 'Failed to load users.');
      return [];
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [auth.token, auth.userId]);

  const fetchRoomMessages = useCallback(async (roomId) => {
    if (!auth.token || !roomId) return;

    try {
      const payload = await fetchRoomMessagesApi({ roomId, token: auth.token, limit: 50 });
      const messages = payload.data?.messages || [];

      setMessagesByRoom((prev) => ({ ...prev, [roomId]: messages }));

      const last = messages[messages.length - 1];
      if (last && Number(last.sender_user_id) !== Number(auth.userId)) {
        await markAsReadApi({
          roomId,
          token: auth.token,
          upToMessageId: last.message_id,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load messages:', error.message);
    }
  }, [auth.token, auth.userId]);

  const selectRoom = useCallback(async (roomId) => {
    const entryId = `room:${Number(roomId)}`;
    setSelectedChatId(entryId);
    setSelectedRoomId(Number(roomId));
    await fetchRoomMessages(Number(roomId));

    setConversations((prev) => prev.map((chat) => (
      Number(chat.roomId) === Number(roomId) ? { ...chat, unread: 0 } : chat
    )));
  }, [fetchRoomMessages]);

  const ensureRoomForContact = useCallback(async (chatItem) => {
    if (chatItem.roomId) return chatItem.roomId;
    if (!chatItem.peerUserId) return null;

    const payload = await createDirectRoomApi({
      peerUserId: chatItem.peerUserId,
      token: auth.token,
    });

    const roomId = Number(payload.data?.room?.room_id || 0);
    if (!roomId) return null;

    const entries = await fetchAndSetList(activeTabRef.current, { silent: true });
    const found = entries.find((entry) => Number(entry.roomId) === roomId);

    if (found) {
      setSelectedChatId(found.id);
    }

    return roomId;
  }, [auth.token, fetchAndSetList]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetchAndSetList(activeTab);
  }, [activeTab, fetchAndSetList]);

  useEffect(() => {
    if (!auth.token || !auth.userId) {
      setListError('Login required.');
      return undefined;
    }

    connectChatSocket(auth.token);

    const handleNewMessage = (message) => {
      const roomId = Number(message.room_id);

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId] || [], message),
      }));

      setConversations((prev) => {
        const idx = prev.findIndex((chat) => Number(chat.roomId) === roomId);
        if (idx === -1) {
          fetchAndSetList(activeTabRef.current, { silent: true });
          return prev;
        }

        const current = prev[idx];
        const isActive = Number(selectedRoomRef.current) === roomId;
        const fromSelf = Number(message.sender_user_id) === Number(auth.userId);

        const updated = {
          ...current,
          id: `room:${roomId}`,
          roomId,
          itemType: 'room',
          lastMessage: message.body,
          lastMessageSender: message.sender_role,
          timestamp: formatTimestamp(message.created_at),
          unread: isActive || fromSelf ? 0 : current.unread + 1,
        };

        const next = [...prev];
        next.splice(idx, 1);
        return [updated, ...next];
      });

      if (Number(selectedRoomRef.current) === roomId && Number(message.sender_user_id) !== Number(auth.userId)) {
        markAsReadApi({
          roomId,
          token: auth.token,
          upToMessageId: message.message_id,
        }).catch(() => {});
      }
    };

    const handleMessageDeleted = ({ room_id: roomId, message_id: messageId }) => {
      const rid = Number(roomId);
      const mid = Number(messageId);

      setMessagesByRoom((prev) => ({
        ...prev,
        [rid]: (prev[rid] || []).filter((msg) => Number(msg.message_id) !== mid),
      }));

      fetchAndSetList(activeTabRef.current, { silent: true });
    };

    const handleReadUpdate = ({ room_id: roomId, user_id: userId }) => {
      if (Number(userId) !== Number(auth.userId)) return;

      setConversations((prev) => prev.map((chat) => (
        Number(chat.roomId) === Number(roomId) ? { ...chat, unread: 0 } : chat
      )));
    };

    const handleTyping = ({ room_id: roomId, user_id: userId, is_typing: isTyping }) => {
      if (Number(userId) === Number(auth.userId)) return;

      setTypingByRoom((prev) => {
        const roomKey = Number(roomId);
        const current = new Set(prev[roomKey] || []);

        if (isTyping) current.add(Number(userId));
        else current.delete(Number(userId));

        return {
          ...prev,
          [roomKey]: [...current],
        };
      });
    };

    bindChatSocketEvents({
      onConnect: () => {
        if (selectedRoomRef.current) {
          joinSocketRoom(selectedRoomRef.current);
        }
      },
      onError: (payload) => {
        if (payload?.message) {
          console.error('Socket error:', payload.message);
        }
      },
      onNewMessage: handleNewMessage,
      onMessageDeleted: handleMessageDeleted,
      onReadUpdate: handleReadUpdate,
      onTyping: handleTyping,
    });

    return () => {
      disconnectChatSocket();
      joinedRoomRef.current = null;
      selectedRoomRef.current = null;
    };
  }, [auth.token, auth.userId, fetchAndSetList]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const nextRoom = selectedRoomId;
    const previousRoom = joinedRoomRef.current;

    if (previousRoom && previousRoom !== nextRoom) {
      leaveSocketRoom(previousRoom);
    }

    if (nextRoom && previousRoom !== nextRoom) {
      joinSocketRoom(nextRoom);
    }

    joinedRoomRef.current = nextRoom || null;
  }, [selectedRoomId]);

  const handleSelectChat = useCallback(async (chatId) => {
    const chat = conversations.find((entry) => entry.id === chatId);
    if (!chat || chat.canStartChat === false) return;

    let roomId = chat.roomId;
    if (!roomId) {
      try {
        roomId = await ensureRoomForContact(chat);
      } catch (error) {
        setListError(error.message || 'Failed to start chat.');
        return;
      }
    }

    if (!roomId) return;
    await selectRoom(roomId);
  }, [conversations, ensureRoomForContact, selectRoom]);

  const handleSendMessage = useCallback(async (text) => {
    const roomId = Number(selectedRoomRef.current);
    const body = String(text || '').trim();

    if (!roomId || !body) return;

    const sentViaSocket = sendSocketMessage({ roomId, body, messageType: 'text' });
    if (sentViaSocket) return;

    try {
      await sendMessageApi({ roomId, token: auth.token, body, messageType: 'text' });
    } catch (error) {
      setListError(error.message || 'Failed to send message.');
    }
  }, [auth.token]);

  const handleTyping = useCallback((isTyping) => {
    const roomId = Number(selectedRoomRef.current);
    if (!roomId) return;
    emitTyping({ roomId, isTyping });
  }, []);

  const handleBackToSidebar = useCallback(() => {
    setSelectedChatId(null);
    setSelectedRoomId(null);
  }, []);

  const handleRetry = useCallback(() => {
    fetchAndSetList(activeTabRef.current);
  }, [fetchAndSetList]);

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((chat) => String(chat.name || '').toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const activeChatData = useMemo(() => {
    if (!selectedChatId && !selectedRoomId) return null;

    const byId = conversations.find((entry) => entry.id === selectedChatId);
    if (byId) return byId;

    if (selectedRoomId) {
      return conversations.find((entry) => Number(entry.roomId) === Number(selectedRoomId)) || null;
    }

    return null;
  }, [conversations, selectedChatId, selectedRoomId]);

  const activeMessages = activeChatData?.roomId
    ? (messagesByRoom[activeChatData.roomId] || [])
    : [];

  const typingUsers = activeChatData?.roomId
    ? (typingByRoom[activeChatData.roomId] || [])
    : [];

  return (
    <div className="ncc-chat-container">
      <ChatSidebar
        isHidden={isMobile && Boolean(selectedChatId)}
        userRole={auth.role}
        currentUserName={auth.userName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        conversations={filteredBySearch}
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        isLoading={loadingList}
        error={listError}
        onRetry={handleRetry}
      />

      <ChatWindow
        isHidden={isMobile && !selectedChatId}
        chatData={activeChatData}
        messages={activeMessages}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onBack={handleBackToSidebar}
        isMobile={isMobile}
        currentUserId={auth.userId}
        typingUsers={typingUsers}
      />
    </div>
  );
};

export default ChatLayout;
