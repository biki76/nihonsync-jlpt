-- ============================================================================
-- NihonSync JLPT Mock Test Platform — Security, Billing & Integrity Hardening
-- Migration: 0004_security_hardening.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Subscription Expiration & Payment Event Idempotency (NS-002)
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists pro_expires_at timestamptz,
  add column if not exists subscription_provider text,
  add column if not exists subscription_id text;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  provider text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  amount_cents int,
  currency text,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;

-- Helper function verifying active, non-expired Pro entitlement
create or replace function public.has_active_pro(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_pro = true
      and (p.pro_expires_at is null or p.pro_expires_at > now())
  );
$$;

revoke all on function public.has_active_pro(uuid) from public;
grant execute on function public.has_active_pro(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Explicit Section Max Score & Scoring Category (NS-007)
-- ----------------------------------------------------------------------------
alter table public.exam_sections
  add column if not exists max_score int check (max_score is null or max_score > 0),
  add column if not exists scoring_category text;

-- ----------------------------------------------------------------------------
-- 3. Prevent Duplicate In-Progress Attempts Per User & Exam (NS-011)
-- ----------------------------------------------------------------------------
create unique index if not exists idx_one_active_attempt_per_exam
  on public.user_attempts (user_id, exam_id)
  where status = 'in_progress';

-- ----------------------------------------------------------------------------
-- 4. Revoke Direct Client UPDATE on user_attempts (NS-001)
--    All attempt progression, timer anchors, and scores are written solely by
--    verified Server Actions using service_role.
-- ----------------------------------------------------------------------------
drop policy if exists "Users can update own active attempts" on public.user_attempts;
revoke update on public.user_attempts from authenticated;

-- ----------------------------------------------------------------------------
-- 5. Enforce Active Pro Expiration on Views & Policies (NS-002)
-- ----------------------------------------------------------------------------
create or replace view public.public_questions as
select
  q.id,
  q.mondai_group_id,
  q.question_number,
  q.prompt_html,
  q.options,
  q.points,
  q.audio_url,
  q.image_url
from public.questions q
join public.mondai_groups mg on mg.id = q.mondai_group_id
join public.exam_sections es on es.id = mg.section_id
join public.exams e on e.id = es.exam_id
where e.is_published = true
  and (
    e.is_premium = false
    or public.has_active_pro(auth.uid())
  );

grant select on public.public_questions to authenticated;

drop policy if exists "Authorized users can view mondai groups" on public.mondai_groups;
create policy "Authorized users can view mondai groups"
  on public.mondai_groups for select
  to authenticated
  using (
    exists (
      select 1
      from public.exam_sections es
      join public.exams e on e.id = es.exam_id
      where es.id = mondai_groups.section_id
        and e.is_published = true
        and (
          e.is_premium = false
          or public.has_active_pro(auth.uid())
        )
    )
  );

drop policy if exists "Users can create own attempts if authorized for exam" on public.user_attempts;
create policy "Users can create own attempts if authorized for exam"
  on public.user_attempts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.exams e
      where e.id = user_attempts.exam_id
        and e.is_published = true
        and (
          e.is_premium = false
          or public.has_active_pro(auth.uid())
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Enforce Server Timer Bounds on user_answers Mutations (NS-004)
-- ----------------------------------------------------------------------------
drop policy if exists "Users can insert answers for own in-progress attempts" on public.user_answers;
create policy "Users can insert answers for own in-progress attempts"
  on public.user_answers for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_attempts ua
      join public.exam_sections es
        on es.exam_id = ua.exam_id
       and es.section_number = ua.current_section
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
        and now() <= (
          ua.section_started_at
          + make_interval(mins => es.time_limit_minutes)
          + interval '5 seconds'
        )
    )
  );

drop policy if exists "Users can update answers for own in-progress attempts" on public.user_answers;
create policy "Users can update answers for own in-progress attempts"
  on public.user_answers for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_attempts ua
      join public.exam_sections es
        on es.exam_id = ua.exam_id
       and es.section_number = ua.current_section
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
        and now() <= (
          ua.section_started_at
          + make_interval(mins => es.time_limit_minutes)
          + interval '5 seconds'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_attempts ua
      join public.exam_sections es
        on es.exam_id = ua.exam_id
       and es.section_number = ua.current_section
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
        and now() <= (
          ua.section_started_at
          + make_interval(mins => es.time_limit_minutes)
          + interval '5 seconds'
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Allow Public Read on Published Exam Catalog Metadata Only (NS-014)
-- ----------------------------------------------------------------------------
drop policy if exists "Authenticated users can view published exams" on public.exams;
create policy "Anyone can view published exam metadata"
  on public.exams for select
  to anon, authenticated
  using (is_published = true);
