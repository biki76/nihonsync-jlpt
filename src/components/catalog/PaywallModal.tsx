"use client";

import { Check, Crown, Sparkles, X } from "lucide-react";
import type { Exam } from "@/types/jlpt";

interface PaywallModalProps {
  exam: Exam | null;
  onClose: () => void;
  onUpgradeConfirm?: () => void;
  labels: {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    later: string;
  };
}

export function PaywallModal({
  exam,
  onClose,
  onUpgradeConfirm,
  labels,
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
      <div className="relative w-full max-w-md rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-2xl dark:border-[#2E2E32] dark:bg-[#18181B]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#52525B] transition hover:bg-[#F3F1ED] hover:text-[#18181B] dark:text-[#A1A1AA] dark:hover:bg-[#27272A] dark:hover:text-[#F4F4F5]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E04F33]/30 bg-[#FDF2EF] px-3 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
          <Crown className="h-3.5 w-3.5" />
          <span>{labels.badge}</span>
        </div>

        <h3
          id="paywall-modal-title"
          className="mt-4 text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]"
        >
          {labels.title}
        </h3>

        <p className="mt-1.5 text-sm leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
          <span className="font-semibold text-[#E04F33]">{exam.exam_code}</span>{" "}
          — {labels.subtitle}
        </p>

        <ul className="mt-5 space-y-2.5">
          {benefits.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-[#18181B] dark:text-[#F4F4F5]"
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
              if (onUpgradeConfirm) onUpgradeConfirm();
              onClose();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#C83E24]"
          >
            <Sparkles className="h-4 w-4" />
            <span>{labels.cta}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl border border-[#E6E2DA] bg-transparent px-4 py-2 text-sm font-semibold text-[#52525B] transition hover:bg-[#F3F1ED] hover:text-[#18181B] dark:border-[#2E2E32] dark:text-[#A1A1AA] dark:hover:bg-[#27272A]"
          >
            {labels.later}
          </button>
        </div>
      </div>
    </div>
  );
}
