
import { donutSegments } from "@/lib/charts";

export function DonutChart({ easy, medium, hard, total }: { easy: number; medium: number; hard: number; total: number }) {
  const [easySeg, mediumSeg, hardSeg] = donutSegments([easy, medium, hard]);

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="46" fill="none" stroke="var(--surface-2)" strokeWidth="14" />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke="var(--easy)"
        strokeWidth="14"
        strokeDasharray={easySeg.dasharray}
        strokeDashoffset={easySeg.dashoffset}
        transform="rotate(-90 60 60)"
        strokeLinecap="round"
      />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke="var(--medium)"
        strokeWidth="14"
        strokeDasharray={mediumSeg.dasharray}
        strokeDashoffset={mediumSeg.dashoffset}
        transform="rotate(-90 60 60)"
        strokeLinecap="round"
      />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke="var(--hard)"
        strokeWidth="14"
        strokeDasharray={hardSeg.dasharray}
        strokeDashoffset={hardSeg.dashoffset}
        transform="rotate(-90 60 60)"
        strokeLinecap="round"
      />
      <text x="60" y="55" textAnchor="middle" fill="var(--text)" fontFamily="Geist" fontWeight="700" fontSize="20">
        {total}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="var(--text-faint)" fontFamily="Geist" fontSize="10">
        solved
      </text>
    </svg>
  );
}
