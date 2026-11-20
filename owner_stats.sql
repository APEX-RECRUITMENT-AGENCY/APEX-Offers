-- Owner dashboard numbers. Run once in Supabase > SQL Editor.
-- Only an active owner or admin can call it. Everyone else gets "not allowed".
create or replace function public.owner_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me_role text;
  n int := least(greatest(coalesce(p_days, 30), 1), 365);
  since timestamptz;
  res jsonb;
begin
  select role into me_role from public.profiles where id = auth.uid() and active;
  if me_role is null or me_role not in ('owner', 'admin') then
    raise exception 'not allowed';
  end if;
  since := (date_trunc('day', now() at time zone 'Africa/Cairo') - make_interval(days => n - 1)) at time zone 'Africa/Cairo';

  select jsonb_build_object(
    'generated_at', now(),
    'days', n,
    'totals', (
      select jsonb_build_object(
        'all_time', count(*),
        'in_range', count(*) filter (where created_at >= since),
        'today', count(*) filter (where (created_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date),
        'hired_in_range', count(*) filter (where status = 'hired' and created_at >= since),
        'interview_in_range', count(*) filter (where status in ('interview','accepted','validated','hired') and created_at >= since)
      ) from public.applications
    ),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'n', c) order by c desc)
      from (select status, count(*) c from public.applications where created_at >= since group by status) s
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'n', coalesce(c, 0)) order by d)
      from generate_series((now() at time zone 'Africa/Cairo')::date - (n - 1), (now() at time zone 'Africa/Cairo')::date, interval '1 day') d
      left join (
        select (created_at at time zone 'Africa/Cairo')::date as dd, count(*) c
        from public.applications where created_at >= since group by 1
      ) a on a.dd = d::date
    ), '[]'::jsonb),
    'by_recruiter', coalesce((
      select jsonb_agg(row_to_json(r) order by r.applicants desc)
      from (
        select coalesce(p.full_name, '(no recruiter)') as name,
               coalesce(p.role, '') as role,
               count(*) as applicants,
               count(*) filter (where a.status in ('interview','accepted','validated','hired')) as interviews,
               count(*) filter (where a.status = 'hired') as hired
        from public.applications a
        left join public.profiles p on p.id = a.recruiter_id
        where a.created_at >= since
        group by p.id, p.full_name, p.role
        order by count(*) desc
        limit 25
      ) r
    ), '[]'::jsonb),
    'by_offer', coalesce((
      select jsonb_agg(row_to_json(o) order by o.n desc)
      from (
        select coalesce(job_company, '') as company, coalesce(job_title, '') as title, count(*) as n
        from public.applications where created_at >= since
        group by job_company, job_title order by count(*) desc limit 12
      ) o
    ), '[]'::jsonb),
    'voice', (
      select jsonb_build_object(
        'with_ai', count(*) filter (where ai_status = 'done'),
        'ai_errors', count(*) filter (where ai_status = 'error'),
        'avg_ai_score', round(avg(ai_score) filter (where ai_status = 'done'))::int,
        'pending_review', count(*) filter (where voice_status = 'pending')
      ) from public.applications where created_at >= since
    )
  ) into res;
  return res;
end
$$;

revoke all on function public.owner_stats(integer) from public, anon;
grant execute on function public.owner_stats(integer) to authenticated;
