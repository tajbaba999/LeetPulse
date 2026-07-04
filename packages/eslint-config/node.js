import { config as baseConfig } from "./base.js";

/**
 * A shared ESLint configuration for Node.js packages.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  ...baseConfig,
  {
    rules: {
      "no-process-env": "off",
    },
  },
];
