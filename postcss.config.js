let autoprefixer;
try {
  autoprefixer = require("autoprefixer");
} catch (error) {
  try {
    autoprefixer = require("next/dist/compiled/autoprefixer");
  } catch (fallbackError) {
    console.warn("Autoprefixer is not available; vendor prefixes will be skipped.");
    autoprefixer = null;
  }
}

module.exports = {
  plugins: {
    tailwindcss: {},
    ...(autoprefixer ? { autoprefixer } : {}),
  },
};
