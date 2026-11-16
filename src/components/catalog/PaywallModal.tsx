"use client";

import { Check, Crown, Sparkles, X } from "lucide-react";
import type { Exam } from "@/types/jlpt";

interface PaywallModalProps {
  exam: Exam | null;
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  laterLabel: string;
  onClose: () => void;
  onUnlockDemo?: () => void;
}

export function PaywallModal({
  exam,
  badge,
  title,
  subtitle,
  ctaLabel,
  laterLabel,
  onClose,
  onUnlockDemo,
}: PaywallModalProps) {
  if (!exam) return null;

  const benefits = [
    "Unlock Mock Tests 3–20 across all 5 levels (90+ full exams)",
    "Sectional JLPT scoring analytics & weak-point tracking",
    "Full Listening transcripts & 8-language answer explanations",
    "Unlimited exam retakes & offline-ready progress sync",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
    >
      <div className="relative w-full max-w-md rounded-[16px] border border-[#E5E2DC] bg-white p-6 shadow-2xl dark:border-[#27272A] dark:bg-[#18181B]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F3F2EE] hover:text-[#0F172A] dark:text-[#A1A1AA] dark:hover:bg-[#222226] dark:hover:text-[#F4F4F5]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E04F33]/30 bg-[#FDF2EF] px-3 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
          <Crown className="h-3.5 w-3.5" />
          <span>{badge}</span>
        </div>

        <h3
          id="paywall-modal-title"
          className="mt-4 text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F4F4F5]"
        >
          {title}
        </h3>

        <p className="mt-1.5 text-sm leading-relaxed text-[#475569] dark:text-[#A1A1AA]">
          <span className="font-semibold text-[#E04F33]">{exam.exam_code}</span>{" "}
          — {subtitle}
        </p>

        <ul className="mt-5 space-y-2.5">
          {benefits.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-[#0F172A] dark:text-[#F4F4F5]"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E04F33] text-white">
                <Check className="h-3 w-3 stroke-[2.5]" />
              </span>
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (onUnlockDemo) onUnlockDemo();
              onClose();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#C83E23]"
          >
            <Sparkles className="h-4 w-4" />
            <span>{ctaLabel}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl border border-[#E5E2DC] bg-transparent px-4 py-2 text-sm font-semibold text-[#475569] transition hover:bg-[#F3F2EE] hover:text-[#0F172A] dark:border-[#27272A] dark:text-[#A1A1AA] dark:hover:bg-[#222226]"
          >
            {laterLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
