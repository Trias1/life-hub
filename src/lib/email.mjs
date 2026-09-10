import nodemailer from "nodemailer"

function escapeHtml(value) {
  return String(value).replace(/[&<>\'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\'": "&#39;", '"': "&quot;" })[character])
}

export function invitationUrl(token) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")
  return new URL("/invitations/" + encodeURIComponent(token), baseUrl).toString()
}

function gmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4,
    requireTLS: true,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
}
async function sendWithGmail({ email, role, link }) {
  const transporter = gmailTransporter()
  if (!transporter) return "not_configured"
  const result = await transporter.sendMail({
    from: `LifeHub <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "You are invited to join LifeHub",
    html: `<p>You have been invited to join a LifeHub workspace as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept invitation</a></p><p>If the button does not work, copy this link:</p><p>${escapeHtml(link)}</p>`,
  })
  return "sent"
}

export async function sendWorkspaceInvitation({ email, token, role }) {
  const link = invitationUrl(token)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "User-Agent": "LifeHub/1.0" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You are invited to join LifeHub",
        html: `<p>You have been invited to join a LifeHub workspace as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept invitation</a></p><p>If the button does not work, copy this link:</p><p>${escapeHtml(link)}</p>`,
      }),
    })
    if (response.ok) return "sent"
    const details = await response.text()
    console.error("[resend] invitation rejected", { status: response.status })
  }
  return sendWithGmail({ email, role, link })
}