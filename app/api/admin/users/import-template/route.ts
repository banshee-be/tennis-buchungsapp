import { NextResponse } from "next/server";
import { csvTemplate } from "@/lib/admin-user-csv";
import { handleRoute } from "@/lib/http";
import { requirePermission } from "@/lib/session";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("members.export");
    return new NextResponse(csvTemplate(), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="mitglieder-vorlage-tv-europabad-marbach.csv"'
      }
    });
  });
}
