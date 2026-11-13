import { timingSafeEqual } from "node:crypto"
import { Auth } from "googleapis"
import type { NextRequest, NextResponse } from "next/server"
import { createGoogleOAuthClient } from "@/lib/google-drive-auth"

/**
 * Google OAuth for Drive and account connections, hardened:
 *  - PKCE (S256): a stolen authorization code is useless without the verifier kept in our cookie;
 *  - `state` is random and bound to the signed-in user (and workspace), checked in constant time;
 *  - on HTTPS the cookie uses the __Host- prefix, so a sibling subdomain can't plant its own.
 */
type Flow = "drive" | "account"
type Pending = { state: string; verifier: string; userId: string; workspaceId?: string }

const cookieName = (flow: Flow, secure: boolean) => (secure ? "__Host-" : "") + "lifehub_google_" + flow + "_oauth"

export async function startGoogleOAuth(request: NextRequest, input: { flow: Flow; callbackPath: string; scopes: string[]; userId: string; workspaceId?: string; includeGrantedScopes?: boolean }) {
  const client = createGoogleOAuthClient(new URL(input.callbackPath, request.url).toString())
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: input.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: Auth.CodeChallengeMethod.S256,
    ...(input.includeGrantedScopes ? { include_granted_scopes: true } : {}),
  })
  const pending: Pending = { state, verifier: codeVerifier, userId: input.userId, workspaceId: input.workspaceId }
  return {
    url,
    setCookie(response: NextResponse) {
      const secure = request.nextUrl.protocol === "https:"
      response.cookies.set(cookieName(input.flow, secure), Buffer.from(JSON.stringify(pending)).toString("base64url"), { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" })
      return response
    },
  }
}

/** The verifier for this callback, or null when the state doesn't match this user's pending sign-in. */
export function finishGoogleOAuth(request: NextRequest, input: { flow: Flow; userId: string; workspaceId?: string }) {
  const secure = request.nextUrl.protocol === "https:"
  const raw = request.cookies.get(cookieName(input.flow, secure))?.value
  const state = request.nextUrl.searchParams.get("state") ?? ""
  if (!raw || !state) return null
  let pending: Pending
  try {
    pending = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
  } catch {
    return null
  }
  const expected = Buffer.from(String(pending.state ?? ""))
  const given = Buffer.from(state)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (pending.userId !== input.userId || (input.workspaceId !== undefined && pending.workspaceId !== input.workspaceId)) return null
  return typeof pending.verifier === "string" && pending.verifier ? pending.verifier : null
}

export function clearGoogleOAuth(request: NextRequest, response: NextResponse, flow: Flow) {
  const secure = request.nextUrl.protocol === "https:"
  response.cookies.set(cookieName(flow, secure), "", { httpOnly: true, sameSite: "lax", secure, maxAge: 0, path: "/" })
  return response
}
