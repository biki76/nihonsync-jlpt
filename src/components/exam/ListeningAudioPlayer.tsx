"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Headphones,
  Lock,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const AUDIO_PLAY_EVENT = "nihonsync:audio-play";

export interface ListeningAudioPlayerProps {
  audioUrl?: string | null;
  src?: string | null;
  imageUrl?: string | null;
  mode?: "exam" | "review";
  maxPlays?: number;
  transcriptJa?: string | null;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function resolvePublicMediaUrl(rawPath?: string | null): string | null {
  if (!rawPath) return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const cleanPath = trimmed.replace(/^\/+/, "").replace(/^jlpt-media\//, "");
  try {
    const supabase = createClient();
    const { data } = supabase.storage.from("jlpt-media").getPublicUrl(cleanPath);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

export function ListeningAudioPlayer({
  audioUrl,
  src,
  imageUrl,
  mode = "exam",
  maxPlays = 2,
  transcriptJa,
}: ListeningAudioPlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAllowedTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioError, setAudioError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const rawAudioPath = audioUrl ?? src ?? null;

  const resolvedAudioUrl = useMemo(
    () => resolvePublicMediaUrl(rawAudioPath),
    [rawAudioPath]
  );
  const resolvedImageUrl = useMemo(
    () => resolvePublicMediaUrl(imageUrl),
    [imageUrl]
  );

  const isExamMode = mode === "exam";
  const isPausedMidTrack =
    !isPlaying &&
    currentTime > 0.25 &&
    (duration <= 0 || currentTime < duration - 0.25);
  const playsExhausted =
    isExamMode && !isPlaying && !isPausedMidTrack && playCount >= maxPlays;

  useEffect(() => {
    setIsPlaying(false);
    setPlayCount(0);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    lastAllowedTimeRef.current = 0;
  }, [resolvedAudioUrl]);

  // Single-active-track coordinator: pause this player when another player starts
  useEffect(() => {
    const handleOtherAudioStart = (event: Event) => {
      const custom = event as CustomEvent<{ playerId: string }>;
      if (custom.detail?.playerId !== playerId && audioRef.current) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };

    window.addEventListener(AUDIO_PLAY_EVENT, handleOtherAudioStart);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handleOtherAudioStart);
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
  }, [playerId]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen]);

  const handleTogglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !resolvedAudioUrl || audioError) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const isFreshStart =
      audio.ended || audio.currentTime < 0.25 || playCount === 0;

    if (isExamMode && isFreshStart && playCount >= maxPlays) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(AUDIO_PLAY_EVENT, { detail: { playerId } })
    );

    if (audio.ended) {
      audio.currentTime = 0;
      lastAllowedTimeRef.current = 0;
    }

    audio.playbackRate = isExamMode ? 1 : playbackRate;

