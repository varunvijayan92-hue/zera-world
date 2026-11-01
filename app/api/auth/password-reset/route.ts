import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { isProductionSecureContext } from "@/lib/site";
import { AUTH_COOKIE } from "@/lib/auth";
import { userPasswordSchema } from "@/lib/admin-operations";
import { requestCustomerReset,verifyCustomerReset,completeCustomerReset,RESET_COOKIE,RESET_PROOF_COOKIE } from "@/lib/customer-password-reset";
const schema=z.discriminatedUnion("step",[
 z.object({step:z.literal("request"),email:z.string().trim().email().max(254)}),
 z.object({step:z.literal("verify"),code:z.string().regex(/^\d{6}$/)}),
 z.object({step:z.literal("reset"),password:userPasswordSchema}),
]);
const options=()=>({httpOnly:true,secure:isProductionSecureContext(),sameSite:"lax" as const,path:"/api/auth/password-reset",maxAge:600});
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({message:"Invalid origin."},{status:403});
 const body=schema.safeParse(await request.json().catch(()=>null));
 if(!body.success)return NextResponse.json({message:body.error.issues[0]?.message||"Check your details."},{status:400});
 if(rateLimited(request,`password-reset-${body.data.step}`,body.data.step==="request"?8:30))return NextResponse.json({message:"Too many attempts. Try again later."},{status:429});
 try{
  if(body.data.step==="request"){
   const challenge=await requestCustomerReset(body.data.email);
   const response=NextResponse.json({message:"If this email belongs to an active customer account, a code has been sent. Check spam too. Wait one minute before requesting another."});
   response.cookies.set(RESET_COOKIE,challenge,options());response.cookies.set(RESET_PROOF_COOKIE,"",{...options(),maxAge:0});return response;
  }
  const store=await cookies();const challenge=store.get(RESET_COOKIE)?.value;
  if(!challenge||!/^[a-f0-9]{64}$/.test(challenge))return NextResponse.json({message:"Start the reset again in this browser."},{status:400});
  if(body.data.step==="verify"){
   const proof=await verifyCustomerReset(challenge,body.data.code);
   if(!proof)return NextResponse.json({message:"Invalid or expired code. Request a new code after five attempts."},{status:400});
   const response=NextResponse.json({message:"Email verified. Choose your new password."});response.cookies.set(RESET_PROOF_COOKIE,proof,options());return response;
  }
  const proof=store.get(RESET_PROOF_COOKIE)?.value;
  if(!proof||!/^[a-f0-9]{64}$/.test(proof))return NextResponse.json({message:"Verify the email code first."},{status:400});
  if(!await completeCustomerReset(challenge,proof,await bcrypt.hash(body.data.password,12)))return NextResponse.json({message:"The reset has expired or was already used. Start again."},{status:400});
  const response=NextResponse.json({message:"Password reset. Sign in with your new password."});for(const name of [RESET_COOKIE,RESET_PROOF_COOKIE])response.cookies.set(name,"",{...options(),maxAge:0});response.cookies.set(AUTH_COOKIE,"",{httpOnly:true,secure:isProductionSecureContext(),sameSite:"lax",path:"/",maxAge:0});return response;
 }catch{return NextResponse.json({message:"Password reset is unavailable. Please try again."},{status:503});}
}
