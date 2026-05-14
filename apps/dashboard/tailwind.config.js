/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        sand: '#ffffff',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        coral: '#fcd34d',
        sage: '#a4aebb',
        midnight: {
          main: '#0B0F19',
          secondary: '#111827',
          elevated: '#161B26',
          nav: '#0D1320'
        },
        cyber: {
          blue: '#2563EB',
          purple: '#9333EA',
          pink: '#EC4899',
          cyan: '#06B6D4'
        }
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0, 0, 0, 0.03)'
      }
    }
  },
  plugins: []
};
