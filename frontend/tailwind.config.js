/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        card: '#151C2C',
        primary: '#6366F1', // Indigo 500
        secondary: '#8B5CF6', // Violet 500
        accent: '#10B981', // Emerald 500
      },
    },
  },
  plugins: [],
}