    try {
      setAudioError(false);
      await audio.play();
      setIsPlaying(true);
      if (isFreshStart) {
        setPlayCount((prev) => prev + 1);
      }
    } catch {
      setIsPlaying(false);
      setAudioError(true);
    }
  };

  const handleRetryAudio = () => {
    setAudioError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    lastAllowedTimeRef.current = 0;
    setRetryKey((k) => k + 1);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (!audio.seeking) {
      lastAllowedTimeRef.current = audio.currentTime;
    }
  };

  const handleSeeking = () => {
    const audio = audioRef.current;
    if (!audio || !isExamMode) return;
    if (Math.abs(audio.currentTime - lastAllowedTimeRef.current) > 0.35) {
      audio.currentTime = lastAllowedTimeRef.current;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isExamMode || !audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const handleRateChange = (rate: number) => {
    if (isExamMode) return;
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div translate="no" className="relative z-0 my-4 space-y-3">
      {/* Zoomable Listening Visual Sheet (問題用紙) */}
      {resolvedImageUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2">
            <span
              suppressHydrationWarning
              className="text-xs font-bold tracking-wide text-slate-700"
            >
              問題用紙 • Visual Sheet
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setImageZoomed((z) => !z)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                aria-label={
                  imageZoomed ? "Zoom out visual sheet" : "Zoom in visual sheet"
                }
              >
                {imageZoomed ? (
                  <>
                    <ZoomOut className="h-3.5 w-3.5 text-[#0F766E]" />
                    <span suppressHydrationWarning>100%</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5 text-[#0F766E]" />
                    <span suppressHydrationWarning>Zoom In</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1 rounded-md bg-[#0F766E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#115E59]"
                aria-label="Open full-screen visual sheet"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span suppressHydrationWarning>Full Screen</span>
              </button>
            </div>
          </div>

          <div
            className={`w-full bg-white p-2 sm:p-3 ${
              imageZoomed ? "overflow-x-auto" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt="JLPT Listening Question Visual Sheet"
              onClick={() => setLightboxOpen(true)}
              className={`mx-auto h-auto cursor-zoom-in rounded-lg transition-all duration-150 ${
                imageZoomed ? "w-[145%] max-w-none" : "w-full object-contain"
              }`}
            />
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && resolvedImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Listening Visual Sheet"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-xs"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-sm font-bold text-slate-800">
                問題用紙 • Enlarged View
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt="Enlarged JLPT Listening Visual Sheet"
              className="mx-auto h-auto w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Audio Control Bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 sm:p-4">
        {resolvedAudioUrl && (
          <audio
            key={`${resolvedAudioUrl}-${retryKey}`}
            ref={audioRef}
            src={resolvedAudioUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 0);
              setAudioError(false);
            }}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              lastAllowedTimeRef.current = 0;
            }}
            onError={() => {
              setIsPlaying(false);
              setAudioError(true);
            }}
          />
        )}

        {audioError ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-[#0F172A]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E04F33]" />
              <div>
                <p className="font-bold text-[#E04F33]">
                  Audio track unavailable right now
                </p>
                <p className="mt-0.5 leading-relaxed text-[#475569]">
                  {isExamMode
                    ? "The recording could not be loaded due to a temporary network issue. Tap Retry Audio or select an answer below to continue your exam."
                    : "The audio recording could not be loaded. Please check your connection or review the Japanese transcript below."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRetryAudio}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E04F33]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#E04F33] transition hover:bg-[#FDF2EF]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Audio</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={!resolvedAudioUrl || playsExhausted}
                onClick={handleTogglePlayPause}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-colors ${
                  playsExhausted || !resolvedAudioUrl
                    ? "cursor-not-allowed bg-slate-400"
                    : isPlaying
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#E04F33] hover:bg-[#C93E23]"
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span suppressHydrationWarning>Pause Audio</span>
                  </>
                ) : playsExhausted ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span suppressHydrationWarning>Playback Limit Reached</span>
                  </>
                ) : isPausedMidTrack ? (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span suppressHydrationWarning>Resume Audio</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span suppressHydrationWarning>
                      {playCount > 0 ? "Play Again" : "Play Audio"}
                    </span>
                  </>
                )}
              </button>

              {isExamMode ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span suppressHydrationWarning>
                    Scrubbing Locked • Plays: {Math.min(playCount, maxPlays)}/{maxPlays}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        setCurrentTime(0);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restart</span>
                  </button>
                  {[0.75, 1, 1.25].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateChange(rate)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                        playbackRate === rate
                          ? "bg-[#0F766E] text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-3 flex items-center gap-3">
              <span
                suppressHydrationWarning
                className="text-xs font-semibold text-slate-600 tabular-nums"
              >
                {formatAudioTime(currentTime)}
              </span>
              <div
                onClick={handleProgressClick}
                className={`relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200 ${
                  isExamMode ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className="h-full rounded-full bg-[#0F766E] transition-all duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span
                suppressHydrationWarning
                className="text-xs font-semibold text-slate-600 tabular-nums"
              >
                {formatAudioTime(duration)}
              </span>
            </div>

            {!resolvedAudioUrl && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Headphones className="h-3.5 w-3.5" />
                <span>Audio track unavailable for this question.</span>
              </div>
            )}
          </>
        )}

        {!isExamMode && transcriptJa && (
          <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <summary className="cursor-pointer font-bold text-[#0F766E]">
              聴解スクリプト (Japanese Transcript)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
              {transcriptJa}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
