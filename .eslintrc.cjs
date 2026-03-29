module.exports = {
  root: true,
  extends: ["@remix-run/eslint-config"],
  ignorePatterns: [
    "build/",
    "coverage/",
    "node_modules/",
    "public/build/",
    "extensions/**/dist/",
  ],
};
