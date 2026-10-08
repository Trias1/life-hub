import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import nodemailer from "nodemailer"

test("Nodemailer compiles invitations without contacting SMTP", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" })
  const result = await transport.sendMail({
    from: "LifeHub <sender@example.com>",
    to: "recipient@example.com",
    subject: "You are invited to join LifeHub",
    html: '<p><a href="https://example.com/invitations/test">Accept invitation</a></p>',
  })
  assert.deepEqual(result.envelope.to, ["recipient@example.com"])
  assert.match(result.message.toString(), /Subject: You are invited to join LifeHub/)
  assert.match(result.message.toString(), /Content-Type: text\/html/)
})

test("baseline headers block embedding, objects, and foreign form targets", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8")
  for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(config.includes(directive))
  }
  assert.ok(config.includes("Strict-Transport-Security"))
  assert.ok(config.includes('process.env.NODE_ENV === "production"'))
})
