import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardControls } from "@/components/dashboard/DashboardControls";
import { MockTestCatalog } from "@/components/catalog/MockTestCatalog";
import { SEED_EXAMS } from "@/data/seedExams";
import type { Exam, SupportedLang, UserAttempt } from "@/types/jlpt";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: dbExams }, { data: dbAttempts }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_pro, preferred_lang")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("exams")
        .select("*")
        .eq("is_published", true)
        .order("level", { ascending: false })
        .order("test_number", { ascending: true }),
      supabase
        .from("user_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false }),
    ]);

  const examMap = new Map<string, Exam>();
  for (const seed of SEED_EXAMS) {
    examMap.set(seed.exam_code, seed);
  }
  if (dbExams && dbExams.length > 0) {
    for (const row of dbExams as Exam[]) {
      examMap.set(row.exam_code, row);
    }
  }
  const allExams = Array.from(examMap.values());

  const initialIsPro = Boolean(profile?.is_pro);
  const initialLang = (profile?.preferred_lang as SupportedLang) || "en";

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <header className="sticky top-0 z-30 border-b border-[#E6E2DA] bg-white/95 backdrop-blur dark:border-[#2E2E32] dark:bg-[#18181B]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-lg font-bold text-white shadow-xs">
              日
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">
                NihonSync
              </span>
              <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                {user.email}
              </p>
            </div>
          </div>
          <DashboardControls userId={user.id} initialLang={initialLang} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <MockTestCatalog
          exams={allExams}
          attempts={(dbAttempts as UserAttempt[]) ?? []}
          initialIsPro={initialIsPro}
          initialLang={initialLang}
          userEmail={user.email}
        />
      </main>
    </div>
  );
}
