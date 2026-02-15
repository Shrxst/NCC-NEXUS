import React, { useState } from 'react';

const MessageInput = ({ onSend, onTyping, disabled = false }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (onTyping) onTyping(false);
  };

  const handleChange = (event) => {
    const next = event.target.value;
    setText(next);
    if (onTyping) onTyping(next.trim().length > 0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-area message-input-container">
      <span style={{ fontSize: '1.2rem', color: '#8696a0' }}>+</span>

      <input
        className="message-field message-input"
        placeholder={disabled ? 'Select a chat to start messaging' : 'Type a message'}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      <button className="send-btn send-button" onClick={handleSend} disabled={disabled}>
        Send
      </button>
    </div>
  );
};

export default MessageInput;
