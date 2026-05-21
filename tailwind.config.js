/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#17201a',
        leaf: '#2f6f4e',
        coral: '#d9654f',
        mist: '#edf5ef',
        sun: '#f5c66b',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(23, 32, 26, 0.12)',
      },
    },
  },
  plugins: [],
};
