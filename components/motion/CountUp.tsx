'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const DURATION_MS = 1300;
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

interface Props {
  value: number;
  decimals?: number;
  suffix?: string;
}

/**
 * A figure that counts up from zero the first time it scrolls into view.
 * The server renders the final value, so the number is correct without
 * JavaScript and for screen readers (aria-label); the animation only
 * rewrites the visible text. Skipped under prefers-reduced-motion.
 */
export function CountUp({ value, decimals = 0, suffix = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n) + suffix;

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value) || value === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Only count figures that are still ahead of the reader; one already
    // scrolled past keeps its final value.
    if (el.getBoundingClientRect().bottom < 0) return;
    el.textContent = fmt(0);
    let raf = 0;
    let started = false;
    // A fast scroll can jump past the figure without it ever intersecting;
    // never leave a placeholder 0 on screen.
    const onScroll = () => {
      if (!started && el.getBoundingClientRect().bottom < 0) {
        started = true;
        io.disconnect();
        el.textContent = fmt(value);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / DURATION_MS);
        el.textContent = fmt(value * easeOutExpo(p));
        if (p < 1) raf = requestAnimationFrame(tick);
        else el.textContent = fmt(value);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.2 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); el.textContent = fmt(value); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix]);

  return <span ref={ref} aria-label={fmt(value)}>{fmt(value)}</span>;
}
