import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  getRegisteredDevices,
  RegisteredDevice,
} from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER", "SUPPLIER"].includes(session.role)) {
      return NextResponse.json({ message: "Unauthorized. Admin or Supplier session required." }, { status: 401 });
    }

    const body = await request.json();
    const { fcmToken, platform, deviceModel } = body;

    if (!fcmToken) {
      return NextResponse.json({ message: "fcmToken is required." }, { status: 400 });
    }

    let supplierId: string | null = null;
    if (session.role === "SUPPLIER") {
      const contact = await prisma.supplierContact.findFirst({
        where: { userId: session.userId },
        select: { supplierId: true },
      });
      supplierId = contact?.supplierId || null;
    }

    const deviceData: RegisteredDevice = {
      userId: session.userId,
      role: session.role,
      supplierId,
      fcmToken,
      platform: platform || "ANDROID",
      deviceModel: deviceModel || "Android Device",
      updatedAt: new Date().toISOString(),
    };

    const registered = registerDeviceToken(deviceData);

    return NextResponse.json({
      success: true,
      message: `${session.role} device FCM token registered successfully.`,
      device: registered,
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to register device token." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER", "SUPPLIER"].includes(session.role)) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { fcmToken } = body;

    if (!fcmToken) {
      return NextResponse.json({ message: "fcmToken is required to unregister." }, { status: 400 });
    }

    const deleted = unregisterDeviceToken(fcmToken);

    return NextResponse.json({
      success: true,
      message: deleted ? "Device token unregistered successfully." : "Token was not found.",
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to unregister device token." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SUPPLIER"].includes(session.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const isSupplier = session.role === "SUPPLIER";
  const devices = isSupplier
    ? getRegisteredDevices({ role: "SUPPLIER", supplierId: undefined })
    : getRegisteredDevices();

  return NextResponse.json({
    count: devices.length,
    devices,
  });
}
