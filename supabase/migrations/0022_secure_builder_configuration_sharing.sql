-- Module 6: close the guest-scan leak on builder_configurations and
-- inspiration_images, and add the token-gated RPCs that make guest
-- save/continue/share/claim actually work.
--
-- 0003_builder.sql (Module 1) shipped with its own inline warning:
-- "Guest (customer_id null) configurations are addressable only by their
-- share_token in practice — discoverable via row scan here, but Module 6
-- will tighten guest ownership with a session cookie/claim flow before
-- shipping the public builder." Confirmed live before this fix: a guest
-- builder draft (including its own share_token) created from one
-- anonymous session was fully readable from a completely unrelated
-- anonymous session via a plain `select *`. inspiration_images had the
-- identical pattern in its SELECT policy.
--
-- Postgres RLS can restrict *which rows a role may see*, but it can't
-- verify *that the caller supplied the correct secret token* — a policy
-- permitting "guest rows" can't distinguish someone who knows the token
-- from a blind scan. The fix: lock RLS down to owner-or-admin only, and
-- add SECURITY DEFINER functions that require the exact id *and*
-- share_token together for any guest/shared-link access. Every function
-- here recomputes estimated_price itself from current price_adjustment
-- values — a client-submitted price is never trusted or accepted as input.

-- ---- Close the leaks --------------------------------------------------

drop policy "Builder configurations are viewable by owner, guest, or admin"
  on public.builder_configurations;

create policy "Builder configurations are viewable by owner or admin"
  on public.builder_configurations for select
  using (customer_id = auth.uid() or public.is_admin());

drop policy "Inspiration images follow their configuration's visibility"
  on public.inspiration_images;

