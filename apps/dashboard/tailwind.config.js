/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        sand: '#ffffff',
        ink: '#1a1a1a',
        coral: '#fcd34d',
        sage: '#a4aebb'
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0, 0, 0, 0.03)'
      }
    }
  },
  plugins: []
};
