import { NextResponse } from "next/server"

export async function POST() {
  try {
    return NextResponse.json({ data: null, error: "Chat ainda não configurado." })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível processar a mensagem." },
      { status: 500 },
    )
  }
}
