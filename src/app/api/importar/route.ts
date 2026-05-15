import { NextResponse } from "next/server"

export async function POST() {
  try {
    return NextResponse.json({ data: null, error: "Importação ainda não configurada." })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível importar os dados." },
      { status: 500 },
    )
  }
}
