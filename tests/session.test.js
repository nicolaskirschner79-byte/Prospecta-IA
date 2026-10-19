import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSupabase,authSession,login,ensureSession,logout,saveCloudBatch } from '../public/lib/supabase.js';

test('conta sobrevive ao reload da aba, renova uma única vez e grava lote atomicamente',async t=>{
  const original=globalThis.fetch,memory=new Map();
  t.after(()=>{globalThis.fetch=original;delete globalThis.sessionStorage;});
  globalThis.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const config={url:'https://test.supabase.co',key:'sb_publishable_test'};configureSupabase(config);
  let refreshes=0,batch=null;
  globalThis.fetch=async(url,options)=>{
    if(url.includes('grant_type=password'))return Response.json({access_token:'old',refresh_token:'refresh',expires_in:1,user:{id:'account-a',email:'test@example.invalid'}});
    if(url.includes('grant_type=refresh_token')){refreshes++;return Response.json({access_token:'new',refresh_token:'new-refresh',expires_in:3600,user:{id:'account-a'}});}
    if(url.includes('/businesses?')){batch=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer new');return new Response(null,{status:201});}
    throw new Error('offline');
  };
  await login('test@example.invalid','test-password');assert.equal(memory.size,1);
  configureSupabase(config);assert.equal(authSession().access_token,'old','reload restaura a conta');
  await Promise.all([ensureSession(),ensureSession()]);assert.equal(refreshes,1);
  await saveCloudBatch([{id:'one'},{id:'two'}]);assert.equal(batch.length,2);assert.ok(batch.every(row=>row.user_id==='account-a'));
  await logout();assert.equal(authSession(),null);assert.equal(memory.size,0,'logout local também funciona offline');
  configureSupabase(config);assert.equal(authSession(),null);
});
