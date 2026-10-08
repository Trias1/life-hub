import assert from 'node:assert/strict'
import { test } from 'node:test'
import https from 'node:https'
import dns from 'node:dns/promises'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { fetchPublicHtml, isPublicAddress } from './safe-fetch.mjs'

test('rejects non-public addresses', () => {
  for (const address of ['0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '192.0.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '::', '::1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::a00:1', '2001::1', '2001:db8::1', '2002:7f00:1::', '3fff::1', 'invalid']) assert.equal(isPublicAddress(address), false, address)
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true)
})

test('rejects unsafe URLs', async () => {
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'http://2130706433', 'http://0x7f000001', 'http://[::ffff:127.0.0.1]']) await assert.rejects(fetchPublicHtml(url))
})

test('DNS is pinned; redirects, oversized bodies, encoding and failures rejected', async (context) => {
  const lookup = context.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }])
  let scenario = 'ok'
  let destroyed = false
  context.mock.method(https, 'get', (url, options, callback) => {
    assert.equal(url.hostname, 'example.com')
    assert.equal(options.agent, false)
    options.lookup('example.com', {}, (error, address, family) => {
      assert.equal(error, null)
      assert.equal(address, '8.8.8.8')
      assert.equal(family, 4)
    })
    options.lookup('example.com', { all: true }, (error, addresses) => {
      assert.equal(error, null)
      assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }])
    })
    const request = new EventEmitter()
    request.destroy = () => { destroyed = true }
    queueMicrotask(() => {
      if (scenario === 'network') return request.emit('error', new Error('network'))
      const response = new EventEmitter()
      response.statusCode = scenario === 'redirect' ? 302 : 200
      response.headers = scenario === 'encoded' ? { 'content-encoding': 'gzip' } : {}
      callback(response)
      if (scenario === 'aborted') return response.emit('aborted')
      response.emit('data', Buffer.from(scenario === 'large' ? 'x'.repeat(1_048_577) : '<title>Example</title>'))
      response.emit('end')
    })
    return request
  })
  assert.equal(await fetchPublicHtml('https://example.com'), '<title>Example</title>')
  assert.equal(lookup.mock.callCount(), 1)
  for (scenario of ['redirect', 'large', 'encoded', 'aborted', 'network']) {
    destroyed = false
    await assert.rejects(fetchPublicHtml('https://example.com'))
    assert.equal(destroyed, true)
  }
})

test('deadline includes DNS and blocks late connections', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let resolveDns
  context.mock.method(dns, 'lookup', () => new Promise((resolve) => { resolveDns = resolve }))
  context.mock.method(https, 'get', () => assert.fail('late connection'))
  const pending = assert.rejects(fetchPublicHtml('https://example.com'), /Timed out/)
  context.mock.timers.tick(5000)
  await pending
  resolveDns([{ address: '8.8.8.8', family: 4 }])
  await Promise.resolve()
})

test('route authenticates before fetching and preserves response shape', () => {
  const route = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
  assert.match(route, /if \(!context\).*status: 401/)
  assert.ok(route.indexOf('await getWorkspaceContext()') < route.indexOf('await fetchPublicHtml('))
  assert.match(route, /json\(\{ title, description \}\)/)
})
