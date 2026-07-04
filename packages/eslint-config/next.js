import { config as baseConfig } from "./base.js";

/**
 * A shared ESLint configuration for Next.js packages.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  ...baseConfig,
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];
