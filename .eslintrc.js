module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es6: true
  },
  extends: [ 'plugin:jest/recommended', 'standard' ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  plugins: [ 'jest' ],
  rules: {
    camelcase: 'off'
  }
}
