'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QUOTES, type Quote } from '@/lib/quotes';

const SEEN_KEY = 'epiwatch:entered';

// useLayoutEffect warns during SSR; this runs it only in the browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Entry screen shown over the homepage globe: a quote, chosen at random on
 * each visit, and a button that lifts the screen to reveal the globe.
 *
 * It appears once per browser session, so returning to Overview from another
 * page goes straight to the globe. The quote is picked after mount, not on the
 * server, so server and client HTML match.
 */
export function IntroGate({ intro }: { intro?: { videoSrc: string; poster?: string } }) {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [videoDone, setVideoDone] = useState(!intro);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Hide before first paint if this session has already entered.
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
    if (open && videoDone) buttonRef.current?.focus();
  }, [open, videoDone]);

  const enter = () => {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setLeaving(true);
    window.scrollTo({ top: 0 });
    setTimeout(() => setOpen(false), 700);
  };

  if (!open) return null;

  return (
    <div className={`gate ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="gate-quote"
      onKeyDown={(e) => { if (e.key === 'Escape') enter(); }}>
      {intro && !videoDone && (
        <video className="gate-video" src={intro.videoSrc} poster={intro.poster} autoPlay muted playsInline
          onEnded={() => setVideoDone(true)} onError={() => setVideoDone(true)} />
      )}
      <div className={`gate-inner ${videoDone && quote ? 'is-visible' : ''}`}>
        <div className="gate-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" />
          </svg>
          Epi-watch
        </div>
        {quote && (
          <figure className="gate-quote">
            <blockquote id="gate-quote">&ldquo;{quote.text}&rdquo;</blockquote>
            <figcaption>
              <span className="gate-author">{quote.author}</span>
              <span className="gate-source">{quote.source}</span>
            </figcaption>
          </figure>
        )}
        <p className="gate-purpose">
          A public view of infectious disease outbreaks, hospital pressure and emergency response, as it is reported.
        </p>
        <button ref={buttonRef} type="button" className="btn btn-primary gate-enter" onClick={enter}>
          Enter the globe
        </button>
      </div>
      {intro && !videoDone && (
        <button type="button" className="gate-skip" onClick={() => setVideoDone(true)}>Skip intro</button>
      )}
    </div>
  );
}
