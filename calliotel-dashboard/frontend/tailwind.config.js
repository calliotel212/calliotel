/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          600: "#2563eb",
          700: "#1d4ed8",
        },
        ads: {
          navy: "#0A0F1C",
          slate: "#121826",
          teal: "#00E5FF",
          "teal-dark": "#00c4d9",
        },
      },
    },
  },
  plugins: [],
};
