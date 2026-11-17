"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Headphones,
  ImageIcon,
  Lock,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface ListeningAudioPlayerProps {
  audioUrl: string;
  imageUrl?: string | null;
  mode?: "exam" | "review";
  maxPlays?: number;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ListeningAudioPlayer({
  audioUrl,
  imageUrl = null,
  mode = "exam",
  maxPlays = 2,
}: ListeningAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxReachedTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const isExamMode = mode === "exam";
  const storageKey = `nihonsync_plays_${audioUrl}`;

  const { resolvedAudioSrc, resolvedImageSrc } = useMemo(() => {
    const supabase = createClient();

    const resolveBucketPath = (path: string | null): string | null => {
      if (!path) return null;
      if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
      }
      const cleanPath = path.replace(/^jlpt-media\//, "");
      const { data } = supabase.storage
        .from("jlpt-media")
        .getPublicUrl(cleanPath);
      return data.publicUrl;
    };

    return {
      resolvedAudioSrc: resolveBucketPath(audioUrl) ?? "",
      resolvedImageSrc: resolveBucketPath(imageUrl),
    };
  }, [audioUrl, imageUrl]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
    maxReachedTimeRef.current = 0;

    if (!isExamMode) {
      setPlayCount(0);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(storageKey);
      setPlayCount(stored ? Number(stored) || 0 : 0);
    } catch {
      setPlayCount(0);
    }
  }, [resolvedAudioSrc, isExamMode, storageKey]);

  const playsExhausted = isExamMode && playCount >= maxPlays && !isPlaying;

  function handleTogglePlay() {
    const audio = audioRef.current;
    if (!audio || !resolvedAudioSrc) return;

    if (isPlaying) {
      if (!isExamMode) {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (playsExhausted) return;

    const isFreshStart = audio.currentTime === 0 || audio.ended;
    audio.playbackRate = isExamMode ? 1 : playbackRate;

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setLoadError(false);
        if (isFreshStart) {
          maxReachedTimeRef.current = 0;
          setPlayCount((prev) => {
            const next = prev + 1;
            if (isExamMode) {
              try {
                window.sessionStorage.setItem(storageKey, String(next));
              } catch {
                // Ignore storage quota errors
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        setLoadError(true);
        setIsPlaying(false);
      });
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (audio.currentTime > maxReachedTimeRef.current) {
      maxReachedTimeRef.current = audio.currentTime;
    }
  }

  function handleSeeking() {
    const audio = audioRef.current;
    if (!audio || !isExamMode) return;
    if (Math.abs(audio.currentTime - maxReachedTimeRef.current) > 0.75) {
      audio.currentTime = maxReachedTimeRef.current;
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setCurrentTime(0);
    maxReachedTimeRef.current = 0;
  }

  function handleReviewSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (isExamMode || !audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(audioRef.current.currentTime);
  }

  function handleSpeedChange(nextRate: number) {
    if (isExamMode) return;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }

  function handleRetryAudio() {
    setLoadError(false);
    setCurrentTime(0);
    setRetrySeed((s) => s + 1);
  }

  const progressPct =
    duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  return (
    <div className="mt-3 space-y-3">
      {resolvedImageSrc && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#FAFAFA] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <ImageIcon className="h-3.5 w-3.5 text-[#E04F33]" />
            <span>Listening Visual Sheet (問題用紙)</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedImageSrc}
            alt="JLPT Listening Question Visual Sheet"
            className="mx-auto max-h-72 w-auto rounded-lg border border-slate-200 bg-white object-contain"
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-[#FAFAFA] p-3.5">
        <audio
          key={`${resolvedAudioSrc}-${retrySeed}`}
          ref={audioRef}
          src={resolvedAudioSrc || undefined}
          preload="auto"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onEnded={handleEnded}
          onError={() => {
            setIsPlaying(false);
            setLoadError(true);
          }}
        />

        {loadError || !resolvedAudioSrc ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#E04F33]" />
              <span>
                {isExamMode
                  ? "Audio track unavailable for this question — please check your internet connection or select an answer below to continue your exam."
                  : "Audio recording could not be loaded — you can still read the full Japanese transcript (スクリプト) and explanation below."}
              </span>
            </div>
            {resolvedAudioSrc && (
              <button
                type="button"
                onClick={handleRetryAudio}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/70 bg-white px-2.5 py-1 font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Audio</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={playsExhausted || (isExamMode && isPlaying)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E04F33] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#C83E24] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isPlaying ? (
                    <>
                      {isExamMode ? (
                        <Headphones className="h-3.5 w-3.5 animate-pulse" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                      <span>{isExamMode ? "Playing Audio..." : "Pause"}</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>
                        {playsExhausted
                          ? "Playback Limit Reached"
                          : playCount > 0
                          ? "Play Again"
                          : "Play Audio"}
                      </span>
                    </>
                  )}
                </button>

                {!isExamMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!audioRef.current) return;
                      audioRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-[#1E293B]"
                    title="Restart track"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                {isExamMode ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-[#FFFBEB] px-2.5 py-1 font-semibold text-[#B45309] tabular-nums">
                    <Lock className="h-3 w-3" />
                    <span>
                      Scrubbing Locked • Plays: {playCount}/{maxPlays}
                    </span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                    {[0.75, 1, 1.25].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                          playbackRate === rate
                            ? "bg-[#E04F33] text-white"
                            : "text-slate-600 hover:text-[#1E293B]"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                {formatAudioTime(currentTime)}
              </span>

              <div
                onClick={handleReviewSeek}
                className={`relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200 ${
                  isExamMode ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className="h-full bg-[#E04F33] transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {formatAudioTime(duration)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
