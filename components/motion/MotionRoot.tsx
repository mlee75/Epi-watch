'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SELECTOR = '.page-head, .kpi-row, .panel, .ob-toolbar, .ob-summary, .dx-list';
const CASCADE_MS = 90; // gap between elements revealed in the same batch
const MAX_DELAY_MS = 360;

/**
 * Drives scroll reveals site-wide: elements matching SELECTOR get [data-in]
 * when they enter the viewport, which releases the settle-in transition in
 * globals.css. Elements revealed together cascade top to bottom.
 *
 * A data attribute rather than a class, because React owns className and
 * would drop an added class on re-render. Under prefers-reduced-motion
 * everything is marked in at once.
 */
export function MotionRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const all = () => Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => !el.hasAttribute('data-in'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      all().forEach((el) => el.setAttribute('data-in', ''));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const hits = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        hits.forEach((el, i) => {
          el.style.setProperty('--rv-delay', `${Math.min(i * CASCADE_MS, MAX_DELAY_MS)}ms`);
          el.setAttribute('data-in', '');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );

    // Tracked per observer, not with a flag on the element: effects re-run
    // (route changes, React's dev double-invoke), and a DOM flag left by a
    // disconnected observer made the new one skip everything, leaving the
    // page blank.
    const watched = new WeakSet<Element>();
    const scan = () => all().forEach((el) => {
      if (watched.has(el)) return;
      watched.add(el);
      io.observe(el);
    });
    scan();
    // Pages render sections after data arrives; pick those up too.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    // A fast scroll can carry an element from below the viewport to above it
    // between two frames, so the observer never sees it intersect and it
    // would stay hidden. Anything already scrolled past is shown at once.
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        for (const el of all()) {
          if (el.getBoundingClientRect().bottom < 0) {
            el.style.setProperty('--rv-delay', '0ms');
            el.setAttribute('data-in', '');
            io.unobserve(el);
          }
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); mo.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [pathname]);

  return null;
}
