'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: { name: string; title: string; url: string }[];
  suggestedQuestions?: string[];
  relatedOutbreaks?: string[];
}

const STARTER_QUESTIONS = [
  "What's the most critical situation right now?",
  'Which countries should I avoid traveling to?',
  'What diseases are spreading fastest?',
  "What's the current situation in DRC?",
  'Compare outbreaks in Africa vs Asia',
  'Explain the regional breakdown',
  'What are the biggest threats this week?',
  'Tell me about the worst active outbreaks',
];

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for external "Ask AI" triggers (from StatsBar, AISummary, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { question?: string } | undefined;
      setIsOpen(true);
      if (detail?.question) {
        setTimeout(() => sendMessage(detail.question!), 100);
      }
    };
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen) { setTimeout(() => inputRef.current?.focus(), 300); }
  }, [isOpen]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const typingMsg: ChatMessage = { role: 'assistant', content: '…', timestamp: new Date() };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationHistory: history }),
      });

      const json = await res.json();

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: json.response ?? 'Sorry, I could not generate a response.',
          timestamp: new Date(),
          suggestedQuestions: json.suggestedQuestions ?? [],
          relatedOutbreaks: json.relatedOutbreaks ?? [],
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Connection error. Please try again.',
          timestamp: new Date(),
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Chat panel */}
      <div
        style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 50,
          width: 460, height: 648,
          background: 'rgba(5,13,26,0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(59,130,246,0.08)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(29,78,216,0.9) 0%, rgba(79,70,229,0.9) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '14px 18px', flexShrink: 0,
          boxShadow: '0 1px 24px rgba(59,130,246,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>✦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
                  Epi-Watch AI Assistant
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#4ade80', display: 'inline-block',
                    boxShadow: '0 0 6px rgba(74,222,128,0.8)',
                  }} />
                  <span style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.7)',
                    fontFamily: 'var(--font-mono), Space Mono, monospace',
                  }}>
                    Online · claude-sonnet-4-6
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '3px 8px',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'var(--font-mono), Space Mono, monospace',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; }}
                  onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, cursor: 'pointer', padding: '5px 6px',
                  display: 'flex', alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; }}
                onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              >
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Starter questions */}
        {messages.length === 0 && (
          <div style={{
            padding: '14px 18px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 10, letterSpacing: '0.02em' }}>
              Ask anything about global disease outbreaks:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    textAlign: 'left', padding: '7px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 9, color: '#60a5fa', fontSize: 12,
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit', fontWeight: 500,
                  }}
                  onMouseOver={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'rgba(96,165,250,0.08)';
                    el.style.borderColor = 'rgba(96,165,250,0.25)';
                  }}
                  onMouseOut={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'rgba(255,255,255,0.03)';
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#ffffff',
                    borderRadius: '14px 14px 3px 14px',
                    padding: '9px 14px', maxWidth: '80%',
                    fontSize: 13, lineHeight: 1.5,
                    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6d28d9 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    boxShadow: '0 0 12px rgba(59,130,246,0.3)',
                  }}>🤖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '3px 14px 14px 14px',
                      padding: '10px 14px', fontSize: 13,
                      color: msg.content === '…' ? 'rgba(148,163,184,0.5)' : 'rgba(203,213,225,0.9)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content === '…' ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {[0, 0.15, 0.3].map((delay, j) => (
                            <span key={j} style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: '#60a5fa',
                              display: 'inline-block',
                              animation: `bounce 0.9s ${delay}s infinite`,
                              boxShadow: '0 0 6px rgba(96,165,250,0.5)',
                            }} />
                          ))}
                        </div>
                      ) : msg.content}
                    </div>

                    {/* Related outbreaks */}
                    {msg.relatedOutbreaks && msg.relatedOutbreaks.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{
                          fontSize: 9, color: 'rgba(148,163,184,0.5)',
                          fontFamily: 'var(--font-mono), Space Mono, monospace',
                          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2,
                        }}>
                          Referenced outbreaks
                        </div>
                        {msg.relatedOutbreaks.slice(0, 3).map((o) => (
                          <div key={o} style={{
                            padding: '5px 10px',
                            background: 'rgba(96,165,250,0.05)',
                            border: '1px solid rgba(96,165,250,0.15)',
                            borderRadius: 7, fontSize: 11, color: '#93c5fd',
                          }}>
                            📍 {o}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggested follow-ups */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {msg.suggestedQuestions.map((q) => (
                          <button
                            key={q}
                            onClick={() => sendMessage(q)}
                            style={{
                              textAlign: 'left', padding: '5px 10px',
                              background: 'rgba(96,165,250,0.05)',
                              border: '1px solid rgba(96,165,250,0.15)',
                              borderRadius: 7, color: '#60a5fa', fontSize: 11,
                              cursor: 'pointer', transition: 'all 0.15s',
                              fontFamily: 'inherit',
                            }}
                            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.1)'; }}
                            onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.05)'; }}
                          >
                            ↳ {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div style={{
                      fontSize: 10, color: 'rgba(71,85,105,0.7)', marginTop: 5,
                      fontFamily: 'var(--font-mono), Space Mono, monospace',
                    }}>
                      {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '12px 18px', flexShrink: 0,
          background: 'rgba(255,255,255,0.01)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any country, disease, or outbreak…"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '9px 14px',
                color: '#ffffff', fontSize: 13,
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e)  => {
                e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(96,165,250,0.08)';
              }}
              onBlur={(e)   => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                padding: '9px 14px',
                background: !input.trim() || isLoading
                  ? 'rgba(59,130,246,0.3)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none', borderRadius: 10, color: '#ffffff',
                cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || isLoading ? 0.5 : 1,
                flexShrink: 0, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center',
                boxShadow: !input.trim() || isLoading ? 'none' : '0 4px 16px rgba(59,130,246,0.4)',
              }}
            >
              <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <p style={{
            fontSize: 10, color: 'rgba(71,85,105,0.7)', marginTop: 7,
            fontFamily: 'var(--font-mono), Space Mono, monospace',
          }}>
            Powered by Claude · Data refreshes every 30 min · Press ⌘K to toggle
          </p>
        </div>
      </div>

      {/* Floating button */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
        <button
          onClick={() => setIsOpen((o) => !o)}
          title="AI Health Intelligence (⌘K)"
          style={{
            width: 58, height: 58, borderRadius: '50%',
            background: isOpen
              ? 'linear-gradient(135deg, #1d4ed8, #4f46e5)'
              : 'linear-gradient(135deg, #3b82f6, #6d28d9)',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isOpen
              ? '0 8px 32px rgba(59,130,246,0.5)'
              : '0 8px 40px rgba(59,130,246,0.5), 0 0 60px rgba(109,40,217,0.2)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            transform: isOpen ? 'scale(0.92) rotate(0deg)' : 'scale(1)',
            position: 'relative',
          }}
          onMouseOver={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
          onMouseOut={(e)  => { if (!isOpen) (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {isOpen ? (
            <svg style={{ width: 22, height: 22, color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg style={{ width: 24, height: 24, color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}

          {/* Online pulse indicator */}
          {!isOpen && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              width: 13, height: 13, borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid rgba(5,13,26,0.9)',
              boxShadow: '0 0 8px rgba(34,197,94,0.6)',
            }}>
              <span style={{
                position: 'absolute', inset: -2, borderRadius: '50%',
                background: '#22c55e', opacity: 0.4,
                animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
              }} />
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
