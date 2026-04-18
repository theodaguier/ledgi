import { prisma } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
