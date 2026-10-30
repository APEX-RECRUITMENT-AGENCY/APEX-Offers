-- JOIN 1: "Join our team" applications (Recruiter / Team Leader / Unit Manager). Safe to re-run.
create extension if not exists pg_net with schema extensions;

create table if not exists public.team_applications(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role_wanted text not null check (role_wanted in ('recruiter','team_leader','unit_manager')),
  full_name text not null, phone text not null, email text, city text, age int,
  years_exp text, prev_exp text, current_work text, availability text, why text,
  recruiters_count int, leaders_count int,        -- unit manager: how many team leaders + recruiters he can bring
  team_size_note text, status text not null default 'new' check (status in ('new','contacted','accepted','rejected')),
  notes text);
alter table public.team_applications enable row level security;   -- no policies: only the functions below can touch it
create index if not exists team_apps_created on public.team_applications(created_at desc);

create or replace function public.submit_team_application(
  p_role text, p_name text, p_phone text, p_email text, p_city text, p_age int,
  p_years text, p_prev text, p_current text, p_avail text, p_why text,
  p_recruiters int default null, p_leaders int default null, p_team_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $fn$
declare rid uuid; dg text;
begin
  if p_role not in ('recruiter','team_leader','unit_manager') then raise exception 'invalid role'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'invalid name'; end if;
  dg := regexp_replace(coalesce(p_phone,''),'\D','','g');
  if length(dg)<8 or length(dg)>15 then raise exception 'invalid phone'; end if;
  if exists(select 1 from team_applications where regexp_replace(phone,'\D','','g')=dg and created_at>now()-interval '1 day') then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;
  insert into team_applications(role_wanted,full_name,phone,email,city,age,years_exp,prev_exp,current_work,availability,why,recruiters_count,leaders_count,team_size_note)
  values (p_role,left(trim(p_name),120),left(trim(p_phone),30),left(trim(coalesce(p_email,'')),160),left(trim(coalesce(p_city,'')),80),
          case when p_age between 16 and 80 then p_age end,left(coalesce(p_years,''),40),left(coalesce(p_prev,''),1200),left(coalesce(p_current,''),300),
          left(coalesce(p_avail,''),120),left(coalesce(p_why,''),800),
          case when p_recruiters between 0 and 1000 then p_recruiters end, case when p_leaders between 0 and 1000 then p_leaders end,
          left(coalesce(p_team_note,''),500)) returning id into rid;
  return jsonb_build_object('ok',true);
end $fn$;
grant execute on function public.submit_team_application(text,text,text,text,text,int,text,text,text,text,text,int,int,text) to anon, authenticated;

create or replace function public.team_apps_report() returns setof public.team_applications
language sql stable security definer set search_path=public as $fn$
  select * from team_applications where public.is_boss() order by (status='new') desc, created_at desc limit 300
$fn$;
create or replace function public.set_team_app_status(p_id uuid, p_status text, p_notes text default null) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  if not public.is_boss() then raise exception 'not allowed'; end if;
  if p_status not in ('new','contacted','accepted','rejected') then raise exception 'bad status'; end if;
  update team_applications set status=p_status, notes=coalesce(p_notes,notes) where id=p_id;
end $fn$;
create or replace function public.open_team_apps_count() returns int
language sql stable security definer set search_path=public as $fn$
  select case when public.is_boss() then (select count(*)::int from team_applications where status='new') else 0 end
$fn$;
revoke execute on function public.team_apps_report(), public.set_team_app_status(uuid,text,text), public.open_team_apps_count() from public, anon;
grant execute on function public.team_apps_report(), public.set_team_app_status(uuid,text,text), public.open_team_apps_count() to authenticated;

-- INSTANT PHONE NOTIFICATION (optional, free): Telegram. Fill the two values below once (see the guide), or leave as is to skip.
create table if not exists public.notify_hook(id int primary key default 1 check(id=1), tg_token text, tg_chat text);
alter table public.notify_hook enable row level security;
insert into public.notify_hook(id,tg_token,tg_chat) values (1,'PASTE_BOT_TOKEN','PASTE_CHAT_ID') on conflict (id) do nothing;

create or replace function public.team_app_notify() returns trigger language plpgsql security definer set search_path=public as $fn$
declare h record; txt text; r text;
begin
  select * into h from notify_hook where id=1;
  if h.tg_token is null or h.tg_token like 'PASTE%' then return null; end if;
  r := case new.role_wanted when 'unit_manager' then 'Unit Manager' when 'team_leader' then 'Team Leader' else 'Recruiter' end;
  txt := E'\U0001F514 New team application: '||r||E'\n'||new.full_name||E'\n'||new.phone||
         case when new.city<>'' then E'\n'||new.city else '' end||
         case when new.years_exp<>'' then E'\nExperience: '||new.years_exp else '' end||
         case when new.role_wanted='unit_manager' then E'\nLeaders: '||coalesce(new.leaders_count::text,'-')||E' / Recruiters: '||coalesce(new.recruiters_count::text,'-')
              when new.role_wanted='team_leader' then E'\nRecruiters he brings: '||coalesce(new.recruiters_count::text,'-') else '' end;
  begin
    perform net.http_post(url := 'https://api.telegram.org/bot'||h.tg_token||'/sendMessage',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('chat_id',h.tg_chat,'text',txt));
  exception when others then null; end;
  return null;
end $fn$;
drop trigger if exists trg_team_app_notify on public.team_applications;
create trigger trg_team_app_notify after insert on public.team_applications for each row execute function public.team_app_notify();
notify pgrst, 'reload schema';
select 'join 1 ok' as result;
