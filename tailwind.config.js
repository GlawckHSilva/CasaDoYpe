/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#142033',
        leaf: '#2563eb',
        coral: '#0ea5e9',
        mist: '#eaf3ff',
        sun: '#93c5fd',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(20, 32, 51, 0.12)',
      },
    },
  },
  plugins: [],
};
