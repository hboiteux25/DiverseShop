import { expect, test } from "./fixtures"

test.describe("responsividade", () => {
  test("menu mobile abre a navegacao principal", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Cenario especifico de viewport mobile")

    await page.goto("/vendas")

    await page.getByRole("button", { name: /Abrir navegacao|Abrir navegação/i }).click()
    await expect(page.getByRole("dialog")).toContainText("Diverse Shop DF")
    await expect(page.getByRole("dialog")).toContainText("Vendas")
  })

  test("pdv nao cria overflow horizontal no primeiro viewport", async ({ page }) => {
    await page.goto("/vendas")

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1
    })

    expect(hasHorizontalOverflow).toBe(false)
  })
})
