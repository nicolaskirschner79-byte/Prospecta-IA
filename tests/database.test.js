import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('schema executa em Postgres e RLS isola duas contas, notas, alterações e quotas',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/tests/rls.sql',import.meta.url),'utf8'));
    const result=await db.query('select count(*)::int as count from public.businesses');assert.equal(result.rows[0].count,0,'test transaction rolled back');
    const policies=await db.query("select tablename,count(*)::int as count from pg_policies where schemaname='public' group by tablename");assert.equal(policies.rows.find(r=>r.tablename==='businesses').count,4);assert.equal(policies.rows.find(r=>r.tablename==='profiles').count,4);
  }finally{await db.close();}
});
