-- Module 18 fix: "review moderation required" isn't actually enforced by
-- reviews' own UPDATE policy (0009) — "Reviews are updatable by their
-- author or admin" lets the author update ANY column on their own row,
-- including is_published/is_featured/admin_response. Nothing stops a
-- customer from calling supabase.from("reviews").update({is_published:
-- true}) on their own review directly with their own session, bypassing
-- moderation entirely — this app's own Server Actions never do that, but
-- RLS is the real boundary, not which buttons the UI happens to show.
--
-- Same fix shape as 0017/0018 (profiles.role self-promotion): a
-- column-level REVOKE can't carve an exception out of the blanket
-- table-level UPDATE grant, so this needs a trigger. SECURITY INVOKER,
-- not DEFINER — 0018 found the hard way that SECURITY DEFINER makes
-- current_user resolve to the function owner ('postgres') for every
-- caller, silently defeating the current_user check below.
create or replace function public.prevent_review_self_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    new.is_published is distinct from old.is_published
    or new.is_featured is distinct from old.is_featured
    or new.admin_response is distinct from old.admin_response
  )
  and not public.is_admin()
  and current_user not in ('service_role', 'postgres') then
    raise exception 'permission denied: only admin can moderate a review';
  end if;
  return new;
end;
$$;

create trigger reviews_prevent_self_moderation
  before update on public.reviews
  for each row execute function public.prevent_review_self_moderation();
