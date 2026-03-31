import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Space-dark base palette
        'bg-base':    '#020817',
        'bg-surface': '#050d1a',
        'bg-card':    '#0a1628',
        'border-dim': 'rgba(255,255,255,0.06)',
        'border-mid': 'rgba(255,255,255,0.12)',

        // Glass
        'glass-bg':     'rgba(255,255,255,0.04)',
        'glass-border': 'rgba(255,255,255,0.08)',

        // Severity — vivid, space-appropriate
        critical: '#ef4444',
        high:     '#f97316',
        medium:   '#eab308',
        low:      '#22c55e',

        // Text
        'text-primary':   '#ffffff',
        'text-secondary': '#94a3b8',
        'text-muted':     '#475569',

        // Accent
        accent:       '#60a5fa',
        'accent-hover': '#3b82f6',
        purple:       '#a78bfa',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Space Grotesk', 'sans-serif'],
        mono: ['var(--font-mono)', 'Space Mono', 'monospace'],
      },
      fontSize: {
        'logo':       ['20px', { fontWeight: '700', letterSpacing: '0.12em' }],
        'hero':       ['48px', { fontWeight: '700', letterSpacing: '0.01em' }],
        'section':    ['22px', { fontWeight: '600', letterSpacing: '0.02em' }],
        'card-title': ['16px', { fontWeight: '600' }],
      },
      letterSpacing: {
        heading: '0.02em',
        label:   '0.1em',
        wide:    '0.15em',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '20px',
        lg: '32px',
        xl: '48px',
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'float':       'floatUp 3s ease-in-out infinite',
        'shimmer':     'shimmer 2.5s linear infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatUp: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
      },
      boxShadow: {
        'card':           '0 4px 24px rgba(0,0,0,0.6)',
        'card-hover':     '0 12px 48px rgba(0,0,0,0.8)',
        'glass':          '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-hover':    '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        'critical-glow':  '0 0 32px rgba(239,68,68,0.35)',
        'high-glow':      '0 0 32px rgba(249,115,22,0.3)',
        'medium-glow':    '0 0 32px rgba(234,179,8,0.25)',
        'low-glow':       '0 0 32px rgba(34,197,94,0.25)',
        'accent-glow':    '0 0 32px rgba(96,165,250,0.3)',
        'purple-glow':    '0 0 32px rgba(167,139,250,0.3)',
        'button-primary': '0 4px 20px rgba(59,130,246,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
