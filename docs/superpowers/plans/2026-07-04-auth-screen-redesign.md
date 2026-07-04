# Auth Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `AuthScreen.tsx` with a form-left/image-right sign-in/sign-up screen built from new shadcn-style primitives (Button, Input, Label, PasswordInput, Typewriter), remove the fake stats/Google button/LeetCode-username field, and fix the now-stale "missing LeetCode username" guard in `SyncClient.tsx`.

**Architecture:** Six small, single-purpose primitive files land in `apps/frontend/src/components/ui/` (new folder usage), each restyled to the project's existing CSS variables instead of shadcn's default token names — no new CSS variables are added to `globals.css`. `AuthScreen.tsx` composes them into the new layout. `SyncClient.tsx` gets a one-block deletion since the backend already resolves the LeetCode username from `.env`.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS v4, TypeScript, Radix UI primitives (`@radix-ui/react-slot`, `@radix-ui/react-label`), `class-variance-authority`, `clsx` + `tailwind-merge`, `lucide-react`.

## Global Constraints

- Package manager is pnpm; use `pnpm install` / `pnpm run <script>` (never npm/yarn).
- Frontend uses the `@/` alias for `src/`.
- No new CSS variables in `globals.css` — every new component must resolve to the existing tokens: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--text-faint`, `--accent`, `--hard`.
- No shadcn CLI / `components.json` — only the specific primitives this screen needs are added.
- No new test framework — this repo has no `vitest`/`jest`/`playwright` configured. Verification is `pnpm run check-types`, `pnpm run build`, and manual browser exercise, per `CLAUDE.md`'s Verification section.
- Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- Two verified stock image URLs (HTTP 200 confirmed) are the only image assets used:
  - Sign-in: `https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80`
  - Sign-up: `https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80`

---

### Task 1: Install dependencies and add the `cn()` utility

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/src/lib/utils.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` — used by every component created in Tasks 2-5.

- [ ] **Step 1: Add and install dependencies**

Run (from the repo root):

```bash
pnpm --filter @leetplus/frontend add clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-label class-variance-authority lucide-react
```

This lets pnpm resolve and pin real, currently-published versions compatible with this project's React 19 (don't hand-type version numbers into `package.json` — a guessed version may not exist or may not satisfy React 19's peer dependency range).

Expected: exits 0; `apps/frontend/package.json`'s `"dependencies"` gains six new entries; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Create the `cn()` utility**

Create `apps/frontend/src/lib/utils.ts`:

```ts
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml apps/frontend/src/lib/utils.ts
git commit -m "chore: add shadcn-style UI dependencies and cn() utility"
```

---

### Task 2: Button primitive

**Files:**
- Create: `apps/frontend/src/components/ui/button.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`.
- Produces: `Button` (forwardRef component, props: `variant?: "default"|"destructive"|"outline"|"secondary"|"ghost"|"link"`, `size?: "default"|"sm"|"lg"|"icon"`, `asChild?: boolean`, plus all native `button` props), `buttonVariants`.

- [ ] **Step 1: Create the file**

Create `apps/frontend/src/components/ui/button.tsx`:

```tsx
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:border-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:opacity-90",
        destructive: "bg-hard text-white hover:bg-hard/90",
        outline: "border border-border bg-surface text-text hover:bg-surface-2",
        secondary: "bg-surface-2 text-text hover:bg-surface-2/80",
        ghost: "text-text hover:bg-surface-2",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 2: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/button.tsx
git commit -m "feat: add Button UI primitive"
```

---

### Task 3: Input and Label primitives

