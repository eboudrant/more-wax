/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './static/index.html',
    './static/js/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg':           '#131313',
        'surface':      '#201f1f',
        'surface-low':  '#1c1b1b',
        'surface-high': '#2a2a2a',
        'surface-top':  '#353534',
        'primary':      '#fddcb1',
        'primary-dim':  '#e1c198',
        'primary-ctr':  '#e0c097',
        'on-primary':   '#402d0f',
        'on-surface':   '#e5e2e1',
        'on-surface-v': '#d1c4b8',
        'outline':      '#9a8f83',
        'outline-v':    '#4e453c',
        'danger':       '#f87171',
        'green':        '#4ade80',
        'amber':        '#f59e0b',
      },
      fontFamily: {
        'headline': ['"Noto Serif"', 'Georgia', 'serif'],
        'body':     ['Manrope', 'system-ui', 'sans-serif'],
        'label':    ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
