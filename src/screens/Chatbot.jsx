import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { chatbotAPI } from '../services/api';

export default function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [draftReply, setDraftReply] = useState('');

  const sendToBot = async (questionText) => {
    try {
      setIsSending(true);
      setDraftReply('Thinking...');
      const response = await chatbotAPI.ask(questionText, { timeoutMs: 30000 });
      setDraftReply('');
      setMessages(prev => [...prev, {
        text: response.reply,
        sender: 'bot',
        time: new Date(),
      }]);
    } catch (error) {
      setDraftReply('');
      setMessages(prev => [...prev, {
        text: error?.code === 'ECONNABORTED'
          ? 'The response took too long. Please try again or ask a shorter question.'
          : error?.response?.data?.detail || 'Chatbot service is currently unavailable. Please try again.',
        sender: 'bot',
        time: new Date(),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const question = inputMessage.trim();
      setMessages(prev => [...prev, { text: question, sender: 'user', time: new Date() }]);
      setInputMessage('');
      await sendToBot(question);
    }
  };

  return (
    <div className="chatbot-container">
      <UnifiedSidebar activePath="/chatbot" />

      {/* Main Content */}
      <main className="main-content">
        <TopNavbar title="Chatbot" />

        <div className="content-wrapper">
          {/* Chat Section */}
          <section className="chat-section">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <Bot size={48} color="#6C9F8C" className="empty-chat-icon" />
                  <p className="empty-chat-text">Welcome! How can I assist you today?</p>
                  <p className="empty-chat-subtitle">Click on an FAQ above or type your question below</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className={`message ${message.sender === 'user' ? 'message-user' : 'message-bot'}`}>
                    <div className={`message-bubble ${message.sender === 'user' ? 'message-bubble-user' : 'message-bubble-bot'}`}>
                      <p className="message-text">{message.text}</p>
                      <span className="message-time">
                        {message.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {draftReply && (
                <div className="message message-bot">
                  <div className="message-bubble message-bubble-bot message-bubble-loading">
                    <span className="typing-dot" />
                    <p className="message-text">{draftReply}</p>
                  </div>
                </div>
              )}
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
                className="chat-input"
                disabled={isSending}
              />
              <button type="submit" className="send-btn" disabled={isSending}>
                <Send size={20} />
              </button>
            </form>
          </section>
        </div>

        <footer className="footer">
          <p>©2026. MURI</p>
        </footer>
      </main>
    </div>
  );
}