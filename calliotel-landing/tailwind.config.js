/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        adsfind: {
          bg: "#0A0F1C",
          primary: "#00E5FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-primary": "0 0 24px rgba(0, 229, 255, 0.35), 0 0 48px rgba(0, 229, 255, 0.12)",
      },
    },
  },
  plugins: [],
};