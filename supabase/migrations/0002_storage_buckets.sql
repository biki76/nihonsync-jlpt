-- ============================================================================
-- NihonSync JLPT Mock Test Platform — Storage Buckets & Media Policies
-- Migration: 0002_storage_buckets.sql
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jlpt-media',
  'jlpt-media',
  true,
  26214400,
  array['audio/mpeg', 'audio/mp3', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read access for jlpt-media" on storage.objects;
create policy "Public read access for jlpt-media"
  on storage.objects for select
  to public
  using (bucket_id = 'jlpt-media');

drop policy if exists "Service role manages jlpt-media" on storage.objects;
create policy "Service role manages jlpt-media"
  on storage.objects for all
  to service_role
  using (bucket_id = 'jlpt-media')
  with check (bucket_id = 'jlpt-media');
