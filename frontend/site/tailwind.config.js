/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1B3A6B",
        primaryDark: "#142C52",
        secondary: "#F5A623",
        secondaryAlt: "#F7941E",
        heading: "#14213D",
        bodyText: "#5C6B82",
        lightBg: "#F0F4F5",
        coral: "#F5A623",
        teal: "#F5A623",
        charcoal: "#14213D",
        "hero-band": "#F0F4F5",
      },
    },
  },
  plugins: [],
};
