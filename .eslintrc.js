module.exports = {
  "env": {
    "node": true,
    "browser": true,
    "mocha": true,
    "jasmine": true,
    "es6": true
  },
  "parser": "babel-eslint",
  "plugins": [
    "babel",
    "flowtype",
  ],
  "extends": [
    "airbnb-base",
    "plugin:flowtype/recommended",
    "prettier",
    "prettier/flowtype",
    "prettier/babel"
  ],

  // override Airbnb defaults with our own rules
  "rules": {
    "indent": [2, 4],
    "max-len": [1, 100], // downgrade this to a warning
    "no-confusing-arrow": [1, {"allowParens": true}],
    "no-prototype-builtins": [0],
    "import/no-extraneous-dependencies": ["error", {"devDependencies": true}],
    "no-underscore-dangle": 0,
    "import/no-cycle": "off",
    "max-classes-per-file": "off"

  }
};
