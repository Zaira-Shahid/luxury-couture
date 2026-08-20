-- Module 8: Supabase Storage buckets.
--
-- Both buckets are public: true (read access needs no auth — same
-- "obscure but not encrypted" threat model already accepted for builder
-- sharing, where a configuration's id is visible in the URL and only its
-- share_token is the real secret; a Storage object's random filename
-- plays the same role here). Neither bucket gets any client-writable
-- storage.objects RLS policy — all uploads/deletes go through server-side
-- Server Actions using the service-role client, which re-run the same
-- authorization checks already built (token match for guests via the
-- builder RPCs, is_admin() for the media library) before ever touching
-- Storage. storage.objects RLS can't express "prove you know this token"
-- the way the SECURITY DEFINER functions in 0022 can, so this is the
-- correct way to enforce it here.
--
-- file_size_limit/allowed_mime_types are enforced by Supabase Storage
-- itself, server-side, on every upload — a real floor under whatever the
-- application code also checks, not just a client-side nicety.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inspiration-images', 'inspiration-images', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('media', 'media', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
