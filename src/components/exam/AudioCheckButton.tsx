"use client";

import { useState } from "react";
import { CheckCircle2, Volume2 } from "lucide-react";

export function AudioCheckButton() {
  const [playing, setPlaying] = useState(false);
  const [tested, setTested] = useState(false);

  function playTestChime() {
    if (playing) return;
    setPlaying(true);

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.25);
      gain2.gain.setValueAtTime(0.18, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.85);

      setTimeout(() => {
        setPlaying(false);
        setTested(true);
        ctx.close().catch(() => {});
      }, 900);
    } catch {
      setPlaying(false);
      setTested(true);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 dark:border-[#2E2E32] dark:bg-[#111113]">
      <div>
        <p className="text-sm font-bold text-[#18181B] dark:text-[#F4F4F5]">
          Listening Section Audio Check
        </p>
        <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
          Verify your speaker or headphone volume before entering the exam room.
        </p>
      </div>

      <button
        type="button"
        onClick={playTestChime}
        disabled={playing}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6E2DA] bg-white px-4 py-2 text-xs font-bold text-[#18181B] shadow-xs transition hover:border-[#E04F33] hover:text-[#E04F33] disabled:opacity-60 dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
      >
        <Volume2 className={`h-4 w-4 text-[#E04F33] ${playing ? "animate-pulse" : ""}`} />
        <span>{playing ? "Playing Chime..." : "Test Audio Chime"}</span>
        {tested && !playing && <CheckCircle2 className="h-3.5 w-3.5 text-[#E04F33]" />}
      </button>
    </div>
  );
}
