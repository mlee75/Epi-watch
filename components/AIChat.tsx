'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedQuestions?: string[];
  relatedOutbreaks?: string[];
}

const STARTER_QUESTIONS = [
  'Which records are critical severity?',
  'What is recorded for the Democratic Republic of the Congo?',
  'Summarise records by WHO region',
  'Which curated records were reported most recently?',
];

/**
 * Question-and-answer panel over the record database. Only mounted when the
 * server has an Anthropic key (see app/layout.tsx).
 */
export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

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

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);

    const replaceLast = (msg: ChatMessage) =>
      setMessages((prev) => [...prev.slice(0, -1), msg]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationHistory: history }),
      });
      const json = await res.json();
      replaceLast({
        role: 'assistant',
        content: json.response ?? 'No response was generated.',
        suggestedQuestions: json.suggestedQuestions ?? [],
        relatedOutbreaks: json.relatedOutbreaks ?? [],
      });
    } catch {
      replaceLast({ role: 'assistant', content: 'The request failed. Try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  return (
    <>
      <div className={`chat ${isOpen ? 'is-open' : ''}`} role="dialog" aria-label="Ask the data" aria-hidden={!isOpen}>
        <div className="chat-head">
          <div>
            <div className="chat-title">Ask the data</div>
            <div className="muted" style={{ fontSize: 11.5 }}>Answers are generated from Epi-watch records</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {messages.length > 0 && (
              <button type="button" className="btn" onClick={() => setMessages([])}>Clear</button>
            )}
            <button type="button" className="ct-close" onClick={() => setIsOpen(false)} aria-label="Close">×</button>
          </div>
        </div>

        <div className="chat-body">
          {messages.length === 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>Examples</p>
              {STARTER_QUESTIONS.map((q) => (
                <button key={q} type="button" className="chat-suggest" onClick={() => sendMessage(q)}>{q}</button>
              ))}
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="chat-msg chat-user">{msg.content}</div>
            ) : (
              <div key={i} className="chat-msg chat-bot">
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content || <span className="muted">Working…</span>}
                </div>
                {msg.relatedOutbreaks && msg.relatedOutbreaks.length > 0 && (
                  <div className="news-meta" style={{ marginTop: 8 }}>
                    <span>Records cited:</span>
                    {msg.relatedOutbreaks.slice(0, 3).map((o) => <span key={o} className="tag">{o}</span>)}
                  </div>
                )}
                {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                    {msg.suggestedQuestions.map((q) => (
                      <button key={q} type="button" className="chat-suggest" onClick={() => sendMessage(q)}>{q}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>
          <input ref={inputRef} className="input" type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a country, disease or record" disabled={isLoading}
            aria-label="Question" />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || isLoading}>Ask</button>
        </form>
        <p className="chat-foot">
          Generated by Claude Sonnet from the records on this site; it can be wrong. Not medical advice. ⌘K to toggle.
        </p>
      </div>

      <button type="button" className="btn chat-toggle" onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen} title="Ask the data (⌘K)">
        {isOpen ? 'Close' : 'Ask the data'}
      </button>
    </>
  );
}
