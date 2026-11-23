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
          navy: "#0f172a",
          slate: "#1e293b",
          teal: "#14b8a6",
          "teal-dark": "#0d9488",
        },
      },
    },
  },
  plugins: [],
};
