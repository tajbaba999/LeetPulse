"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  ActivityIcon,
  ChatIcon,
  DashboardIcon,
  LogoMark,
  MoonIcon,
  ProfileIcon,
  QuestionsIcon,
  SignOutIcon,
} from "@/components/icons";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
};

const NAV: NavItem[] = [
  { href: "/chat", label: "AI Chat", icon: <ChatIcon />, badge: "NEW" },
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/questions", label: "Questions", icon: <QuestionsIcon /> },
  { href: "/activity", label: "Activity", icon: <ActivityIcon /> },
  { href: "/profile", label: "Profile", icon: <ProfileIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { codingProfile } = useAppData();
  const { theme, toggleTheme } = useTheme();

  const username = codingProfile?.profiles?.leetcode ?? user?.email?.split("@")[0] ?? "";
  const name = user?.name ?? username ?? "You";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <div style={{ background: "var(--bg-elevated)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "22px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 32 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogoMark size={16} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>LeetPulse</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item, idx) => {
          const active = pathname === item.href;
          return (
            <div key={item.href}>
              {idx === 1 && <div style={{ height: 1, background: "var(--border)", margin: "8px 4px 6px" }} />}
              <div
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  background: active ? "var(--surface)" : "transparent",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 6px", borderRadius: 5, background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "white" }}>
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div onClick={toggleTheme} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
            <MoonIcon size={14} />
            {theme === "dark" ? "Dark mode" : "Light mode"}
          </div>
          <div style={{ width: 34, height: 20, borderRadius: 12, background: theme === "dark" ? "var(--surface-2)" : "var(--accent)", position: "relative", transition: "background 0.2s ease" }}>
            <div style={{ position: "absolute", top: 2, left: theme === "dark" ? 2 : 16, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s ease" }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {initials || "·"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{username}</div>
          </div>
          <div onClick={signOut} style={{ cursor: "pointer", color: "var(--text-faint)" }} title="Sign out">
            <SignOutIcon size={15} />
          </div>
        </div>
      </div>
    </div>
  );
}
