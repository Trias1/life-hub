import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/components/note-composer.tsx', import.meta.url), 'utf8')
assert.ok(source.includes('<iframe'), 'Preview must use an iframe')
assert.ok(source.includes('sandbox=' + String.fromCharCode(34, 34)))
assert.ok(source.includes('title=' + String.fromCharCode(34) + 'Note preview' + String.fromCharCode(34)))
assert.ok(source.includes('height={240}'))
assert.ok(source.includes('srcDoc={'))
assert.ok(source.includes('default-src ' + String.fromCharCode(39) + 'none' + String.fromCharCode(39)))
assert.ok(source.indexOf('Content-Security-Policy') < source.indexOf('$' + '{content ||'))
assert.ok(!source.includes('dangerouslySetInnerHTML'))
console.log('Note preview self-check passed')
