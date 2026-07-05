import type { AuthTokens } from "./types";

import { apiFetch } from "./client";

export function signin(email: string, password: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>("/signin", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export function signup(name: string, email: string, password: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>("/signup", {
    method: "POST",
    auth: false,
    body: { name, email, password },
  });
}
