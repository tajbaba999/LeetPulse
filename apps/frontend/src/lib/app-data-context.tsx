"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { CodingProfileResponse } from "./api/types";

import { ApiError } from "./api/client";
import { getCodingProfile } from "./api/codingprofile";

type AppDataValue = {
  codingProfile: CodingProfileResponse | null;
  loading: boolean;
  /** True when the account has never synced a LeetCode profile. */
  needsOnboarding: boolean;
  reload: () => Promise<void>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [codingProfile, setCodingProfile] = useState<CodingProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCodingProfile();
      setCodingProfile(data);
      setNeedsOnboarding(!data.profiles?.leetcode);
    } catch (err) {
      // 404 → never created a coding profile → onboarding required.
      if (err instanceof ApiError && err.status === 404) setNeedsOnboarding(true);
      setCodingProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(
    () => ({ codingProfile, loading, needsOnboarding, reload: load }),
    [codingProfile, loading, needsOnboarding, load],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
