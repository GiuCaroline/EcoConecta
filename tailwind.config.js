/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'branco': '#FAFAFA',
        'preto': {
          DEFAULT: '#000',
          dark: '#121212'
        },
        'verde': '#ebf5ee'
      },
    },
  },
  plugins: [],
};