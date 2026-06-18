import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";
import { directoryService } from "@/server/services/directory.service";

export async function GET() {
  try {
    const directory = await directoryService.getDirectory();
    return NextResponse.json(directory);
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    throw error;
  }
}
