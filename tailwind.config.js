/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './*.js',
    './public/**/*.html',
    './public/**/*.js',
    './auction/**/*.html',
    './results/**/*.html',
    './screen/**/*.html',
    './verify/**/*.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Cobe', 'sans-serif']
      },
      colors: {
        palette: {
          blue: '#134E8E',
          red: '#C00707',
          orange: '#FF4400',
          yellow: '#FFB33F'
        },
        brandBlue: '#37314F',
        brandYellow: '#C0912B',
        brandRed: '#92205D',
        brandGreen: '#17635F',
        brandGreenBorder: '#17635F33',
        brandTeal: '#17635F',
        brandPurple: '#37314F',
        brandOrange: '#C0912B',
        brandMagenta: '#92205D'
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        marquee: 'marquee 35s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      }
    }
  },
  plugins: []
};
