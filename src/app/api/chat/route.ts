import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { CHAT_MODEL, createOpenAIClient, SYSTEM_PROMPT } from "@/lib/openai"
import { createClient } from "@/lib/supabase/server"

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
})

const chatContextSchema = z
  .object({
    pathname: z.string().optional(),
    pageTitle: z.string().optional(),
    relevantData: z.unknown().optional(),
  })
  .optional()

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  context: chatContextSchema,
})

type ChatMessage = z.infer<typeof chatMessageSchema>
type ChatContext = z.infer<typeof chatContextSchema>

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function detectIntent(messages: ChatMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")
  const text = normalizeText(lastUserMessage?.content ?? "")

  if (/(cadastrar|cadastro|novo produto|criar produto|adicionar produto)/.test(text)) {
    return "product_registration"
  }

  if (/(reposicao|pedido|comprar|fornecedor)/.test(text)) {
    return "restock"
  }

  if (/(estoque|falta|acabando|critico|zerado)/.test(text)) {
    return "stock_query"
  }

  if (/(resumo|hoje|vendas|faturamento|caixa)/.test(text)) {
    return "daily_summary"
  }

  return "general"
}

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

async function getDailySalesContext() {
  const supabase = await createClient()
  const today = getTodayDate()
  const start = `${today}T00:00:00-03:00`
  const end = `${today}T23:59:59-03:00`

  const { data } = await supabase
    .from("sales")
    .select("total, discount, net_received, payment_method, status")
    .gte("created_at", start)
    .lte("created_at", end)

  const completedSales = (data ?? []).filter((sale) => sale.status === "completed")

  return {
    date: today,
    salesCount: completedSales.length,
    totalSales: completedSales.reduce((total, sale) => total + Number(sale.total) - Number(sale.discount ?? 0), 0),
    totalNetReceived: completedSales.reduce((total, sale) => total + Number(sale.net_received), 0),
    paymentMethods: completedSales.reduce<Record<string, number>>((map, sale) => {
      map[sale.payment_method] = (map[sale.payment_method] ?? 0) + Number(sale.total) - Number(sale.discount ?? 0)
      return map
    }, {}),
  }
}

async function buildDatabaseContext(intent: string, context: ChatContext) {
  const supabase = await createClient()

  const [
    { data: suppliers },
    { data: criticalProducts },
    { data: latestProducts },
    dailySummary,
  ] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, contact, delivery_days")
      .order("name", { ascending: true })
      .limit(50),
    supabase
      .from("products")
      .select("id, description, barcode, supplier_id, purchase_price, sale_price, stock_quantity, min_stock, status")
      .is("deleted_at", null)
      .or("status.eq.low_stock,status.eq.out_of_stock")
      .order("stock_quantity", { ascending: true })
      .limit(30),
    supabase
      .from("products")
      .select("id, description, barcode, supplier_id, purchase_price, sale_price, stock_quantity, min_stock, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(context?.pathname?.startsWith("/produtos") ? 12 : 5),
    intent === "daily_summary" ? getDailySalesContext() : Promise.resolve(null),
  ])

  return {
    page: context ?? null,
    detectedIntent: intent,
    suppliers: suppliers ?? [],
    criticalProducts: criticalProducts ?? [],
    latestProducts: latestProducts ?? [],
    dailySummary,
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { data: null, error: "Chat IA não configurado no servidor." },
        { status: 500 },
      )
    }

    const body: unknown = await req.json()
    const parsedBody = chatRequestSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { data: null, error: "Mensagem inválida para o assistente." },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { data: null, error: "Faça login para usar o assistente." },
        { status: 401 },
      )
    }

    const intent = detectIntent(parsedBody.data.messages)
    const databaseContext = await buildDatabaseContext(intent, parsedBody.data.context)
    const encoder = new TextEncoder()

    const openai = createOpenAIClient()
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      stream: true,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}

Contexto atual do sistema:
${JSON.stringify(databaseContext, null, 2)}`,
        },
        ...parsedBody.data.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    })

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content

            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }

          controller.close()
        } catch {
          controller.error(new Error("Não foi possível concluir a resposta do assistente."))
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível processar a mensagem agora." },
      { status: 500 },
    )
  }
}
