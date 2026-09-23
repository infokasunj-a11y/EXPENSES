/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Noto Sans Sinhala', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
