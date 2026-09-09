import { expect, test } from "@playwright/test"

test("public auth pages render", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByText("Welcome back")).toBeVisible()
  await page.goto("/register")
  await expect(page.getByText("Create your account")).toBeVisible()
})

test("protected search endpoint rejects anonymous access", async ({ request }) => {
  const response = await request.get("/api/search?q=notes")
  expect(response.status()).toBe(401)
})
