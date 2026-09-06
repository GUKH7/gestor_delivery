-- Final, lock-safe reconciliation for automatic free-product rewards.
-- A product may back a free-product prize/reward only while active and while it requires no mandatory add-on choice.

begin;

lock table public.products,
  public.promotion_prizes,
  public.customer_rewards,
  public.promotion_campaigns
in share row exclusive mode;

create or replace function public.guard_free_product_reward_configuration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_addons jsonb;
  v_requires_options boolean := false;
begin
  if coalesce(new.active, true) and new.prize_type = 'free_product' then
    if new.product_id is null then
      raise exception using errcode = '23514', message = 'Free product prize must reference an active restaurant product';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('promotion-free-product:' || new.product_id::text, 0)
    );

    select p.addons
      into v_addons
      from public.products p
     where p.id = new.product_id
       and p.restaurant_id = new.restaurant_id
       and p.is_active = true;

    if not found then
      raise exception using errcode = '23514', message = 'Free product prize must reference an active restaurant product';
    end if;

    v_requires_options := exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_addons) = 'array' then v_addons
          else '[]'::jsonb
        end
      ) addon_group
      where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
         or (
           btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
           and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
           and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
         )
    );

    if v_requires_options then
      raise exception using errcode = '23514', message = 'Free product prize cannot reference a product with required add-ons';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_free_product_reward_configuration() from public, anon, authenticated;

create or replace function public.guard_available_free_product_reward_configuration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_addons jsonb;
  v_requires_options boolean := false;
begin
  if new.status = 'available' and new.reward_type = 'free_product' then
    if new.product_id is null then
      raise exception using errcode = '23514', message = 'Available free product reward must reference a product';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('promotion-free-product:' || new.product_id::text, 0)
    );

    select p.addons
      into v_addons
      from public.products p
     where p.id = new.product_id
       and p.restaurant_id = new.restaurant_id
       and p.is_active = true;

    if not found then
      raise exception using errcode = '23514', message = 'Available free product reward must reference an active restaurant product';
    end if;

    v_requires_options := exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_addons) = 'array' then v_addons
          else '[]'::jsonb
        end
      ) addon_group
      where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
         or (
           btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
           and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
           and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
         )
    );

    if v_requires_options then
      raise exception using errcode = '23514', message = 'Available free product reward cannot reference a product with required add-ons';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_available_free_product_reward_configuration() from public, anon, authenticated;

create or replace function public.guard_product_required_addons_for_active_rewards()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requires_options boolean := false;
  v_has_dependency boolean := false;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('promotion-free-product:' || new.id::text, 0)
  );

  v_requires_options := exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(new.addons) = 'array' then new.addons
        else '[]'::jsonb
      end
    ) addon_group
    where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
       or (
         btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
         and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
         and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
       )
  );

  if coalesce(new.is_active, false) = false or v_requires_options then
    v_has_dependency := exists (
      select 1
      from public.promotion_prizes pp
      where pp.restaurant_id = new.restaurant_id
        and pp.product_id = new.id
        and pp.prize_type = 'free_product'
        and pp.active = true
    ) or exists (
      select 1
      from public.customer_rewards cr
      where cr.restaurant_id = new.restaurant_id
        and cr.product_id = new.id
        and cr.reward_type = 'free_product'
        and cr.status = 'available'
        and (cr.expires_at is null or cr.expires_at > now())
    );

    if v_has_dependency then
      if coalesce(new.is_active, false) = false then
        raise exception using errcode = '23514', message = 'Product cannot be deactivated while used by an active or issued free-product reward';
      end if;

      raise exception using errcode = '23514', message = 'Product cannot require add-ons while used by an active or issued free-product reward';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_product_required_addons_for_active_rewards() from public, anon, authenticated;

drop trigger if exists promotion_prizes_guard_free_product_required_addons on public.promotion_prizes;
create trigger promotion_prizes_guard_free_product_required_addons
before insert or update of prize_type, product_id, active, restaurant_id
on public.promotion_prizes
for each row
execute function public.guard_free_product_reward_configuration();

drop trigger if exists customer_rewards_guard_free_product_required_addons on public.customer_rewards;
create trigger customer_rewards_guard_free_product_required_addons
before insert or update of reward_type, product_id, status, expires_at, restaurant_id
on public.customer_rewards
for each row
execute function public.guard_available_free_product_reward_configuration();

drop trigger if exists products_guard_required_addons_for_active_rewards on public.products;
create trigger products_guard_required_addons_for_active_rewards
before update of addons, is_active
on public.products
for each row
execute function public.guard_product_required_addons_for_active_rewards();

with product_state as (
  select
    p.id,
    p.restaurant_id,
    p.is_active,
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(p.addons) = 'array' then p.addons
          else '[]'::jsonb
        end
      ) addon_group
      where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
         or (
           btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
           and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
           and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
         )
    ) as requires_options
  from public.products p
)
update public.customer_rewards cr
set status = 'cancelled',
    updated_at = now()
from product_state ps
where cr.product_id = ps.id
  and cr.restaurant_id = ps.restaurant_id
  and cr.reward_type = 'free_product'
  and cr.status = 'available'
  and (cr.expires_at is null or cr.expires_at > now())
  and (ps.is_active = false or ps.requires_options);

with product_state as (
  select
    p.id,
    p.restaurant_id,
    p.is_active,
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(p.addons) = 'array' then p.addons
          else '[]'::jsonb
        end
      ) addon_group
      where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
         or (
           btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
           and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
           and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
         )
    ) as requires_options
  from public.products p
), incompatible as (
  select pp.id as prize_id, pp.campaign_id
  from public.promotion_prizes pp
  join product_state ps
    on ps.id = pp.product_id
   and ps.restaurant_id = pp.restaurant_id
  where pp.active = true
    and pp.prize_type = 'free_product'
    and (ps.is_active = false or ps.requires_options)
), paused as (
  update public.promotion_campaigns pc
  set status = 'paused',
      updated_at = now()
  where pc.id in (select distinct campaign_id from incompatible)
    and pc.status in ('active', 'scheduled')
  returning pc.id
)
update public.promotion_prizes pp
set active = false,
    updated_at = now()
where pp.id in (select prize_id from incompatible);

commit;
