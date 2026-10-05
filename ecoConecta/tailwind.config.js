module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        forest: "#166534",
        mint: "#e9f4e5",
        lime: "#c4f17b",
        sand: "#f7f8f2",
        ink: "#172c24",
      },
    },
  },
  plugins: [],
};
