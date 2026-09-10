import { redirect } from "next/navigation"

export function actionFailure(path: string, operation: string, error?: { message?: string } | null): never {
  console.error(operation, error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : "validation or database error")
  const separator = path.includes("?") ? "&" : "?"
  redirect(path + separator + "error=" + encodeURIComponent("Could not " + operation.toLowerCase() + ". Please try again."))
}
