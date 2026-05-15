import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json({ data: [], error: null })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível listar os produtos." },
      { status: 500 },
    )
  }
}
