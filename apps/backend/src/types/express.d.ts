import type { TokenPayload } from "../utils/tokens.js";

declare global {
  namespace Express {
    // Declaration merging into Express's own Request interface requires `interface`, not `type`.
    // eslint-disable-next-line ts/consistent-type-definitions
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
