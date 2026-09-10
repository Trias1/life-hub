"use client"

import { useState } from "react"

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  async function uploadImage(file: File | string, workspaceId: string) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("workspaceId", workspaceId)
      const response = await fetch("/api/notes/upload-image", { method: "POST", body: formData })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not upload image")
      return result.url
    } finally {
      setUploading(false)
    }
  }
  async function processImages(htmlContent: string, workspaceId: string) {
    const normalizedContent = htmlContent.replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, '<img alt="$1" src="$2">')
    const imagePattern = /<img\b([^>]*?)src=["\'](data:image\/[^"\']+)["\']([^>]*)>/gi
    const matches = Array.from(normalizedContent.matchAll(imagePattern))
    let cleaned = normalizedContent
    for (const match of matches) {
      const dataUrl = match[2]
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const extension = blob.type.split("/")[1] || "png"
      const file = new File([blob], "pasted-image." + extension, { type: blob.type })
      const url = await uploadImage(file, workspaceId)
      cleaned = cleaned.replace(dataUrl, url)
    }
    return cleaned
  }
  return { uploadImage, processImages, uploading }
}
