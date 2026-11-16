"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from "lucide-react";

interface ListeningAudioPlayerProps {
  audioUrl: string;
  imageUrl?: string | null;
  mode: "exam" | "review";
  maxPlays?: number;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ListeningAudioPlayer({
  audioUrl,
  imageUrl,
  mode,
  maxPlays = 2,
}: ListeningAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const isExamMode = mode === "exam";
  const playsExhausted = isExamMode && playCount >= maxPlays && !isPlaying;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
  }, [audioUrl, retryKey]);

  async function handleTogglePlay() {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    if (isPlaying) {
      if (!isExamMode) {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (isExamMode && playCount >= maxPlays) return;

    try {
      await audio.play();
      setIsPlaying(true);
      if (isExamMode) {
        setPlayCount((c) => c + 1);
      }
    } catch {
      setLoadError(true);
      setIsPlaying(false);
    }
  }

  function handleRetry() {
    setLoadError(false);
    setRetryKey((k) => k + 1);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    if (isExamMode) return;
    const nextTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  }

  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-4 dark:border-[#27272A] dark:bg-[#111113]">
      {imageUrl && (
        <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white p-2 dark:border-[#27272A] dark:bg-[#18181B]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Listening question reference illustration"
            className="mx-auto max-h-64 w-auto object-contain"
          />
        </div>
      )}

      <audio
        key={`${audioUrl}-${retryKey}`}
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setLoadError(false);
          setDuration(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setLoadError(true);
          setIsPlaying(false);
        }}
      />

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3.5 dark:bg-[#E04F33]/15 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-xs text-[#0F172A] dark:text-[#F4F4F5]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E04F33]" />
            <div>
              <p className="font-bold text-[#E04F33]">
                Audio track unavailable right now
              </p>
              <p className="mt-0.5 leading-relaxed text-[#475569] dark:text-[#A1A1AA]">
                {isExamMode
                  ? "The recording could not be loaded due to a temporary network or media issue. You can retry loading or select an answer below to continue your test."
                  : "The audio recording could not be loaded. Please check your connection or review the transcript and explanation below."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E04F33]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#E04F33] transition hover:bg-[#FDF2EF] dark:bg-[#18181B]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry Audio</span>
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={playsExhausted || (isExamMode && isPlaying)}
              onClick={handleTogglePlay}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E23] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  {isExamMode ? (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  <span>{isExamMode ? "Playing Audio..." : "Pause"}</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>
                    {playsExhausted
                      ? "Playback Limit Reached"
                      : playCount > 0
                      ? "Play Again"
                      : "Play Listening Audio"}
                  </span>
                </>
              )}
            </button>

            {isExamMode ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#475569] tabular-nums dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA]">
                <Lock className="h-3 w-3 text-[#E04F33]" />
                <span>
                  Scrubbing Locked • Plays: {playCount}/{maxPlays}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-[#E04F33]">
                Review Mode • Free Scrubbing Enabled
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#475569] tabular-nums dark:text-[#A1A1AA]">
            <span>{formatSeconds(currentTime)}</span>
            {isExamMode ? (
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5E2DC] dark:bg-[#27272A]">
                <div
                  className="h-full bg-[#E04F33] transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            ) : (
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="h-2 flex-1 cursor-pointer accent-[#E04F33]"
                aria-label="Seek listening audio"
              />
            )}
            <span>{formatSeconds(duration)}</span>
          </div>
        </>
      )}
    </div>
  );
}
