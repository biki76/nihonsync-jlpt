import { createClient } from "@/utils/supabase/server";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { LandingContent } from "@/components/landing/LandingContent";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#0F172A] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <GlobalHeader userEmail={user?.email ?? null} userId={user?.id ?? null} />
      <LandingContent isLoggedIn={Boolean(user)} />
    </div>
  );
}
