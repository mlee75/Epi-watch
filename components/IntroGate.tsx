'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QUOTES, type Quote } from '@/lib/quotes';
import { ENTER_EVENT } from '@/lib/events';

const SEEN_KEY = 'epiwatch:entered';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Timings follow Raylight's measured craft: ~80ms per word, ~300ms between
// sibling arrivals, 500-700ms settle-ins, exits faster than entrances.
const WORD_MS = 80;
const FIRST_WORD_MS = 250;
const EXIT_MS = 420;

/**
 * Entry screen shown before the homepage globe: an opaque page with a quote
 * chosen at random on each visit, revealed word by word, and a button that
 * enters the globe.
 *
 * Shown once per browser session; returning to Overview goes straight to the
 * globe. The quote is chosen after mount so server and client HTML match.
 */
export function IntroGate({ intro }: { intro?: { videoSrc: string; poster?: string } }) {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [videoDone, setVideoDone] = useState(!intro);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useIsoLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setOpen(false);
    } catch { /* storage blocked: show the gate */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (open && videoDone && quote) {
      const t = setTimeout(() => buttonRef.current?.focus({ preventScroll: true }), 600);
      return () => clearTimeout(t);
    }
  }, [open, videoDone, quote]);

  const enter = () => {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
    setLeaving(true);
    window.dispatchEvent(new Event(ENTER_EVENT));
    setTimeout(() => setOpen(false), EXIT_MS);
  };

  if (!open) return null;

  const words = quote?.text.split(' ') ?? [];
  // Everything after the quote lands in sequence once its last word is in.
  const afterQuote = FIRST_WORD_MS + words.length * WORD_MS + 250;

  return (
    <div
      className={`gate ${leaving ? 'is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-quote"
      onKeyDown={(e) => { if (e.key === 'Escape') enter(); }}
    >
      {intro && !videoDone && (
        <video className="gate-video" src={intro.videoSrc} poster={intro.poster} autoPlay muted playsInline
          onEnded={() => setVideoDone(true)} onError={() => setVideoDone(true)} />
      )}

      <div className="gate-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" />
        </svg>
        Epi-watch
      </div>

      {videoDone && quote && (
        <div className="gate-body">
          <blockquote id="gate-quote" className="gate-quote" aria-label={quote.text}>
            {words.map((w, i) => (
              <span key={i} className="gate-word" style={{ animationDelay: `${FIRST_WORD_MS + i * WORD_MS}ms` }} aria-hidden="true">
                {w}{' '}
              </span>
            ))}
          </blockquote>
          <p className="gate-cite gate-settle" style={{ animationDelay: `${afterQuote}ms` }}>
            <span className="gate-author">{quote.author}</span>
            <span className="gate-source">{quote.source}</span>
          </p>
          <div className="gate-foot gate-settle" style={{ animationDelay: `${afterQuote + 300}ms` }}>
            <p className="gate-purpose">
              Outbreaks, hospital admissions and emergency response around the world, as they are reported.
            </p>
            <button ref={buttonRef} type="button" className="btn btn-primary gate-enter" onClick={enter}>
              Enter the globe <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {intro && !videoDone && (
        <button type="button" className="gate-skip" onClick={() => setVideoDone(true)}>Skip intro</button>
      )}
    </div>
  );
}
