import dns from "node:dns/promises"
import http from "node:http"
import https from "node:https"
import { BlockList, isIP } from "node:net"

const blocked = new BlockList()
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 3],
]) blocked.addSubnet(address, prefix, "ipv4")
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]) {
  blocked.addSubnet(address, prefix, "ipv6")
}
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")

export function isPublicAddress(address) {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, "ipv4")
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6")
}

export async function fetchPublicHtml(rawUrl) {
  const url = new URL(rawUrl)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid URL")
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const literalFamily = isIP(hostname)
  if (literalFamily && !isPublicAddress(hostname)) throw new Error("Non-public address")

  return new Promise((resolve, reject) => {
    let request
    let finished = false
    const finish = (error, html) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (error) {
        request?.destroy()
        reject(error)
      } else resolve(html)
    }
    const timer = setTimeout(() => finish(new Error("Timed out")), 5000)
    const addresses = literalFamily
      ? Promise.resolve([{ address: hostname, family: literalFamily }])
      : dns.lookup(hostname, { all: true, verbatim: true })
    addresses.then((records) => {
      if (finished) return
      if (!records.length || records.some(({ address }) => !isPublicAddress(address))) throw new Error("Non-public address")
      const pinned = records[0]
      request = (url.protocol === "https:" ? https : http).get(url, {
        agent: false,
        family: pinned.family,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [pinned])
          else callback(null, pinned.address, pinned.family)
        },
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SanctumCove/1.0)", "Accept-Encoding": "identity" },
        maxHeaderSize: 16384,
      }, (response) => {
        response.on("error", (error) => finish(error))
        response.on("aborted", () => finish(new Error("Incomplete response")))
        // ponytail: deny redirects and compression; add per-hop validation/decompression limits if needed.
        if (response.statusCode < 200 || response.statusCode >= 300 ||
            (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") ||
            Number(response.headers["content-length"]) > 1_048_576) {
          finish(new Error("Unsupported response"))
          return
        }
        const chunks = []
        let size = 0
        response.on("data", (chunk) => {
          if (finished) return
          size += chunk.length
          if (size > 1_048_576) return finish(new Error("Response too large"))
          chunks.push(chunk)
        })
        response.on("end", () => finish(null, Buffer.concat(chunks).toString("utf8")))
      })
      request.on("error", (error) => finish(error))
    }).catch((error) => finish(error))
  })
}
