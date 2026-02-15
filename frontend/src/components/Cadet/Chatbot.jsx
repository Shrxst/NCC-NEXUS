// frontend/src/components/Chatbot.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // Import Axios for API calls
import './Chatbot.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const chatWindowRef = useRef(null);
  
  // Use a ref to prevent double fetching in React Strict Mode
  const hasFetchedHistory = useRef(false);

  // 1. INITIAL LOAD: Fetch Chat History from Backend
  useEffect(() => {
    if (!hasFetchedHistory.current) {
      fetchChatHistory();
      hasFetchedHistory.current = true;
    }
  }, []);

  const fetchChatHistory = async () => {
    try {
      // Connects to the backend we just built
      const response = await axios.get(`${API_BASE_URL}/api/chat`);
      
      // Transform Backend Data (DB columns) to Frontend Format
      // Backend uses 'message', Frontend uses 'text'
      const rows = Array.isArray(response.data) ? response.data : [];
      const formattedMessages = rows.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.message, 
        timestamp: msg.created_at
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load history:", error);
      // Fallback greeting if backend is offline
      handleBotResponse("Jai Hind Cadet, I am unable to connect to the server right now.");
    }
  };

  // Scroll to bottom effect
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, streamingMessage]);

  // 2. STREAMING LOGIC (Preserved exactly as requested)
  const handleBotResponse = async (fullText) => {
    setIsLoading(true);
    const words = fullText.split(" ");
    let currentText = "";

    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? "" : " ") + words[i];
      setStreamingMessage({
        sender: 'bot',
        text: currentText,
      });
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    const finalMsg = {
      id: Date.now(),
      sender: 'bot',
      text: fullText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, finalMsg]);
    setStreamingMessage(null);
    setIsLoading(false);
  };

  // 3. SEND MESSAGE: Connects to Backend API
  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // A. Optimistic Update: Show user message immediately
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true); // Show "Thinking..." bubble immediately

    try {
      // B. Send to Backend
      // Pass 'cadetId' if you have login (e.g., from localStorage)
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: text,
        cadetId: 1 // Default ID or fetch from Auth Context
      });

      // C. Trigger Streaming with Real AI Response
      // The backend returns: { user: {...}, bot: { message: "..." } }
      const botMessage =
        response?.data?.bot?.message ||
        response?.data?.message ||
        "Jai Hind Cadet, I am unable to process that request right now.";
      await handleBotResponse(botMessage);

    } catch (error) {
      console.error("Chat API Error:", error);
      setIsLoading(false); // Stop loading if error
      // Optional: Show error in chat
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: "Connection error. Please check your backend server.",
        timestamp: new Date().toISOString()
      }]);
    }
  };

  return (
    <div className="cadet-chatbot">
      <div className="chatbot-inner-wrapper">
      <header className="fixed-top-bar">
        <h1 className="chat-title">Your Personal NCC Assistant Chatbot</h1>
      </header>

      <div className="chat-view-container">
        <div className="scrollable-chat-window" ref={chatWindowRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`message-wrapper ${msg.sender === 'bot' ? 'bot-align' : 'user-align'}`}>
              <div className={`message-bubble ${msg.sender === 'bot' ? 'bot-style' : 'user-style'}`}>
                <div className="content">{msg.text}</div>
                <div className="time-label">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                </div>
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div className="message-wrapper bot-align">
              <div className="message-bubble bot-style">
                <div className="content">{streamingMessage.text}</div>
                <div className="time-label">typing...</div>
              </div>
            </div>
          )}

          {isLoading && !streamingMessage && (
            <div className="message-wrapper bot-align">
              <div className="message-bubble bot-style thinking-bubble">
                <div className="dot-pulse"></div>
              </div>
            </div>
          )}
        </div>

        <div className="fixed-input-section">
          <form className="chat-input-wrapper" onSubmit={handleSubmit}>
            <input 
              type="text" 
              placeholder={isLoading ? "Assistant is thinking..." : "Search Here"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
              required
            />
            <button type="submit" className="send-btn" disabled={isLoading || !inputValue.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Chatbot;

