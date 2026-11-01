import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { emailDelivery } from "../lib/email";
import { otpDigest } from "../lib/customer-otp";
import { requestCustomerReset, verifyCustomerReset, completeCustomerReset, resetProofDigest } from "../lib/customer-password-reset";
test("password reset does not reveal account existence and only searches active customers",async t=>{
 process.env.JWT_SECRET="password-reset-test-secret-at-least-thirty-two-chars";
 const user=prisma.user,query=prisma.$queryRaw,send=emailDelivery.send;let found=false;let emails=0;let filter:unknown;
 Object.assign(prisma,{user:{findFirst:async(args:unknown)=>{filter=args;return found?{id:"u",email:"buyer@example.test",sessionVersion:0}:null;}},$queryRaw:async()=>[{userId:"u"}]});emailDelivery.send=async(message)=>{emails++;assert.match(message.text,/code is \d{6}/);return "email";};
 t.after(()=>{Object.assign(prisma,{user,$queryRaw:query});emailDelivery.send=send;});
 assert.match(await requestCustomerReset("nobody@example.test"),/^[a-f0-9]{64}$/);assert.equal(emails,0);assert.equal((filter as {where:{role:string}}).where.role,"CUSTOMER");
 found=true;assert.match(await requestCustomerReset("buyer@example.test"),/^[a-f0-9]{64}$/);assert.equal(emails,1);
});
test("reset requires a valid OTP then browser proof, revokes sessions and prevents reuse",async t=>{
 process.env.JWT_SECRET="password-reset-test-secret-at-least-thirty-two-chars";
 const original=prisma.$transaction;
 const row={userId:"u",challengeId:"c",digest:otpDigest("password-reset:c","123456"),sessionVersion:0,attempts:0,expiresAt:new Date(Date.now()+60000),verifiedAt:null as Date|null,proofDigest:null as string|null,resetAt:null as Date|null};let updates=0;let role="CUSTOMER";let audit:unknown;
 const tx={$queryRaw:async()=>[{...row}],$executeRaw:async(sql:TemplateStringsArray,...values:unknown[])=>{const q=sql.join("");if(q.includes('"attempts"='))row.attempts++;else if(q.includes('"verifiedAt"=')){row.verifiedAt=new Date();row.proofDigest=String(values[0]);}else row.resetAt=new Date();return 1;},user:{findUnique:async()=>({id:"u",isActive:true,role,sessionVersion:0}),updateMany:async(args:unknown)=>{updates++;assert.deepEqual((args as {data:unknown}).data,{passwordHash:"new-hash",sessionVersion:{increment:1}});return {count:1};}},auditLog:{create:async(args:unknown)=>{audit=args;return {};}}};Object.assign(prisma,{$transaction:async(work:(client:typeof tx)=>unknown)=>work(tx)});t.after(()=>Object.assign(prisma,{$transaction:original}));
 assert.equal(await completeCustomerReset("c","fake","new-hash"),false);
 assert.equal(await verifyCustomerReset("c","000000"),null);assert.equal(updates,0);
 row.attempts=5;assert.equal(await verifyCustomerReset("c","123456"),null);row.attempts=0;
 row.expiresAt=new Date(0);assert.equal(await verifyCustomerReset("c","123456"),null);row.expiresAt=new Date(Date.now()+60000);
 role="ADMIN";assert.equal(await verifyCustomerReset("c","123456"),null);role="CUSTOMER";
 const proof=await verifyCustomerReset("c","123456");assert.ok(proof);assert.equal(row.proofDigest,resetProofDigest(proof));assert.equal(await verifyCustomerReset("c","123456"),null);
 assert.equal(await completeCustomerReset("c","wrong-proof","new-hash"),false);assert.equal(updates,0);
 assert.equal(await completeCustomerReset("c",proof,"new-hash"),true);assert.equal(updates,1);assert.doesNotMatch(JSON.stringify(audit),/123456|new-hash/);assert.equal(await completeCustomerReset("c",proof,"new-hash"),false);
});
