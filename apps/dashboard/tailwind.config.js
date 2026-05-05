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
        sand: '#f7f1e8',
        ink: '#14213d',
        coral: '#e76f51',
        sage: '#88a096'
      },
      boxShadow: {
        panel: '0 18px 60px rgba(20, 33, 61, 0.12)'
      }
    }
  },
  plugins: []
};
