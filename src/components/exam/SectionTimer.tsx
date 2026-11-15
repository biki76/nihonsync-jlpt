"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface SectionTimerProps {
  sectionStartedAt: string;
  timeLimitMinutes: number;
  serverNowIso: string;
  onExpire: () => void;
}

function formatSeconds(totalSec: number): string {
  const clamped = Math.max(0, totalSec);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function SectionTimer({
  sectionStartedAt,
  timeLimitMinutes,
  serverNowIso,
  onExpire,
}: SectionTimerProps) {
  const expiredRef = useRef(false);

  // Offset between server clock and client clock at hydration
  const clockOffsetRef = useRef<number>(
    Date.parse(serverNowIso) - Date.now()
  );

  const deadlineMs =
    Date.parse(sectionStartedAt) + timeLimitMinutes * 60 * 1000;

  const computeRemaining = () => {
    const estimatedServerNow = Date.now() + clockOffsetRef.current;
    return Math.max(0, Math.ceil((deadlineMs - estimatedServerNow) / 1000));
  };

  const [remainingSec, setRemainingSec] = useState<number>(computeRemaining);

  useEffect(() => {
    expiredRef.current = false;
    clockOffsetRef.current = Date.parse(serverNowIso) - Date.now();
    setRemainingSec(computeRemaining());
  }, [sectionStartedAt, timeLimitMinutes, serverNowIso]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = computeRemaining();
      setRemainingSec(next);

      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [deadlineMs, onExpire]);

  const isCritical = remainingSec < 60;
  const isWarning = remainingSec >= 60 && remainingSec < 300;

  let badgeStyle =
    "border-slate-200 bg-slate-100 text-[#1E293B]";
  if (isCritical) {
    badgeStyle =
      "border-red-300 bg-red-50 text-red-700 animate-pulse";
  } else if (isWarning) {
    badgeStyle =
      "border-amber-300 bg-[#FFFBEB] text-[#B45309]";
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold tabular-nums transition ${badgeStyle}`}
      title="Remaining section time"
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span>{formatSeconds(remainingSec)}</span>
    </div>
  );
}
