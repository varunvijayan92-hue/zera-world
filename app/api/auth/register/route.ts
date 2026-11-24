import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { customerRegistrationSchema } from "@/lib/customer-whatsapp";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { issueCustomerOtp, OTP_COOKIE, OTP_TTL_SECONDS } from "@/lib/customer-otp";
import { integrationCredentials } from "@/lib/integration-settings";
import { isProductionSecureContext } from "@/lib/site";
const schema = customerRegistrationSchema;
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  if (rateLimited(request,"register",10)) return NextResponse.json({ message:"Too many attempts. Try later." },{status:429});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({message:parsed.error.issues[0]?.message || "Check your name, email, WhatsApp phone number and password."},{status:400});
  let createdId: string | undefined;
  try {
    const { signupOtpEnabled } = await integrationCredentials("META_WHATSAPP");
    const useWhatsApp = signupOtpEnabled === "true";
    let user=await prisma.user.findFirst({where:{email:{equals:parsed.data.email,mode:"insensitive"}}});
    if(user){
      const pending=await prisma.$queryRaw<{purpose:string}[]>`SELECT "purpose" FROM "CustomerLoginChallenge" WHERE "userId"=${user.id}`;
      if(user.role!=="CUSTOMER"||user.isActive||!["REGISTER", "REGISTER_WHATSAPP", "REGISTER_EMAIL"].includes(pending[0]?.purpose)||!await bcrypt.compare(parsed.data.password,user.passwordHash))return NextResponse.json({message:"This email cannot be registered. Try signing in or contact support."},{status:409});
      user=await prisma.user.update({where:{id:user.id,isActive:false,phone:user.phone},data:{phone:parsed.data.phone,...(user.phone !== parsed.data.phone && { phoneVerifiedAt: null }),whatsappPreference:{upsert:{create:{enabled:parsed.data.whatsappEnabled},update:{enabled:parsed.data.whatsappEnabled}}}}});
    } else {
      user=await prisma.user.create({data:{fullName:parsed.data.fullName,email:parsed.data.email,phone:parsed.data.phone,passwordHash:await bcrypt.hash(parsed.data.password,12),role:"CUSTOMER",isActive:false,whatsappPreference:{create:{enabled:parsed.data.whatsappEnabled}}}});
      createdId=user.id;
    }
    const challengeId=await issueCustomerOtp(user,useWhatsApp ? "REGISTER_WHATSAPP" : "REGISTER");
    if (!challengeId) {
      if (createdId) await prisma.user.deleteMany({ where: { id: createdId, isActive: false } });
      return NextResponse.json({ message: "Too many requests for this account or WhatsApp number. Please wait before trying again." }, { status: 429 });
    }
    const response=NextResponse.json({requiresOtp:true,challengeId,channel:useWhatsApp ? "whatsapp" : "email",message:useWhatsApp ? "Enter the verification code we sent to your WhatsApp number." : "Enter the verification code we sent to your email."},{status:201});
    response.cookies.set(OTP_COOKIE,challengeId,{httpOnly:true,secure:isProductionSecureContext(),sameSite:"lax",path:"/api/auth",maxAge:OTP_TTL_SECONDS});
    return response;
  } catch {
    if(createdId)await prisma.user.deleteMany({where:{id:createdId,isActive:false}}).catch(()=>{});
    return NextResponse.json({message:"Registration is unavailable. Please try again later."},{status:503});
  }
}
