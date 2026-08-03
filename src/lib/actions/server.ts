import { redirect } from "next/navigation"

export function actionFailure(path: string, operation: string, error?: { message?: string } | null): never {
  console.error(operation, error)
  const separator = path.includes("?") ? "&" : "?"
  redirect(path + separator + "error=" + encodeURIComponent("Could not " + operation.toLowerCase() + ". Please try again."))
}
