-- Execute após schema.sql em um banco de teste. Transação revertida ao final.
-- Não depende de pgTAP; falhas levantam exceção. Nunca usar dados de produção.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','prospecta-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','prospecta-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.businesses(user_id,id,data) values(auth.uid(),'sample','{"id":"sample"}');
insert into public.profiles(user_id,settings) values(auth.uid(),'{"agency":"Conta A"}');
do $$begin
 if (select count(*) from public.businesses)<>1 then raise exception 'owner must see own business'; end if;
 if not public.consume_api_quota() then raise exception 'first quota reservation must succeed'; end if;
 if public.consume_api_quota() then raise exception 'immediate duplicate call must fail quota'; end if;
 begin
  update public.businesses set user_id='22222222-2222-4222-8222-222222222222';
  raise exception 'owner reassignment unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.businesses)<>0 then raise exception 'cross-account read';end if;
 if (select count(*) from public.profiles)<>0 then raise exception 'cross-account settings';end if;
 update public.businesses set data='{"id":"sample","notes":"attack"}' where id='sample';
 if found then raise exception 'cross-account update';end if;
 delete from public.businesses where id='sample';
 if found then raise exception 'cross-account delete';end if;
 begin
  insert into public.businesses(user_id,id,data) values('11111111-1111-4111-8111-111111111111','other','{"id":"other"}');
  raise exception 'cross-account insert unexpectedly allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.api_usage(user_id) values(auth.uid());
  raise exception 'direct quota mutation unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 begin
  perform * from public.businesses;
  raise exception 'anonymous access unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end$$;
rollback;
