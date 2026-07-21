/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#07080c', // Deep carbon navy-black
        card: '#0f111a',       // Slate-dark card surface
        border: '#1c1e2d',     // Subtle graphite border
        primary: {
          DEFAULT: '#3b82f6',  // Premium electric blue
          hover: '#2563eb',
        },
        secondary: {
          DEFAULT: '#06b6d4',  // Precision cool cyan
          hover: '#0891b2',
        },
        slate: {
          950: '#030712',
          900: '#0b0f19',
          800: '#1e293b',
          700: '#334155',
          400: '#94a3b8',
          200: '#e2e8f0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'premium': '0 4px 30px rgba(0, 0, 0, 0.4)',
        'subtle-glow': '0 0 15px rgba(59, 130, 246, 0.1)',
      }
    },
  },
  plugins: [],
}
