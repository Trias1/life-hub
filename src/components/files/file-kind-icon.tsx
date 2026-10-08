import { createElement } from "react"
import type { LucideProps } from "lucide-react"
import { fileIcon } from "./file-kind"

/** Lucide icon for a file's type (image, archive, spreadsheet, …). */
export function FileKindIcon({ mimeType, name, ...props }: LucideProps & { mimeType: string; name: string }) {
  return createElement(fileIcon(mimeType, name), props)
}
