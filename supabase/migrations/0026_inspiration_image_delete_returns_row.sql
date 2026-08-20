-- Module 8: remove_inspiration_image (0022) returned void, which was fine
-- when images were just pasted URLs with nothing to clean up elsewhere.
-- Now that images are real Storage objects, the Server Action needs the
-- deleted row's storage_path to also remove the underlying file — return
-- the row instead of void so it doesn't need a separate lookup query.
drop function public.remove_inspiration_image(uuid, uuid);

create function public.remove_inspiration_image(p_image_id uuid, p_token uuid)
returns public.inspiration_images
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.inspiration_images;
begin
  delete from public.inspiration_images ii
  using public.builder_configurations bc
  where ii.id = p_image_id
    and ii.builder_configuration_id = bc.id
    and bc.share_token = p_token
  returning ii.* into result;

  if result.id is null then
    raise exception 'Image not found or link is invalid.';
  end if;

  return result;
end;
$$;

grant execute on function public.remove_inspiration_image(uuid, uuid) to anon, authenticated;
