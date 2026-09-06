/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@ficms/eslint-config'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage']
};
