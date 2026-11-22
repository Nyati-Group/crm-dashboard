/** @type {import('tailwindcss').Config} */
// All colours are CSS custom properties defined in src/app/globals.css,
// so light and dark mode swap in one place.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: v('page'),
        surface: v('surface'),
        surface2: v('surface-2'),
        line: v('line'),
        ink: v('ink'),
        ink2: v('ink-2'),
        muted: v('muted'),
        brand: v('brand'),
        brand2: v('brand-2'),
        brandInk: v('brand-ink'),
        good: v('good'),
        goodInk: v('good-ink'),
        warn: v('warn'),
        warnInk: v('warn-ink'),
        bad: v('bad'),
        badInk: v('bad-ink'),
        s1: v('series-1'),
        s2: v('series-2'),
        s3: v('series-3'),
        neutral: v('neutral'),
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
