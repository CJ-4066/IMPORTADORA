import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Emisor retirado. Las salidas automáticas pertenecen exclusivamente al motor de Super Bot." }, { status: 410 });
}
