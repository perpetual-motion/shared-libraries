// Copyright (c) Perpetual-Motion project.
// Licensed under the MIT License.

require("@rushstack/eslint-config/patch/modern-module-resolution");

module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaVersion: "2019",
  },
  extends: ["@rushstack/eslint-config/profile/node", "../../common/.eslintrc.js"]
};
