import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, CornerDownRight, Tag, BookOpen } from 'lucide-react';

export default function SummaryChatView({ 
  onSelectCitation, 
  onSendQuery,
  currentCaseNumber = "MCOP-225/2022" 
}) {
  const [messages, setMessages] = useState([
    {
      id: "msg-1",
      sender: "bot",
      text: `Hello Officer. I am your RAG Document Assistant for **${currentCaseNumber}**. You can query order facts, award interest, defaulter coordinates, or legal acts cited. Click any source citation chip to jump to the text in the document viewer.`,
      citations: []
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedQueries = [
    "What is the award amount?",
    "Who is the defaulter?",
    "Which court issued the order?",
    "Which legal acts are applied?",
    "Who is the tahsildar directed?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (queryText) => {
    const q = queryText || inputQuery;
    if (!q.trim() || isTyping) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: q,
      citations: []
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const response = await onSendQuery(q);
      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: response.answer,
        citations: response.citations || []
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "I encountered an error retrieving grounded order context. Please try again.",
          citations: []
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border-card)',
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Bot size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              RAG Document Assistant
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              Grounded in {currentCaseNumber} OCR Coordinates
            </span>
          </div>
        </div>
        <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
          Active
        </span>
      </div>

      {/* Message History */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.map((m) => {
          const isBot = m.sender === 'bot';
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexDirection: isBot ? 'row' : 'row-reverse',
                alignItems: 'flex-start'
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isBot ? 'rgba(2, 132, 199, 0.2)' : 'var(--bg-tertiary)',
                border: isBot ? '1px solid rgba(2, 132, 199, 0.4)' : '1px solid var(--border-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isBot ? '#38bdf8' : 'var(--text-muted)',
                flexShrink: 0
              }}>
                {isBot ? <Sparkles size={14} /> : <User size={14} />}
              </div>

              <div style={{
                maxWidth: '82%',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                background: isBot ? 'rgba(15, 23, 42, 0.75)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: isBot ? '1px solid var(--border-card)' : 'none',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') 
                  }} 
                />

                {/* Source Citation Chips */}
                {isBot && m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '0.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <BookOpen size={11} color="#38bdf8" />
                      <span>VERIFIED SOURCE CITATIONS (CLICK TO HIGHLIGHT):</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {m.citations.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => onSelectCitation(c.id, c.page)}
                          className="btn btn-ghost"
                          style={{
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.7rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(2, 132, 199, 0.15)',
                            border: '1px solid rgba(2, 132, 199, 0.35)',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <CornerDownRight size={11} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(2, 132, 199, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Sparkles size={14} className="spinner" />
            </div>
            <div style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>
              Querying petition context and citing coordinates...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(15, 23, 42, 0.5)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '0.4rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        {suggestedQueries.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(item)}
            className="btn btn-ghost"
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.7rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)'
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid var(--border-card)',
        background: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <input
          type="text"
          className="form-input"
          placeholder="Ask anything about the court order..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputQuery.trim() || isTyping}
          className="btn btn-primary"
          style={{ padding: '0.55rem 0.95rem' }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
