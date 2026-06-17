-- Release a specific, still-active hold early (guest cancels or backs out of an
-- in-progress checkout). Frees only slots that this exact hold_key still holds,
-- so it can never free a slot that has since been booked or re-held by someone
-- else. Idempotent: returns 0 when nothing matches (e.g. the hold already lapsed).

create or replace function release_hold(
  p_slot_ids uuid[],
  p_hold_key text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if coalesce(array_length(p_slot_ids, 1), 0) = 0 then
    return 0;
  end if;

  with released as (
    update slots
    set status = 'free', hold_key = null, hold_expires_at = null
    where id = any(p_slot_ids)
      and hold_key = p_hold_key
      and status = 'held'
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;

revoke execute on function release_hold(uuid[], text) from public;
grant execute on function release_hold(uuid[], text) to service_role;
