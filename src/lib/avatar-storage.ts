import { createAdminClient } from "@/lib/supabase/admin"

// Profile photos belong to the account, not to a workspace: they live in the private Supabase Storage
// bucket "avatars" (0017) at <userId>/avatar, read and written only by the server. The path is always
// derived from the user id, never from profile columns (which their owner can edit).
const BUCKET = "avatars"
export const AVATAR_MARKER = "storage:avatar"
export type AvatarType = "image/png" | "image/jpeg" | "image/webp"
type AvatarProfile = { avatar_url?: string | null; avatar_google_file_id?: string | null }

const pathFor = (userId: string) => userId + "/avatar"

/** True when the profile has a photo, in Storage or (not yet moved) in a workspace's Google Drive. */
export function hasAvatar<T extends AvatarProfile>(profile: T | null | undefined): profile is T {
  return profile?.avatar_url === AVATAR_MARKER || Boolean(profile?.avatar_google_file_id)
}

/** The image type from the file's first bytes; null for anything that isn't PNG, JPEG or WebP. */
export function sniffAvatarType(bytes: Uint8Array): AvatarType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp"
  return null
}

export async function saveAvatar(userId: string, bytes: Uint8Array, type: AvatarType) {
  const { error } = await createAdminClient().storage.from(BUCKET).upload(pathFor(userId), bytes, { contentType: type, upsert: true, cacheControl: "0" })
  if (error) throw error
}

export async function readAvatar(userId: string): Promise<{ bytes: Uint8Array; type: AvatarType } | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(pathFor(userId))
  if (error || !data) return null
  const bytes = new Uint8Array(await data.arrayBuffer())
  const type = sniffAvatarType(bytes)
  return type ? { bytes, type } : null
}
