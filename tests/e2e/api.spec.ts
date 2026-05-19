import { expect, test } from "./fixtures"

test.describe("apis", () => {
  test("lista produtos, estoque e vendas com contrato JSON", async ({ request }) => {
    for (const path of ["/api/produtos", "/api/estoque", "/api/vendas"]) {
      const response = await request.get(path)
      const body: unknown = await response.json()

      expect(response.status()).toBe(200)
      expect(body).toMatchObject({ data: [], error: null })
    }
  })

  test("chat retorna erro amigavel quando OpenAI nao esta configurada", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "olá" }],
      },
    })
    const body: unknown = await response.json()

    expect(response.status()).toBe(500)
    expect(body).toMatchObject({
      data: null,
      error: expect.stringMatching(/Chat IA/i),
    })
  })
})
