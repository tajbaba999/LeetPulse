"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import FullScreenLoader from "@/components/FullScreenLoader";
import Sidebar from "@/components/layout/Sidebar";
import { AppDataProvider, useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";

function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { loading, needsOnboarding } = useAppData();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && !loading && needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, loading, needsOnboarding, router]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <FullScreenLoader label="Loading your workspace…" />;
  }
  if (status === "unauthenticated" || needsOnboarding) {
    return <FullScreenLoader />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ overflowY: "auto", maxHeight: "100vh" }}>{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
