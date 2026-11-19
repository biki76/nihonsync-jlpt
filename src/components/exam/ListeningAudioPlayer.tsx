"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Headphones, Lock, Maximize2,
  Pause, Play, RefreshCw, RotateCcw, X, ZoomIn, ZoomOut,
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

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveMediaUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/^\/+/, "").replace(/^jlpt-media\//, "");
  try {
    const supabase = createClient();
    return supabase.storage.from("jlpt-media").getPublicUrl(clean).data?.publicUrl || null;
  } catch {
    return null;
  }
}

export function ListeningAudioPlayer({
  audioUrl, src, imageUrl, mode = "exam", maxPlays = 2, transcriptJa,
}: ListeningAudioPlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const maxTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const resolvedAudio = useMemo(() => resolveMediaUrl(audioUrl ?? src), [audioUrl, src]);
  const resolvedImage = useMemo(() => resolveMediaUrl(imageUrl), [imageUrl]);
  const isExam = mode === "exam";
  const isPausedMid = !isPlaying && currentTime > 0.25 && (duration <= 0 || currentTime < duration - 0.25);
  const exhausted = isExam && !isPlaying && !isPausedMid && playCount >= maxPlays;

  useEffect(() => {
    setIsPlaying(false); setPlayCount(0); setCurrentTime(0); setDuration(0); setHasError(false); maxTimeRef.current = 0;
  }, [resolvedAudio]);

  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      const id = (e as CustomEvent<{ playerId: string }>).detail?.playerId;
      if (id !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener(AUDIO_PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(AUDIO_PLAY_EVENT, onOtherPlay);
  }, [playerId]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !resolvedAudio || hasError) return;
    if (!audio.paused) { audio.pause(); setIsPlaying(false); return; }
    const fresh = audio.ended || audio.currentTime < 0.25 || playCount === 0;
    if (isExam && fresh && playCount >= maxPlays) return;
    window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: { playerId } }));
    if (audio.ended) { audio.currentTime = 0; maxTimeRef.current = 0; }
    audio.playbackRate = isExam ? 1 : rate;
    try {
      setHasError(false);
      await audio.play();
      setIsPlaying(true);
      if (fresh) setPlayCount((p) => p + 1);
    } catch {
      setIsPlaying(false);
      setHasError(true);
    }
  };

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div translate="no" className="relative z-0 my-4 space-y-3">
      {resolvedImage && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2">
            <span suppressHydrationWarning className="text-xs font-bold text-slate-700">問題用紙 • Visual Sheet</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setZoomed((z) => !z)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                {zoomed ? <ZoomOut className="h-3.5 w-3.5 text-[#0F766E]" /> : <ZoomIn className="h-3.5 w-3.5 text-[#0F766E]" />}
                <span suppressHydrationWarning>{zoomed ? "100%" : "Zoom In"}</span>
              </button>
              <button type="button" onClick={() => setLightbox(true)} className="inline-flex items-center gap-1 rounded-md bg-[#0F766E] px-2.5 py-1 text-xs font-semibold text-white">
                <Maximize2 className="h-3.5 w-3.5" />
                <span suppressHydrationWarning>Full Screen</span>
              </button>
            </div>
          </div>
          <div className={`w-full bg-white p-2 ${zoomed ? "overflow-x-auto" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedImage} alt="JLPT Visual Sheet" onClick={() => setLightbox(true)} className={`mx-auto h-auto cursor-zoom-in rounded-lg ${zoomed ? "w-[145%] max-w-none" : "w-full object-contain"}`} />
          </div>
        </div>
      )}

      {lightbox && resolvedImage && (
        <div role="dialog" aria-modal="true" onClick={() => setLightbox(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3">
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between border-b pb-2">
              <span className="text-sm font-bold text-slate-800">問題用紙 • Enlarged View</span>
              <button type="button" onClick={() => setLightbox(false)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"><X className="h-4 w-4" />Close</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedImage} alt="Enlarged Visual Sheet" className="mx-auto h-auto w-full object-contain" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
        {resolvedAudio && (
          <audio
            key={`${resolvedAudio}-${retryKey}`}
            ref={audioRef}
            src={resolvedAudio}
            preload="metadata"
            onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setHasError(false); }}
            onTimeUpdate={() => { if (!audioRef.current) return; setCurrentTime(audioRef.current.currentTime); if (!audioRef.current.seeking) maxTimeRef.current = audioRef.current.currentTime; }}
            onSeeking={() => { if (audioRef.current && isExam && Math.abs(audioRef.current.currentTime - maxTimeRef.current) > 0.35) audioRef.current.currentTime = maxTimeRef.current; }}
            onEnded={() => { setIsPlaying(false); setCurrentTime(0); maxTimeRef.current = 0; }}
            onError={() => { setIsPlaying(false); setHasError(true); }}
          />
        )}

        {hasError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-[#E04F33]"><AlertCircle className="h-4 w-4" />Audio track unavailable right now</span>
            <button type="button" onClick={() => { setHasError(false); setRetryKey((k) => k + 1); }} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-bold text-[#E04F33]"><RefreshCw className="h-3.5 w-3.5" />Retry Audio</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" disabled={!resolvedAudio || exhausted} onClick={togglePlay} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${exhausted || !resolvedAudio ? "bg-slate-400" : isPlaying ? "bg-amber-600" : "bg-[#E04F33]"}`}>
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                <span suppressHydrationWarning>{isPlaying ? "Pause Audio" : exhausted ? "Playback Limit Reached" : isPausedMid ? "Resume Audio" : playCount > 0 ? "Play Again" : "Play Audio"}</span>
              </button>
              {isExam ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                  <Lock className="h-3.5 w-3.5" />
                  <span suppressHydrationWarning>Scrubbing Locked • Plays: {Math.min(playCount, maxPlays)}/{maxPlays}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); } }} className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" />Restart</button>
                  {[0.75, 1, 1.25].map((r) => (
                    <button key={r} type="button" onClick={() => { setRate(r); if (audioRef.current) audioRef.current.playbackRate = r; }} className={`rounded-lg px-2 py-1 text-xs font-bold ${rate === r ? "bg-[#0F766E] text-white" : "border bg-white"}`}>{r}x</button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span suppressHydrationWarning className="text-xs font-semibold text-slate-600 tabular-nums">{formatTime(currentTime)}</span>
              <div onClick={(e) => { if (isExam || !audioRef.current || duration <= 0) return; const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; }} className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#0F766E]" style={{ width: `${pct}%` }} />
              </div>
              <span suppressHydrationWarning className="text-xs font-semibold text-slate-600 tabular-nums">{formatTime(duration)}</span>
            </div>
            {!resolvedAudio && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><Headphones className="h-3.5 w-3.5" /><span>Audio track unavailable for this item.</span></div>
            )}
          </>
        )}
        {!isExam && transcriptJa && (
          <details className="mt-3 rounded-lg border bg-white p-3 text-xs"><summary className="cursor-pointer font-bold text-[#0F766E]">聴解スクリプト (Transcript)</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{transcriptJa}</pre></details>
        )}
      </div>
    </div>
  );
}
