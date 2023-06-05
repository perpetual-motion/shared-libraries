// Copyright (c) Perpetual-Motion project 
// Licensed under the MIT License.

module.exports = {
  plugins: ["header"],
  ignorePatterns: ["**/*.js"],
  rules: {

    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: "default",
        format: ["camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: "variable",
        format: ["camelCase", "UPPER_CASE"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
      },
      {
        selector: "enumMember",
        format: ["PascalCase"],
      },
      {
        selector: "typeParameter",
        prefix: ["T"],
        format: ["PascalCase"],
      },
      {
        selector: "objectLiteralProperty",
        format: null,
      },
    ],
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "header/header": [
      "warn",
      "line",
      [
        " Copyright (c) Perpetual-Motion project",
        " Licensed under the MIT License.",
      ],
    ],
    "no-void": ["error", { allowAsStatement: true }],
    "no-unused-expressions": ["warn", { allowShortCircuit: true }],
    "prefer-const": ["error", { "destructuring": "all" }],
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: "default",
        format: ["camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: "variable",
        format: ["camelCase", "UPPER_CASE"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
      },
      {
        selector: "enumMember",
        format: ["PascalCase"],
      },
      {
        selector: "typeParameter",
        prefix: ["T"],
        format: ["PascalCase"],
      },
      {
        selector: "objectLiteralProperty",
        format: null,
      },

      {
        selector: "objectLiteralMethod",
        format: null,
      },
      {
        selector: "classMethod",
        modifiers: ['requiresQuotes'],
        format: null,
      }
    ],
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@rushstack/no-new-null": "off",
    "@typescript-eslint/member-ordering": "off",
    "promise/param-names": "off",
    "@typescript-eslint/typedef": "off",
    "@typescript-eslint/consistent-type-assertions": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "no-constant-condition": "off",
    //"max-len": 120,
    "no-trailing-spaces": "error",
    "space-in-parens": "error",
    "no-cond-assign": "off",
    "keyword-spacing": [
      "error",
      {
        "overrides": {
          "this": {
            "before": false
          }
        }
      }
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-this-alias": "off",
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/parameter-properties": "off",
    // "@typescript-eslint/no-angle-bracket-type-assertion": "off",
    "@typescript-eslint/no-floating-promises": "error",
    "require-atomic-updates": "off",
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      {
        "assertionStyle": "as"
      }
    ],
    "@typescript-eslint/array-type": [
      "error",
      {
        "default": "generic"
      }
    ],
    "indent": [
      "warn",
      2,
      {
        "SwitchCase": 1,
        "ObjectExpression": "first"
      }
    ],
    "@typescript-eslint/indent": [
      0,
      2
    ],
    "no-undef": "off",
    "no-unused-vars": "off",
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-multiple-empty-lines": [
      "error",
      {
        "max": 2,
        "maxBOF": 0,
        "maxEOF": 1
      }
    ],
    "@rushstack/typedef-var": "off",
    "no-eval": "error",
    "no-implied-eval": "off",
    "no-return-assign": "off",
    "@typescript-eslint/no-implied-eval": "error",
    "@typescript-eslint/await-thenable": "warn",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.name='execUnsafeLocalFunction']",
        "message": "execUnsafeLocalFunction is banned"
      },
      {
        "selector": "CallExpression[callee.property.name='execUnsafeLocalFunction']",
        "message": "execUnsafeLocalFunction is banned"
      },
      {
        "selector": "CallExpression[callee.name='setInnerHTMLUnsafe']",
        "message": "setInnerHTMLUnsafe is banned"
      },
      {
        "selector": "CallExpression[callee.property.name='setInnerHTMLUnsafe']",
        "message": "setInnerHTMLUnsafe is banned"
      }
    ]
  },
};
