import assert from 'node:assert/strict'
import { apiBucket } from '../src/lib/request-rate-limit.mjs'
assert.equal(apiBucket('/api/search'), 'search')

import { checkRequestLimit } from '../src/lib/request-rate-limit.mjs'
const fake = (result) => ({ rpc: async () => result })
const originalWarn = console.warn
console.warn = () => {}
assert.equal(await checkRequestLimit(fake({ data: null, error: { code: 'PGRST202' } }), 'search'), null)
console.warn = originalWarn
assert.equal((await checkRequestLimit(fake({ data: null, error: { code: '42501' } }), 'search')).status, 503)
assert.equal((await checkRequestLimit(fake({ data: { allowed: false, retry_after: 30 }, error: null }), 'search')).status, 429)
assert.equal(await checkRequestLimit(fake({ data: { allowed: true, retry_after: 0 }, error: null }), 'search'), null)
console.log('request rate limit checks passed')
