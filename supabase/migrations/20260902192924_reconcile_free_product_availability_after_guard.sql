-- Reconcile free-product prizes and issued rewards after the availability-aware guard is installed.
-- This migration is intentionally idempotent. Production already received this migration version;
-- keeping it in the repository prevents migration drift and makes fresh environments reproducible.

begin;

lock table public.products,
  public.promotion_prizes,
  public.customer_rewards,
  public.promotion_campaigns
in share row exclusive mode;

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
         or case
              when coalesce(addon_group ->> 'min_options', '') ~ '^\d+$'
                then (addon_group ->> 'min_options')::integer
              else 0
            end > 0
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
         or case
              when coalesce(addon_group ->> 'min_options', '') ~ '^\d+$'
                then (addon_group ->> 'min_options')::integer
              else 0
            end > 0
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
