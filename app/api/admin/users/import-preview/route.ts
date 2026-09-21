import { NextRequest, NextResponse } from "next/server";
import { parseImportRows } from "@/lib/admin-user-csv";
import { handleRoute, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requirePermission("members.write");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("CSV-Datei fehlt.");
    }

    const existingUsers = await prisma.user.findMany({ select: { email: true, memberNumber: true } });
    const existingKeys = new Set(
      existingUsers.flatMap((user) => [user.email.toLowerCase(), user.memberNumber ? `member:${user.memberNumber}` : ""]).filter(Boolean)
    );
    const preview = parseImportRows(await file.text(), existingKeys);

    return NextResponse.json(preview);
  });
}
