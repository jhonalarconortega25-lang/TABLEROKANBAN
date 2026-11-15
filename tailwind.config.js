/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Mulish', 'system-ui', 'Segoe UI', 'sans-serif'], display: ['Montserrat', 'Mulish', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#f1f6ec', 100: '#dfecd0', 200: '#c3dba8', 300: '#9cc275', 400: '#6f9f45', 500: '#4f8a2b', 600: '#3f7a22', 700: '#2f5f18', 800: '#234914', 900: '#183310' },
        gold: { 50: '#fdf7e6', 100: '#faebc0', 200: '#f3d684', 300: '#ecc25a', 400: '#e6b23c', 500: '#dfa020', 600: '#b9820f', 700: '#8a610b', 800: '#5f430a' },
        bark: { 50: '#f8efe5', 100: '#efdcc4', 200: '#e0c09a', 500: '#9c5a14', 600: '#83490e', 700: '#683a0c' },
        paper: '#f2f1ec',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
      },
      animation: { 'fade-in': 'fade-in .18s ease-out', 'slide-in': 'slide-in .22s ease-out' },
    },
  },
  plugins: [],
};
