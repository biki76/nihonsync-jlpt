-- ============================================================================
-- NihonSync JLPT Mock Test Platform — Initial Schema, Views & RLS
-- Migration: 0001_initial_schema.sql
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. User Profiles & Language/Pro Settings
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  preferred_lang text not null default 'en'
    check (preferred_lang in ('en', 'vi', 'zh', 'ko', 'bn', 'hi')),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_pro, preferred_lang)
  values (new.id, false, 'en')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Exams Metadata
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  exam_code text unique not null,
  level text not null check (level in ('N5', 'N4', 'N3', 'N2', 'N1')),
  test_number int not null check (test_number >= 1),
  title text not null,
  is_premium boolean not null default false,
  total_time_minutes int not null check (total_time_minutes > 0),
  total_score_required int not null check (total_score_required >= 0),
  max_total_score int not null default 180 check (max_total_score > 0),
  sectional_minimums jsonb not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(level, test_number)
);

create index if not exists idx_exams_level_published
  on public.exams (level, is_published, test_number);

-- 3. Exam Sections (VOCAB, GRAMMAR_READING, LISTENING)
create table if not exists public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  section_number int not null check (section_number >= 1),
  section_code text not null,
  section_title_ja text not null,
  section_title_en text not null,
  time_limit_minutes int not null check (time_limit_minutes > 0),
  unique(exam_id, section_number)
);

create index if not exists idx_exam_sections_exam_id
  on public.exam_sections (exam_id, section_number);

-- 4. Mondai Groups (Sub-sections & Shared Reading Passages)
create table if not exists public.mondai_groups (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.exam_sections(id) on delete cascade,
  mondai_number int not null check (mondai_number >= 1),
  question_type text not null,
  instruction_ja text not null,
  passage_html text,
  unique(section_id, mondai_number)
);

create index if not exists idx_mondai_groups_section_id
  on public.mondai_groups (section_id, mondai_number);

-- 5. Questions (Multilingual JSONB Explanations & Media Paths)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  mondai_group_id uuid not null references public.mondai_groups(id) on delete cascade,
  question_number int not null check (question_number >= 1),
  prompt_html text not null,
  options jsonb not null
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 3 and 4),
  correct_option int not null check (correct_option between 1 and 4),
  correct_sequence jsonb,
  points int not null default 1 check (points >= 0),
  audio_url text,
  image_url text,
  transcript_ja text,
  explanation jsonb not null default '{}'::jsonb,
  unique(mondai_group_id, question_number)
);

create index if not exists idx_questions_mondai_group_id
  on public.questions (mondai_group_id, question_number);

-- 6. User Attempts (Tracks Server Timer Integrity via section_started_at)
create table if not exists public.user_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  current_section int not null default 1 check (current_section >= 1),
  started_at timestamptz not null default now(),
  section_started_at timestamptz not null default now(),
  completed_at timestamptz,
  section_scores jsonb,
  total_score int,
  passed boolean
);

create index if not exists idx_user_attempts_user_exam
  on public.user_attempts (user_id, exam_id, started_at desc);

create index if not exists idx_user_attempts_status
  on public.user_attempts (user_id, status);

-- 7. User Answers
create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.user_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option int check (selected_option is null or selected_option between 1 and 4),
  is_flagged boolean not null default false,
  is_correct boolean,
  updated_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create index if not exists idx_user_answers_attempt_id
  on public.user_answers (attempt_id);

-- 8. Anti-Cheat Safe View & Post-Completion Review RPC
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
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_pro = true
    )
  );

grant select on public.public_questions to authenticated;

create or replace function public.get_attempt_review_questions(p_attempt_id uuid)
returns table (
  question_id uuid,
  mondai_group_id uuid,
  question_number int,
  prompt_html text,
  options jsonb,
  correct_option int,
  correct_sequence jsonb,
  points int,
  audio_url text,
  image_url text,
  transcript_ja text,
  explanation jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
begin
  select ua.exam_id
  into v_exam_id
  from public.user_attempts ua
  where ua.id = p_attempt_id
    and ua.user_id = auth.uid()
    and ua.status = 'completed';

  if v_exam_id is null then
    raise exception 'Review unavailable: attempt does not exist, belongs to another user, or is not completed.';
  end if;

  return query
  select
    q.id as question_id,
    q.mondai_group_id,
    q.question_number,
    q.prompt_html,
    q.options,
    q.correct_option,
    q.correct_sequence,
    q.points,
    q.audio_url,
    q.image_url,
    q.transcript_ja,
    q.explanation
  from public.questions q
  join public.mondai_groups mg on mg.id = q.mondai_group_id
  join public.exam_sections es on es.id = mg.section_id
  where es.exam_id = v_exam_id
  order by es.section_number asc, mg.mondai_number asc, q.question_number asc;
end;
$$;

revoke all on function public.get_attempt_review_questions(uuid) from public;
grant execute on function public.get_attempt_review_questions(uuid) to authenticated;

-- 9. Row Level Security (RLS) Policies
alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.exam_sections enable row level security;
alter table public.mondai_groups enable row level security;
alter table public.questions enable row level security;
alter table public.user_attempts enable row level security;
alter table public.user_answers enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Authenticated users can view published exams" on public.exams;
create policy "Authenticated users can view published exams"
  on public.exams for select
  to authenticated
  using (is_published = true);

drop policy if exists "Authenticated users can view published exam sections" on public.exam_sections;
create policy "Authenticated users can view published exam sections"
  on public.exam_sections for select
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_sections.exam_id
        and e.is_published = true
    )
  );

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
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.is_pro = true
          )
        )
    )
  );

drop policy if exists "Deny direct question table select for clients" on public.questions;
create policy "Deny direct question table select for clients"
  on public.questions for select
  to authenticated
  using (false);

drop policy if exists "Users can view own attempts" on public.user_attempts;
create policy "Users can view own attempts"
  on public.user_attempts for select
  to authenticated
  using (auth.uid() = user_id);

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
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.is_pro = true
          )
        )
    )
  );

drop policy if exists "Users can update own active attempts" on public.user_attempts;
create policy "Users can update own active attempts"
  on public.user_attempts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own answers" on public.user_answers;
create policy "Users can view own answers"
  on public.user_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.user_attempts ua
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert answers for own in-progress attempts" on public.user_answers;
create policy "Users can insert answers for own in-progress attempts"
  on public.user_answers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_attempts ua
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
    )
  );

drop policy if exists "Users can update answers for own in-progress attempts" on public.user_answers;
create policy "Users can update answers for own in-progress attempts"
  on public.user_answers for update
  to authenticated
  using (
    exists (
      select 1 from public.user_attempts ua
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.user_attempts ua
      where ua.id = user_answers.attempt_id
        and ua.user_id = auth.uid()
        and ua.status = 'in_progress'
    )
  );
