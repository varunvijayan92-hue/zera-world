import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// In-memory registered admin device tokens
interface RegisteredDevice {
  userId: string;
  fcmToken: string;
  platform: string;
  deviceModel: string;
  updatedAt: string;
}

const registeredDevices: Map<string, RegisteredDevice> = new Map();

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
      return NextResponse.json({ message: "Unauthorized. Admin role required." }, { status: 401 });
    }

    const body = await request.json();
    const { fcmToken, platform, deviceModel } = body;

    if (!fcmToken) {
      return NextResponse.json({ message: "fcmToken is required." }, { status: 400 });
    }

    const deviceData: RegisteredDevice = {
      userId: session.userId,
      fcmToken,
      platform: platform || "ANDROID",
      deviceModel: deviceModel || "Android Device",
      updatedAt: new Date().toISOString(),
    };

    registeredDevices.set(fcmToken, deviceData);

    return NextResponse.json({
      success: true,
      message: "Admin device FCM token registered successfully.",
      device: deviceData,
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to register device token." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const devices = Array.from(registeredDevices.values());
  return NextResponse.json({
    count: devices.length,
    devices,
  });
}
