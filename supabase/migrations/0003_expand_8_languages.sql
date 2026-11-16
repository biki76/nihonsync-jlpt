-- ============================================================================
-- NihonSync — Expand profiles.preferred_lang to all 8 supported languages
-- Languages: en, bn, hi, id, th, vi, zh, ko
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_lang_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_lang_check
  CHECK (preferred_lang IN ('en', 'bn', 'hi', 'id', 'th', 'vi', 'zh', 'ko'));
