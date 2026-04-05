/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        'page-light': '#0d0f14',
        'page-dark': '#0d0f14',
        'card-dark': '#141820',
        'card-light': '#141820',
        'border-dark': '#1e2433',
        'border-light': '#1e2433',
        'accent-green': '#4ade80',
        'accent-blue': '#60a5fa',
        'accent-purple': '#a78bfa',
        'tx-primary': '#f1f5f9',
        'tx-secondary': '#6b7280',
        'tx-muted': '#4b5563',
        'sb-bg': '#111318',
        'sb-active': '#1d2432',
        'sb-hover': '#1a1f2e',
        'sb-border': '#1e2433',
        'sb-text': '#9ca3af',
        'sb-icon': '#6b7280',
        'sb-accent': '#6366f1',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
