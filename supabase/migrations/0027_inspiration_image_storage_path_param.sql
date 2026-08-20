-- Module 8: add_inspiration_image (0022) only took a URL and stored it as
-- both storage_path and url — the placeholder pattern from when images
-- were pasted external links with no real Storage object behind them.
-- Now that uploads produce a real object path, accept it directly instead
-- of inserting a placeholder and immediately overwriting it in a second
-- round-trip from the Server Action.
drop function public.add_inspiration_image(uuid, uuid, text);

create function public.add_inspiration_image(p_config_id uuid, p_token uuid, p_url text, p_storage_path text)
returns public.inspiration_images
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.inspiration_images;
begin
  if not exists (
    select 1 from public.builder_configurations
    where id = p_config_id and share_token = p_token
  ) then
    raise exception 'Configuration not found or link is invalid.';
  end if;

  insert into public.inspiration_images (builder_configuration_id, uploaded_by, storage_path, url)
  values (p_config_id, auth.uid(), p_storage_path, p_url)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.add_inspiration_image(uuid, uuid, text, text) to anon, authenticated;
