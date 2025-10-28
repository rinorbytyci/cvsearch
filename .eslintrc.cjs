module.exports = {
  root: true,
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  env: {
    es2022: true,
    node: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
      env: {
        browser: true,
        node: false
      }
    }
  ]
};
