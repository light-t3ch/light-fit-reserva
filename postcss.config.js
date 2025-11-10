const plugins = {
  tailwindcss: {},
};

try {
  require.resolve("autoprefixer");
  plugins.autoprefixer = {};
} catch (error) {
  console.warn(
    "[postcss] autoprefixer が見つかりませんでした。インストールされている環境では自動で有効になります。"
  );
}

module.exports = { plugins };
