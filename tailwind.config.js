/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          red: '#e63946',
          'red-dark': '#c1121f',
          dark: '#0a0a0a',
          card: '#111111',
          card2: '#161616',
          border: '#222222',
          text: '#e5e5e5',
          muted: '#888888',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      }
    }
  },
  plugins: []
}
