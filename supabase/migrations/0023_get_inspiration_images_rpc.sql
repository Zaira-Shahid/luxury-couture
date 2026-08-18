-- Module 6 fix: 0022 shipped add/remove_inspiration_image RPCs but no way
-- to *list* a configuration's images without already being its owner —
-- caught while writing the actual page-load code, before it ever reached
-- a guest in practice. A guest reading via the plain table SELECT would
-- hit the same tightened RLS from 0022 that correctly excludes them.
create or replace function public.get_inspiration_images(p_config_id uuid, p_token uuid)
returns setof public.inspiration_images
language sql
security definer
set search_path = public
stable
as $$
  select ii.* from public.inspiration_images ii
  join public.builder_configurations bc on bc.id = ii.builder_configuration_id
  where ii.builder_configuration_id = p_config_id and bc.share_token = p_token;
$$;

grant execute on function public.get_inspiration_images(uuid, uuid) to anon, authenticated;
