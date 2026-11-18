/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chef: {
          50: '#eff8fa',
          100: '#d7eef3',
          200: '#b4dde7',
          300: '#80c4d4',
          400: '#49a3b8',
          500: '#2f7d8f',
          600: '#266677',
          700: '#225362',
          800: '#1a4652',
          900: '#153943'
        },
        carrot: '#e67e38',
        broccoli: '#52a45a',
        tomato: '#df5a49'
      }
    }
  },
  plugins: []
};