create policy "Inspiration images follow their configuration's visibility"
  on public.inspiration_images for select
  using (
    exists (
      select 1 from public.builder_configurations bc
      where bc.id = builder_configuration_id
        and (bc.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ---- Shared price calculation ------------------------------------------

create or replace function public.compute_builder_estimated_price(
  p_product_id uuid,
  p_fabric_id uuid,
  p_embroidery_type_id uuid,
  p_colour_id uuid,
  p_sleeve_style_id uuid,
  p_neckline_id uuid,
  p_dupatta_option_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  total numeric := 0;
begin
  if p_product_id is not null then
    select coalesce(base_price, 0) into total from public.products where id = p_product_id;
    total := coalesce(total, 0);
  end if;

  total := total
    + coalesce((select price_adjustment from public.fabrics where id = p_fabric_id), 0)
    + coalesce((select price_adjustment from public.embroidery_types where id = p_embroidery_type_id), 0)
    + coalesce((select price_adjustment from public.colours where id = p_colour_id), 0)
    + coalesce((select price_adjustment from public.sleeve_styles where id = p_sleeve_style_id), 0)
    + coalesce((select price_adjustment from public.necklines where id = p_neckline_id), 0)
    + coalesce((select price_adjustment from public.dupatta_options where id = p_dupatta_option_id), 0);

  return total;
end;
$$;

-- ---- Builder configuration RPCs (token-gated for guests) --------------

create or replace function public.create_builder_configuration(
  p_product_id uuid default null,
  p_fabric_id uuid default null,
  p_embroidery_type_id uuid default null,
  p_colour_id uuid default null,
  p_sleeve_style_id uuid default null,
  p_neckline_id uuid default null,
  p_dupatta_option_id uuid default null,
  p_custom_notes text default null
)
returns public.builder_configurations
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.builder_configurations;
begin
  insert into public.builder_configurations (
    customer_id, product_id, fabric_id, embroidery_type_id, colour_id,
    sleeve_style_id, neckline_id, dupatta_option_id, custom_notes, estimated_price
  ) values (
    auth.uid(), p_product_id, p_fabric_id, p_embroidery_type_id, p_colour_id,
    p_sleeve_style_id, p_neckline_id, p_dupatta_option_id, p_custom_notes,
    public.compute_builder_estimated_price(
      p_product_id, p_fabric_id, p_embroidery_type_id, p_colour_id,
      p_sleeve_style_id, p_neckline_id, p_dupatta_option_id
    )
  )
  returning * into result;

  return result;
end;
$$;

-- Zero or one row, depending on whether id+token match — the only way
-- anyone (guest or a different signed-in account viewing a shared link)
-- reads a specific configuration without being its owner.
create or replace function public.get_builder_configuration(p_id uuid, p_token uuid)
returns setof public.builder_configurations
language sql
security definer
set search_path = public
stable
as $$
  select * from public.builder_configurations
  where id = p_id and share_token = p_token;
$$;

create or replace function public.update_builder_configuration(
  p_id uuid,
  p_token uuid,
  p_product_id uuid default null,
  p_fabric_id uuid default null,
  p_embroidery_type_id uuid default null,
  p_colour_id uuid default null,
  p_sleeve_style_id uuid default null,
  p_neckline_id uuid default null,
  p_dupatta_option_id uuid default null,
  p_custom_notes text default null,
  p_status text default null
)
returns public.builder_configurations
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.builder_configurations;
begin
  update public.builder_configurations
  set
    product_id = p_product_id,
    fabric_id = p_fabric_id,
    embroidery_type_id = p_embroidery_type_id,
    colour_id = p_colour_id,
    sleeve_style_id = p_sleeve_style_id,
    neckline_id = p_neckline_id,
    dupatta_option_id = p_dupatta_option_id,
    custom_notes = p_custom_notes,
    estimated_price = public.compute_builder_estimated_price(
      p_product_id, p_fabric_id, p_embroidery_type_id, p_colour_id,
      p_sleeve_style_id, p_neckline_id, p_dupatta_option_id
    ),
    status = coalesce(p_status, status)
  where id = p_id and share_token = p_token
  returning * into result;

  if result.id is null then
    raise exception 'Configuration not found or link is invalid.';
  end if;

  return result;
end;
$$;

-- Requires being signed in; only claims a still-unclaimed (customer_id
-- null) row, so a link to an already-claimed design can't be hijacked.
create or replace function public.claim_builder_configuration(p_id uuid, p_token uuid)
returns public.builder_configurations
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.builder_configurations;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save this design to your account.';
  end if;

  update public.builder_configurations
  set customer_id = auth.uid()
  where id = p_id and share_token = p_token and customer_id is null
  returning * into result;

  if result.id is null then
    raise exception 'This design could not be claimed — the link may be invalid or already belong to an account.';
  end if;

  return result;
end;
$$;

-- ---- Inspiration images (URL-paste only — Storage is Module 8) --------

create or replace function public.add_inspiration_image(p_config_id uuid, p_token uuid, p_url text)
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

  -- storage_path is not-null per the Module 1 schema, but there's no real
  -- Storage upload yet (Module 8) — the pasted URL stands in for both
  -- columns, same URL-paste precedent as product/collection images.
  insert into public.inspiration_images (builder_configuration_id, uploaded_by, storage_path, url)
  values (p_config_id, auth.uid(), p_url, p_url)
  returning * into result;

  return result;
end;
$$;

create or replace function public.remove_inspiration_image(p_image_id uuid, p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.inspiration_images ii
  using public.builder_configurations bc
  where ii.id = p_image_id
    and ii.builder_configuration_id = bc.id
    and bc.share_token = p_token;

  if not found then
    raise exception 'Image not found or link is invalid.';
  end if;
end;
$$;

-- ---- Explicit grants ----------------------------------------------------
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so these
-- are likely redundant — but explicit beats assumed, given the base-table
-- grants gap found in Module 1 (0014/0015).
grant execute on function public.compute_builder_estimated_price(uuid, uuid, uuid, uuid, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.create_builder_configuration(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_builder_configuration(uuid, uuid) to anon, authenticated;
grant execute on function public.update_builder_configuration(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.claim_builder_configuration(uuid, uuid) to anon, authenticated;
grant execute on function public.add_inspiration_image(uuid, uuid, text) to anon, authenticated;
grant execute on function public.remove_inspiration_image(uuid, uuid) to anon, authenticated;
