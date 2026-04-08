/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6c47ff',
          light: '#9b7bff',
          dark: '#4a2fd4',
        },
        surface: {
          DEFAULT: '#111118',
          raised: '#1a1a24',
          overlay: '#22222e',
          border: '#2d2d3d',
        },
        text: {
          primary: '#f0efff',
          secondary: '#9898b0',
          muted: '#5a5a78',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'bar-1': 'bar 1.0s ease-in-out infinite',
        'bar-2': 'bar 1.2s ease-in-out infinite 0.2s',
        'bar-3': 'bar 0.9s ease-in-out infinite 0.4s',
      },
      keyframes: {
        slideUp: { from: { transform: 'translateY(10px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        bar: { '0%,100%': { transform: 'scaleY(0.3)' }, '50%': { transform: 'scaleY(1)' } },
      },
    },
  },
  plugins: [],
}
