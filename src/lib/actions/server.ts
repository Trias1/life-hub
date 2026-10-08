import { redirect } from "next/navigation"

export function actionFailure(path: string, operation: string, error?: { message?: string } | null): never {
  console.error(operation, error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : "validation or database error")
  const separator = path.includes("?") ? "&" : "?"
  redirect(path + separator + "error=" + encodeURIComponent("Could not " + operation.toLowerCase() + ". Please try again."))
}

const fieldMessages: Record<string, string> = {
  url: "Enter a valid link that starts with https://.",
  title: "Enter a title (up to 160 characters).",
  collection: "Enter a collection name (up to 80 characters).",
  tags: "Tags are too long.",
  email: "Enter a valid email address.",
  role: "Choose a valid role.",
}

/** Redirects with a message naming the first invalid field instead of a generic retry prompt. */
export function validationFailure(path: string, issues: Array<{ path: PropertyKey[] }>): never {
  const field = String(issues[0]?.path[0] ?? "")
  const separator = path.includes("?") ? "&" : "?"
  redirect(path + separator + "error=" + encodeURIComponent(fieldMessages[field] ?? "Some fields are invalid. Check the form and try again."))
}
