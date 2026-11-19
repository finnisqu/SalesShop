#!/usr/bin/env node
/**
 * #391 — Real, destructive, SYNTHETIC staging-only storage role matrix.
 *
 * Requires an isolated Supabase project and four distinct test accounts
 * with roles: org A owner/admin, org A CRM editor, org A viewer, org B outsider.
 * The orgs MUST contain preseeded Company and Deal test records. All new
 * documents created here use random IDs and are cleaned up in finally.
 *
 * This is a release gate, NOT a CI test targeting a production database.
 * Never print credentials, JWTs, bucket paths, customer records or downloaded bytes.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const required=(key)=>{
 const value=process.env[key]?.trim();
 if(!value)throw new Error('Missing synthetic staging setting: '+key);
 return value;
};
const url=required('STAGING_SUPABASE_URL');
const parsed=new URL(url);
const loopback=parsed.hostname==='127.0.0.1'||parsed.hostname==='localhost';
if(!loopback&&(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')))
 throw new Error('Refusing non-local/non-Supabase test endpoint.');
if(parsed.hostname==='pvchgibllozuwickhfqz.supabase.co')
 throw new Error('Refusing live SalesShop project.');
if(required('STAGING_RELEASE_ACK')!=='disposable-documents-fixtures')
 throw new Error('Provide explicit acknowledgement of disposable staging fixtures.');

const key=required('STAGING_SUPABASE_ANON_KEY');
const orgA=required('STAGING_FILES_ORG_A');
const orgB=required('STAGING_FILES_ORG_B');
const companyA=required('STAGING_FILES_COMPANY_A');
const dealA=required('STAGING_FILES_DEAL_A');
const companyB=required('STAGING_FILES_COMPANY_B');
assert.notEqual(orgA,orgB,'Fixture orgs must be distinct.');
const ident=(s)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
assert(ident(orgA)&&ident(orgB),'Staging organizations must be UUIDs.');

const clients={};
for(const role of ['owner','editor','viewer','outsider']){
 const upper=role.toUpperCase();
 const client=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 });
 const {data,error}=await client.auth.signInWithPassword({
  email:required('STAGING_FILES_'+upper+'_EMAIL'),
  password:required('STAGING_FILES_'+upper+'_PASSWORD'),
 });
 if(error||!data.user)throw new Error('Failed to authenticate synthetic '+role+' fixture.');
 clients[role]=client;
}

const newIds=[];
let passed=0;
const bucket='sales-documents';
const content='SalesShop #391 isolated security fixture — '+randomUUID();
const blob=()=>new Blob([content],{type:'text/plain'});
const verify=async(name,run)=>{
 await run();passed++;
 process.stdout.write('PASS '+name+'\n');
};
const visible=async(client,id)=>{
 const {data,error}=await client.from('crm_file_objects').select('id,status,size_bytes')
  .eq('organization_id',orgA).eq('id',id).maybeSingle();
 if(error)throw new Error('Cannot read document metadata under expected role.');
 return data;
};
const reserve=async(client,org,targetKind,targetId,title)=>{
 const {data,error}=await client.from('crm_file_objects').insert({
  organization_id:org,target_kind:targetKind,target_id:targetId,
  title,category:'other',folder_path:'Security testing',mime_type:'text/plain',
 }).select('id,object_path,status').single();
 return {data,error};
};
const cleanup=async(id)=>{
 const owner=clients.owner;
 const {data:row}=await owner.from('crm_file_objects')
  .select('id,object_path,status').eq('id',id).eq('organization_id',orgA)
  .maybeSingle();
 if(!row)return;
 if(row.status==='ready')await owner.from('crm_file_objects')
  .update({status:'trashed'}).eq('id',id);
 // The owner has editor permission to delete trashed or pending bytes.
 await owner.storage.from(bucket).remove([row.object_path]);
 await owner.from('crm_file_objects').delete().eq('id',id).eq('organization_id',orgA);
};

try{
 const {data:main,error:reserveError}=await reserve(clients.owner,orgA,'company',companyA,'fixture-'+randomUUID()+'.txt');
 assert(!reserveError&&main,'Owner cannot reserve a Company attachment.');
 newIds.push(main.id);
 await verify('Owner can reserve only an own-org Company document',async()=>{
  assert.equal(main.status,'pending');
  assert.equal(main.object_path,orgA+'/'+main.id);
 });

 await verify('Pending visibility is editor-only and tenant-scoped',async()=>{
  assert(await visible(clients.owner,main.id));
  assert(await visible(clients.editor,main.id));
  assert.equal(await visible(clients.viewer,main.id),null);
  assert.equal(await visible(clients.outsider,main.id),null);
 });
 await verify('Viewer cannot create storage metadata',async()=>{
  const result=await reserve(clients.viewer,orgA,'deal',dealA,'viewer-denied.txt');
  assert(result.error||!result.data);
  if(result.data)throw new Error('Viewer unexpectedly wrote a document.');
 });
 await verify('Owner cannot attach to foreign organization',async()=>{
  const result=await reserve(clients.owner,orgB,'company',companyB,'cross-tenant-denied.txt');
  assert(result.error||!result.data);
 });
 await verify('Quote targets are blocked by database constraint',async()=>{
  const result=await reserve(clients.owner,orgA,'quote','nonexistent-quote','quote-denied.txt');
  assert(result.error||!result.data);
 });
 await verify('Wrong object path cannot be uploaded',async()=>{
  const {error}=await clients.owner.storage.from(bucket).upload(
   orgA+'/'+randomUUID(),blob(),{contentType:'text/plain',upsert:false});
  assert(error,'Unreserved object path was unexpectedly permitted.');
 });
 await verify('Storage upload is authorized for an exact reserved path',async()=>{
  const {error}=await clients.owner.storage.from(bucket).upload(
   main.object_path,blob(),{contentType:'text/plain',upsert:false});
  assert(!error,'Authorized private upload failed.');
 });
 await verify('Pending index cannot be deleted while Storage bytes exist',async()=>{
  const {data,error}=await clients.owner.from('crm_file_objects')
   .delete().eq('id',main.id).select('id').maybeSingle();
  assert(error||!data,'A pending upload orphaned its stored bytes.');
 });
 await verify('Client cannot spoof provider-derived size',async()=>{
  const {data,error}=await clients.owner.from('crm_file_objects')
   .update({size_bytes:1}).eq('id',main.id).select('id').maybeSingle();
  assert(error||!data,'File size overwrite unexpectedly passed.');
 });
 await verify('Finalization reads exact Storage bytes',async()=>{
  const {data,error}=await clients.owner.from('crm_file_objects')
   .update({status:'ready'}).eq('id',main.id)
   .select('status,size_bytes').single();
  assert(!error&&data);
  assert.equal(data.status,'ready');
  assert.equal(data.size_bytes,new TextEncoder().encode(content).byteLength);
 });
 await verify('Foreign organization cannot read metadata or download bytes',async()=>{
  assert.equal(await visible(clients.outsider,main.id),null);
  const {error}=await clients.outsider.storage.from(bucket).download(main.object_path);
  assert(error,'Foreign organization downloaded private bytes.');
 });
 await verify('Org members can download an active shared Company document',async()=>{
  assert(await visible(clients.viewer,main.id));
  const {data,error}=await clients.viewer.storage.from(bucket).download(main.object_path);
  assert(!error&&data);
  assert.equal(await data.text(),content);
 });
 await verify('Viewer cannot move a document to trash',async()=>{
  const {data,error}=await clients.viewer.from('crm_file_objects')
   .update({status:'trashed'}).eq('id',main.id)
   .select('id').maybeSingle();
  assert(error||!data,'Viewer unexpectedly changed document status.');
 });
 await verify('CRM editor can trash and restore a shared document',async()=>{
  const {data,error}=await clients.editor.from('crm_file_objects')
   .update({status:'trashed'}).eq('id',main.id).select('status').single();
  assert(!error&&data?.status==='trashed');
  const {error:downloadError}=await clients.viewer.storage.from(bucket).download(main.object_path);
  assert(downloadError,'Viewer downloaded trashed bytes.');
  const restore=await clients.editor.from('crm_file_objects')
   .update({status:'ready'}).eq('id',main.id).select('status').single();
  assert(!restore.error&&restore.data?.status==='ready');
 });

 const {data:abandoned,error:abandonedError}=await reserve(
  clients.owner,orgA,'deal',dealA,'abandoned-'+randomUUID()+'.txt');
 assert(!abandonedError&&abandoned);
 newIds.push(abandoned.id);
 await verify('A second CRM editor can clean another uploader’s pending document',async()=>{
  assert(await visible(clients.editor,abandoned.id));
  const {error:removeError}=await clients.editor.storage.from(bucket)
   .remove([abandoned.object_path]);
  assert(!removeError,'Editor could not remove an orphaned pending storage path.');
  const {data,error}=await clients.editor.from('crm_file_objects')
   .delete().eq('id',abandoned.id).select('id').single();
  assert(!error&&data?.id===abandoned.id);
  assert.equal(await visible(clients.owner,abandoned.id),null);
 });
 await verify('Permanent delete requires prior trash',async()=>{
  const {data,error}=await clients.editor.from('crm_file_objects')
   .delete().eq('id',main.id).select('id').maybeSingle();
  assert(error||!data,'Active document deleted without trash.');
 });
 await verify('Trash permits secure object and metadata deletion',async()=>{
  const result=await clients.editor.from('crm_file_objects')
   .update({status:'trashed'}).eq('id',main.id).select('status').single();
  assert(!result.error&&result.data?.status==='trashed');
  const {error:removeError}=await clients.editor.storage.from(bucket).remove([main.object_path]);
  assert(!removeError);
  const {data,error}=await clients.editor.from('crm_file_objects')
   .delete().eq('id',main.id).select('id').single();
  assert(!error&&data?.id===main.id);
  assert.equal(await visible(clients.owner,main.id),null);
 });
 process.stdout.write('PASS '+passed+' staged #391 access tests.\n');
}finally{
 for(const id of newIds){
  try{await cleanup(id);}
  catch{process.stderr.write('Check for leftover SYNTHETIC staging document after interrupted matrix.\n');}
 }
 for(const client of Object.values(clients))await client.auth.signOut();
}
