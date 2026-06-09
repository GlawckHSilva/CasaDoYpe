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
        leaf: 'rgb(var(--primary-rgb) / <alpha-value>)',
        coral: 'rgb(var(--accent-rgb) / <alpha-value>)',
        mist: '#eaf3ff',
        sun: 'rgb(var(--primary-hover-rgb) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(20, 32, 51, 0.12)',
      },
    },
  },
  plugins: [],
};
