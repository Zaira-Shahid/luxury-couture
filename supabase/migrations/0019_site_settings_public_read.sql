-- Module 3: public read access for site_settings.
--
-- site_settings' only policy (0012, Module 1) was `for all using
-- (is_admin())` — meaning anonymous storefront visitors couldn't read it
-- at all. That breaks Module 3 at the root: branding/theme/announcement
-- bar/footer/SEO defaults need to render for every visitor, not just
-- admins. RLS policies for the same command are OR'd together, so adding
-- a public SELECT policy here coexists safely with the existing
-- admin-only policy, which still governs insert/update/delete.
create policy "Site settings are publicly readable"
  on public.site_settings for select
  using (true);
