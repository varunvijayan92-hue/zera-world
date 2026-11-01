import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { issueCustomerOtp, OTP_COOKIE, OTP_TTL_SECONDS } from "@/lib/customer-otp";
import { isProductionSecureContext } from "@/lib/site";
const schema = z.object({ fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(12).refine(v => Buffer.byteLength(v,"utf8") <= 72) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  if (rateLimited(request,"register",10)) return NextResponse.json({ message:"Too many attempts. Try later." },{status:429});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({message:"Enter your name, a valid email and a password of 12–72 bytes."},{status:400});
  let createdId: string | undefined;
  try {
    let user=await prisma.user.findFirst({where:{email:{equals:parsed.data.email,mode:"insensitive"}}});
    if(user){
      const pending=await prisma.$queryRaw<{purpose:string}[]>`SELECT "purpose" FROM "CustomerLoginChallenge" WHERE "userId"=${user.id}`;
      if(user.role!=="CUSTOMER"||user.isActive||pending[0]?.purpose!=="REGISTER"||!await bcrypt.compare(parsed.data.password,user.passwordHash))return NextResponse.json({message:"This email cannot be registered. Try signing in or contact support."},{status:409});
    } else {
      user=await prisma.user.create({data:{fullName:parsed.data.fullName,email:parsed.data.email,passwordHash:await bcrypt.hash(parsed.data.password,12),role:"CUSTOMER",isActive:false}});
      createdId=user.id;
    }
    const challengeId=await issueCustomerOtp(user,"REGISTER");
    if(!challengeId)return NextResponse.json({message:"Wait one minute before requesting another verification code."},{status:429});
    const response=NextResponse.json({requiresOtp:true,challengeId,message:"We emailed a verification code. Enter it to activate your account."},{status:201});
    response.cookies.set(OTP_COOKIE,challengeId,{httpOnly:true,secure:isProductionSecureContext(),sameSite:"lax",path:"/api/auth",maxAge:OTP_TTL_SECONDS});
    return response;
  } catch {
    if(createdId)await prisma.user.deleteMany({where:{id:createdId,isActive:false}}).catch(()=>{});
    return NextResponse.json({message:"Registration is unavailable. Please try again later."},{status:503});
  }
}
