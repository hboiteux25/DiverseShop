import { expect, test } from "./fixtures"

test.describe("autenticacao", () => {
  test("valida campos invalidos no login", async ({ page }) => {
    await page.goto("/login")

    await expect(page.getByText("Entrar no sistema")).toBeVisible()

    await page.getByLabel("Email").fill("email-invalido")
    await page.getByLabel("Senha").fill("123")
    await page.locator("form button[type='submit']").click()

    await expect(page.getByText(/Informe um email/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/senha deve ter ao menos 6 caracteres/i)).toBeVisible()
  })

  test("valida recuperacao de senha com email invalido", async ({ page }) => {
    await page.goto("/login")

    await page.getByLabel("Email").fill("email-invalido")
    await page.getByRole("button", { name: /Esqueci minha senha/i }).click()

    await expect(page.getByText(/Informe um email/i)).toBeVisible({ timeout: 15_000 })
  })

  test("nao exibe cadastro publico no login", async ({ page }) => {
    await page.goto("/login")

    await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0)
    await expect(page.getByText(/conta criada pelo administrador/i)).toBeVisible()
  })
})
