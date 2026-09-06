/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@ficms/eslint-config/react'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: ['dist', 'dist-electron', 'node_modules', 'coverage']
};
