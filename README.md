# NihonSync JLPT Mock Test Platform

Web-based JLPT (N5-N1) mock exam simulator with automated sectional grading, anti-cheat RLS, locked-scrubbing listening audio, freemium gating, and 6-language answer reviews (EN, VI, ZH, KO, BN, HI).

## Phase 1: Database & Seeder Setup
1. Apply supabase/migrations/0001_initial_schema.sql and supabase/migrations/0002_storage_buckets.sql in Supabase SQL Editor.
2. Copy .env.example to .env.local and add your Supabase URL and Service Role Key.
3. Run:
   pip install -r scripts/requirements.txt
   python scripts/seed_jlpt.py --file data/sample_jlpt_questions.json --publish