**Files:**
- Create: `apps/frontend/src/components/ui/input.tsx`
- Create: `apps/frontend/src/components/ui/label.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`.
- Produces: `Input` (forwardRef, native `input` props), `Label` (forwardRef, wraps `@radix-ui/react-label`'s `Root`, native label props).

- [ ] **Step 1: Create Input**

Create `apps/frontend/src/components/ui/input.tsx`:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-border bg-surface px-3.5 py-3 text-sm text-text outline-none placeholder:text-text-faint focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 2: Create Label**

Create `apps/frontend/src/components/ui/label.tsx`:

```tsx
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-xs font-semibold text-text-dim peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/ui/input.tsx apps/frontend/src/components/ui/label.tsx
git commit -m "feat: add Input and Label UI primitives"
```

---

### Task 4: PasswordInput primitive

**Files:**
- Create: `apps/frontend/src/components/ui/password-input.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`.
- Produces: `PasswordInput` (forwardRef, props: `label?: string` plus all native `input` props), `PasswordInputProps`.

- [ ] **Step 1: Create the file**

Create `apps/frontend/src/components/ui/password-input.tsx`:

```tsx
"use client";

import * as React from "react";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const togglePasswordVisibility = () => setShowPassword(prev => !prev);

    return (
      <div className="grid w-full items-center gap-1.5">
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="relative">
          <Input
            id={id}
            type={showPassword ? "text" : "password"}
            className={cn("pe-10", className)}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 end-0 flex h-full w-10 items-center justify-center text-text-faint transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword
              ? <EyeOff className="size-4" aria-hidden="true" />
              : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
```

- [ ] **Step 2: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/password-input.tsx
git commit -m "feat: add PasswordInput UI primitive with show/hide toggle"
```

---

### Task 5: Typewriter primitive

**Files:**
- Create: `apps/frontend/src/components/ui/typewriter.tsx`

**Interfaces:**
- Produces: `Typewriter` (component, props: `text: string | string[]`, `speed?: number`, `cursor?: string`, `loop?: boolean`, `deleteSpeed?: number`, `delay?: number`, `className?: string`), `TypewriterProps`.

- [ ] **Step 1: Create the file**

Create `apps/frontend/src/components/ui/typewriter.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export interface TypewriterProps {
  text: string | string[];
  speed?: number;
  cursor?: string;
  loop?: boolean;
  deleteSpeed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({
  text,
  speed = 100,
  cursor = "|",
  loop = false,
  deleteSpeed = 50,
  delay = 1500,
  className,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textArrayIndex, setTextArrayIndex] = useState(0);

  const textArray = Array.isArray(text) ? text : [text];
  const currentText = textArray[textArrayIndex] || "";

  useEffect(() => {
    if (!currentText)
      return;

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (currentIndex < currentText.length) {
            setDisplayText(prev => prev + currentText[currentIndex]);
            setCurrentIndex(prev => prev + 1);
          }
          else if (loop) {
            setTimeout(() => setIsDeleting(true), delay);
          }
        }
        else {
          if (displayText.length > 0) {
            setDisplayText(prev => prev.slice(0, -1));
          }
          else {
            setIsDeleting(false);
            setCurrentIndex(0);
            setTextArrayIndex(prev => (prev + 1) % textArray.length);
          }
        }
      },
      isDeleting ? deleteSpeed : speed,
    );

    return () => clearTimeout(timeout);
  }, [currentIndex, isDeleting, currentText, loop, speed, deleteSpeed, delay, displayText, text]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">{cursor}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/typewriter.tsx
git commit -m "feat: add Typewriter UI primitive"
```

---

### Task 6: Rewrite AuthScreen.tsx

**Files:**
- Modify: `apps/frontend/src/app/components/AuthScreen.tsx` (full rewrite)

**Interfaces:**
- Consumes: `signin`, `signup` from `@/lib/api-client` (unchanged signatures: `signup(input: { name: string; email: string; password: string })`, `signin(input: { email: string; password: string })`); `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; `PasswordInput` from `@/components/ui/password-input`; `Typewriter` from `@/components/ui/typewriter`.
- Produces: `AuthScreen` (unchanged export name/shape — no props — consumed by `apps/frontend/src/app/page.tsx:6,14`, which does not need to change).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `apps/frontend/src/app/components/AuthScreen.tsx` with:

```tsx
"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signin, signup } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Typewriter } from "@/components/ui/typewriter";

type Mode = "signin" | "signup";

const modeContent: Record<Mode, { image: string; quote: string }> = {
  signin: {
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
    quote: "Pick up right where your last submission left off.",
  },
  signup: {
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
    quote: "Ask your LeetCode profile anything. Get answers, not just numbers.",
  },
};

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const current = modeContent[mode];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup({ name, email, password });
        router.push("/sync?mode=initial");
      }
      else {
        await signin({ email, password });
        router.push("/dashboard");
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode(prev => (prev === "signin" ? "signup" : "signin"));
    setError(null);
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[480px_1fr]">
      <div className="flex flex-col justify-center p-8 sm:p-16">
        <div className="mx-auto w-full max-w-[340px] animate-[fadeUp_0.5s_ease_both]">
          <div className="mb-10 flex items-center gap-2.5">
            <Logo />
            <span className="text-xl font-bold tracking-tight">LeetPulse</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            {isSignup ? "Create your account" : "Sign in to your account"}
          </h1>
          <p className="mb-7 text-sm text-text-dim">
            {isSignup
              ? "Link your LeetCode profile to get personalized analytics."
              : "Sign in to see your latest progress."}
          </p>

          <form onSubmit={handleSubmit} autoComplete="on" className="flex flex-col gap-4">
            {isSignup && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Ada Lovelace"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <PasswordInput
              name="password"
              label="Password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            {error && <div className="text-sm text-hard">{error}</div>}

            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Please wait…" : isSignup ? "Create account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-text-faint">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            <Button type="button" variant="link" className="pl-1" onClick={toggleMode}>
              {isSignup ? "Sign in" : "Sign up"}
            </Button>
          </div>
        </div>
      </div>

      <div
        key={current.image}
        className="relative hidden bg-cover bg-center transition-all duration-500 ease-in-out lg:block"
        style={{ backgroundImage: `url(${current.image})` }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-t from-bg to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-center justify-end p-10 pb-8">
          <blockquote className="max-w-md space-y-2 text-center text-text">
            <p className="text-lg font-medium">
              “
              <Typewriter key={current.quote} text={current.quote} speed={40} />
              ”
            </p>
            <cite className="block text-sm font-light text-text-faint not-italic">— LeetPulse</cite>
          </blockquote>
          <div className="mt-6 text-xs text-text-faint">© 2026 LeetPulse — analytics for people who ship</div>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]"
      style={{ background: "linear-gradient(135deg, oklch(0.68 0.19 260.84), var(--accent))" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 14L10 20L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors. (This will fail if any prior task's file has a mismatched export — check the error output names against the "Produces" lines above if it doesn't.)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/components/AuthScreen.tsx
git commit -m "feat: rebuild AuthScreen with form-left/image-right layout"
```

---

### Task 7: Fix SyncClient.tsx stale LeetCode-username guard

**Files:**
- Modify: `apps/frontend/src/app/sync/SyncClient.tsx:22-27`

**Interfaces:**
- No signature changes — `SyncClient` remains a no-props component consumed by `apps/frontend/src/app/sync/page.tsx`.

- [ ] **Step 1: Remove the stale guard**

In `apps/frontend/src/app/sync/SyncClient.tsx`, find:

```tsx
  useEffect(() => {
    if (mode === "initial" && !leetcode) {
      setError("Missing LeetCode username — go back and sign up again.");
      return;
    }

    const controller = new AbortController();
```

Replace with:

```tsx
  useEffect(() => {
    const controller = new AbortController();
```

Leave the rest of the file (including the `leetcode` variable read from `searchParams` at line 12 and its use in the `streamSync(mode, leetcode, ...)` call) unchanged — `leetcode` will simply be `undefined` for the initial-sync flow now, and `streamSync` already sends that through to the backend, which resolves it from `LEETCODE_USERNAME` in `.env`.

- [ ] **Step 2: Verify types**

Run: `pnpm --filter @leetplus/frontend run check-types`
Expected: exits 0, no TypeScript errors, no "unused variable" warning for `leetcode` (it's still passed to `streamSync`).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/sync/SyncClient.tsx
git commit -m "fix: stop requiring LeetCode username on initial sync"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole monorepo**

Run: `pnpm run check-types`
Expected: exits 0, all packages report success.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: exits 0. If auto-fixable issues are reported, run `pnpm --filter @leetplus/frontend exec eslint --fix .` and re-run lint to confirm it's clean.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: exits 0, `apps/frontend` build succeeds (Next.js production build completes without errors).

- [ ] **Step 4: Manual browser walkthrough**

Boot the app (`pnpm run --filter @leetplus/frontend dev`, plus the backend running — either `pnpm run --filter @leetplus/backend dev` or the docker-compose stack) and in a browser:

1. Load `/` with no session cookie — confirm the new form-left/image-right screen renders, no Google button, no "LeetCode username" field, no fake stat cards.
2. Click the "Sign up" toggle link — confirm the image and quote on the right swap (new image loads, quote types out), and the form now shows Full Name / Email / Password only.
3. Toggle the password field's eye icon — confirm it switches between masked and plain text.
4. Submit sign-up with a real account — confirm redirect to `/sync?mode=initial` (no `leetcode` query param in the URL) and that the sync stream starts successfully instead of showing "Missing LeetCode username."
5. Sign out (or open a fresh session) and submit sign-in — confirm redirect to `/dashboard`.

- [ ] **Step 5: Commit any lint --fix changes (only if Step 2 produced any)**

```bash
git add -A
git commit -m "style: apply eslint autofixes"
```
