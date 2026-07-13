/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        railDark: "#0f172a",
        railCard: "#1e293b",
        railBorder: "#334155",
        railGreen: "#10b981",
        railOrange: "#f97316",
        railRed: "#ef4444",
      }
    },
  },
  plugins: [],
}
