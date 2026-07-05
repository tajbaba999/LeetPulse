"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import FullScreenLoader from "@/components/FullScreenLoader";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
    else if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return <FullScreenLoader />;
}
