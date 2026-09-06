-- Close upgrade and reactivation gaps for free-product rewards.
-- Existing incompatible usable rewards are cancelled before the trigger is broadened.

update public.customer_rewards cr
set status = 'cancelled',
    updated_at = now()
from public.products p
where cr.product_id = p.id
  and cr.restaurant_id = p.restaurant_id
  and cr.reward_type = 'free_product'
  and cr.status = 'available'
  and (cr.expires_at is null or cr.expires_at > now())
  and coalesce(jsonb_typeof(p.addons), 'null') = 'array'
  and exists (
    select 1
      from jsonb_array_elements(coalesce(p.addons, '[]'::jsonb)) addon_group
     where lower(coalesce(addon_group ->> 'required', 'false')) = 'true'
        or (
          btrim(coalesce(addon_group ->> 'min_options', '')) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
          and btrim(coalesce(addon_group ->> 'min_options', '')) !~ '^-'
          and split_part(lower(btrim(coalesce(addon_group ->> 'min_options', ''))), 'e', 1) ~ '[1-9]'
        )
  );

drop trigger if exists customer_rewards_guard_free_product_required_addons on public.customer_rewards;
create trigger customer_rewards_guard_free_product_required_addons
before insert or update of reward_type, product_id, status, expires_at, restaurant_id
on public.customer_rewards
for each row
execute function public.guard_available_free_product_reward_configuration();
