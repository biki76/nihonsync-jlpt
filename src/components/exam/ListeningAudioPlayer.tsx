"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Headphones,
  ImageIcon,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  X,
  ZoomIn,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const AUDIO_PLAY_EVENT = "nihonsync:audio-play";

interface ListeningAudioPlayerProps {
  audioUrl?: string;
  src?: string;
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
  src,
  imageUrl = null,
  mode = "exam",
  maxPlays = 2,
}: ListeningAudioPlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxReachedTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const rawAudioPath = audioUrl ?? src ?? "";

  const { resolvedAudioSrc, resolvedImageSrc } = useMemo(() => {
    const supabase = createClient();

    const resolveBucketPath = (path: string | null | undefined): string | null => {
      if (!path) return null;
      if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
      }
      const cleanPath = path.replace(/^jlpt-media\//, "").replace(/^\/+/, "");
      const { data } = supabase.storage
        .from("jlpt-media")
        .getPublicUrl(cleanPath);
      return data.publicUrl;
    };

    return {
      resolvedAudioSrc: resolveBucketPath(rawAudioPath) ?? "",
      resolvedImageSrc: resolveBucketPath(imageUrl),
    };
  }, [rawAudioPath, imageUrl]);

  useEffect(() => {
    setIsPlaying(false);
    setPlayCount(0);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
    setLightboxOpen(false);
    maxReachedTimeRef.current = 0;
  }, [resolvedAudioSrc]);

  useEffect(() => {
    function handleOtherPlayerStarted(event: Event) {
      const custom = event as CustomEvent<{ playerId: string }>;
      if (custom.detail?.playerId !== playerId && audioRef.current) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    }

    window.addEventListener(AUDIO_PLAY_EVENT, handleOtherPlayerStarted);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handleOtherPlayerStarted);
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
  }, [playerId]);

  const isExamMode = mode === "exam";
  const isPausedMidTrack =
    !isPlaying && currentTime > 0.25 && (duration <= 0 || currentTime < duration - 0.25);
  const playsExhausted =
    isExamMode && playCount >= maxPlays && !isPlaying && !isPausedMidTrack;

  async function handleTogglePlay() {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (playsExhausted) return;

    const isFreshStart = audio.currentTime < 0.25 || audio.ended;
    if (isFreshStart) {
      maxReachedTimeRef.current = 0;
    }

    window.dispatchEvent(
      new CustomEvent(AUDIO_PLAY_EVENT, { detail: { playerId } })
    );

    audio.playbackRate = isExamMode ? 1 : playbackRate;

    try {
      await audio.play();
      setIsPlaying(true);
      setLoadError(false);
      if (isFreshStart) {
        setPlayCount((prev) => prev + 1);
      }
    } catch {
      setIsPlaying(false);
      setLoadError(true);
    }
  }

  function handleRetryAudio() {
    setLoadError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    maxReachedTimeRef.current = 0;
    setRetryKey((prev) => prev + 1);
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

  const progressPct =
    duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  const buttonLabel = isPlaying
    ? "Pause Audio"
    : playsExhausted
    ? "Playback Limit Reached"
    : isPausedMidTrack
    ? "Resume Audio"
    : playCount > 0
    ? "Play Again"
    : "Play Audio";

  return (
    <div className="mt-3 space-y-3">
      {resolvedImageSrc && (
        <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-2.5 sm:p-3.5 dark:border-[#27272A] dark:bg-[#111113]">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold text-[#475569] dark:text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-[#E04F33]" />
              <span>Listening Visual Sheet (問題用紙)</span>
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5E2DC] bg-white px-2.5 py-1 text-[11px] font-bold text-[#18181B] transition hover:border-[#E04F33] hover:text-[#E04F33] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#F4F4F5]"
            >
              <ZoomIn className="h-3.5 w-3.5 text-[#E04F33]" />
              <span>Enlarge</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative block w-full overflow-hidden rounded-lg border border-[#E5E2DC] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E04F33] dark:border-[#27272A]"
            aria-label="Tap to enlarge listening visual sheet"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageSrc}
              alt="JLPT Listening Question Visual Sheet"
              className="mx-auto max-h-[560px] w-full max-w-2xl object-contain transition-transform duration-150 group-hover:scale-[1.01]"
            />
          </button>
        </div>
      )}

      {lightboxOpen && resolvedImageSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Listening Visual Sheet"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-[#E5E2DC] bg-white p-3 shadow-2xl dark:border-[#27272A] dark:bg-[#18181B]"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#18181B] dark:text-[#F4F4F5]">
                問題用紙 — Full View
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#E04F33] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#C83E23]"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageSrc}
              alt="Enlarged JLPT Listening Question Visual Sheet"
              className="mx-auto h-auto w-full rounded-lg bg-white object-contain"
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-3.5 dark:border-[#27272A] dark:bg-[#111113]">
        <audio
          key={`${resolvedAudioSrc}-${retryKey}`}
          ref={audioRef}
          src={resolvedAudioSrc}
          preload="metadata"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            setLoadError(false);
          }}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onEnded={handleEnded}
          onError={() => {
            setIsPlaying(false);
            setLoadError(true);
          }}
        />

        {loadError ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3.5 text-xs dark:bg-[#E04F33]/15 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-[#0F172A] dark:text-[#F4F4F5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E04F33]" />
              <div>
                <p className="font-bold text-[#E04F33]">
                  Audio track is currently unavailable
                </p>
                <p className="mt-0.5 leading-relaxed text-[#475569] dark:text-[#A1A1AA]">
                  {isExamMode
                    ? "We could not load the listening recording right now. Check your connection and retry, or select your answer below to continue the exam."
                    : "We could not load this audio recording. You can still review the full Japanese transcript and explanation below."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRetryAudio}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E04F33]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#E04F33] transition hover:bg-[#FDF2EF] dark:bg-[#18181B]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Audio</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={playsExhausted}
                  aria-pressed={isPlaying}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isPlaying
                      ? "bg-[#18181B] hover:bg-[#27272A] dark:bg-[#F4F4F5] dark:text-[#18181B]"
                      : "bg-[#E04F33] hover:bg-[#C83E23]"
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>{buttonLabel}</span>
                </button>

                {!isExamMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!audioRef.current) return;
                      audioRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:border-[#E04F33] hover:text-[#0F172A] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA]"
                    title="Restart track"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                {isExamMode ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E04F33]/30 bg-[#FDF2EF] px-2.5 py-1.5 text-[11px] font-bold text-[#E04F33] tabular-nums dark:bg-[#E04F33]/15">
                    <Lock className="h-3 w-3" />
                    <span>
                      Scrubbing Locked • Plays: {playCount}/{maxPlays}
                    </span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1 rounded-xl border border-[#E5E2DC] bg-white p-1 dark:border-[#27272A] dark:bg-[#18181B]">
                    <Headphones className="ml-1.5 h-3.5 w-3.5 text-[#E04F33]" />
                    {[0.75, 1, 1.25].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums transition ${
                          playbackRate === rate
                            ? "bg-[#E04F33] text-white"
                            : "text-[#475569] hover:text-[#0F172A] dark:text-[#A1A1AA]"
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
              <span className="text-[11px] font-bold text-[#475569] tabular-nums dark:text-[#A1A1AA]">
                {formatAudioTime(currentTime)}
              </span>

              <div
                onClick={handleReviewSeek}
                role={isExamMode ? undefined : "slider"}
                aria-label="Audio playback progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(currentTime)}
                className={`relative h-2 flex-1 overflow-hidden rounded-full bg-[#E5E2DC] dark:bg-[#27272A] ${
                  isExamMode ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className="h-full bg-[#E04F33] transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <span className="text-[11px] font-bold text-[#475569] tabular-nums dark:text-[#A1A1AA]">
                {formatAudioTime(duration)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
