-- Instalação inicial em um projeto Supabase vazio. Execute uma vez no SQL Editor.
-- O MVP usa documentos JSONB para manter cada negócio e seu histórico atomicamente.
-- Nenhuma service_role é necessária no navegador ou nas funções da aplicação.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object' and octet_length(settings::text)<=100000),
  updated_at timestamptz not null default now()
);
create table public.businesses (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 120),
  data jsonb not null check (jsonb_typeof(data)='object' and data ? 'id' and data->>'id'=id and octet_length(data::text)<=500000),
  updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
create index businesses_owner_updated on public.businesses(user_id,updated_at desc);

-- Reserva de quota persistente entre instâncias. Usuários não alteram contadores diretamente.
create table public.api_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  last_call timestamptz not null default '-infinity',
  calls integer not null default 0 check(calls>=0)
);
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.api_usage enable row level security;
revoke all on table public.profiles,public.businesses,public.api_usage from anon,authenticated;
grant select,insert,update,delete on table public.profiles,public.businesses to authenticated;

create policy profile_select on public.profiles for select to authenticated using((select auth.uid())=user_id);
create policy profile_insert on public.profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy profile_update on public.profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy profile_delete on public.profiles for delete to authenticated using((select auth.uid())=user_id);
create policy business_select on public.businesses for select to authenticated using((select auth.uid())=user_id);
create policy business_insert on public.businesses for insert to authenticated with check((select auth.uid())=user_id);
create policy business_update on public.businesses for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy business_delete on public.businesses for delete to authenticated using((select auth.uid())=user_id);

-- Função privilegiada somente em schema privado; sem argumento de user_id.
-- Identidade obtida exclusivamente do JWT autenticado; search_path fixo.
create schema if not exists prospecta_private;
revoke all on schema prospecta_private from public,anon,authenticated;
create function prospecta_private.consume_quota() returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
  granted boolean;
begin
  if uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  insert into public.api_usage(user_id,window_start,last_call,calls)
  values(uid,now(),now(),1)
  on conflict(user_id) do update
    set window_start=case when public.api_usage.window_start<now()-interval '1 hour' then now() else public.api_usage.window_start end,
        calls=case when public.api_usage.window_start<now()-interval '1 hour' then 1 else public.api_usage.calls+1 end,
        last_call=now()
    where (public.api_usage.window_start<now()-interval '1 hour' or public.api_usage.calls<30)
      and public.api_usage.last_call<now()-interval '3 seconds'
  returning true into granted;
  return coalesce(granted,false);
end;
$$;
revoke all on function prospecta_private.consume_quota() from public,anon,authenticated;
grant usage on schema prospecta_private to authenticated;
grant execute on function prospecta_private.consume_quota() to authenticated;
-- Wrapper SECURITY INVOKER: expõe apenas esta operação, sem acesso direto à tabela.
create function public.consume_api_quota() returns boolean language sql security invoker set search_path=''
as $$select prospecta_private.consume_quota();$$;
revoke all on function public.consume_api_quota() from public,anon;
grant execute on function public.consume_api_quota() to authenticated;
commit;
