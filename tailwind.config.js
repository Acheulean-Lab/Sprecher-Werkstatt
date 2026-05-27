/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        // Card "surface" is the same black as the page — separation is
        // achieved with outlines, not by tonal fill.
        surface: '#000000',
        // Default outline: a soft, visible grey on pure black.
        border: '#3F3F46',
        ink: '#FFFFFF',
        muted: '#9CA3A0',
        accent: '#2563EB',
        success: '#FAF600',
        warn: '#FF9E00',
        danger: '#F02640',
        chartbg: '#000000',
        chartgrid: '#2A2A2E',
        charttext: '#9CA3A0',
        curve1: '#60A5FA',
        curve2: '#34D399',
        curve3: '#F59E0B',
        curve4: '#F87171',
        curve5: '#A78BFA',
        curve6: '#FB923C',
      },
      fontFamily: {
        sans: ['Univers', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        condensed: ['"Univers Condensed"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #F87171 0%, #FBBF24 100%)',
        'gradient-cool': 'linear-gradient(135deg, #60A5FA 0%, #34D399 100%)',
      },
      borderRadius: {
        card: '8px',
        btn: '4px',
        badge: '2px',
      },
    },
  },
  plugins: [],
}
