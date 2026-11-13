import assert from "node:assert/strict"
import test from "node:test"
import { inlineHtml, markdownToNoteHtml, plainTextToHtml, titleFromFileName } from "./markdown-note.mjs"

test("the first # heading becomes the title; other headings stay for the outline", () => {
  const { title, html, headings } = markdownToNoteHtml("# Ops Notes\n\n## 1. Restart\nText\n### Detail\n#### Deeper")
  assert.equal(title, "Ops Notes")
  assert.equal(html, "<h2>1. Restart</h2><p>Text</p><h3>Detail</h3><h3>Deeper</h3>")
  assert.equal(headings, 3)
})

test("fenced code keeps its text, language and indentation, and is escaped", () => {
  const { html } = markdownToNoteHtml("1. Step\n    ```bash\n    echo <b>$i</b>\n      indented\n    ```\n2. Next")
  assert.equal(html, '<ol><li><p>Step</p><pre><code class="language-bash">echo &lt;b&gt;$i&lt;/b&gt;\n  indented</code></pre></li><li><p>Next</p></li></ol>')
  assert.match(markdownToNoteHtml("```jsx\nx\n```").html, /class="language-javascript"/)
  assert.match(markdownToNoteHtml("```weird\nx\n```").html, /^<pre><code>x<\/code><\/pre>$/)
})

test("lists nest by indentation and switch type", () => {
  const { html } = markdownToNoteHtml("- a\n  - b\n- c\n1. one")
  assert.equal(html, "<ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ul><ol><li><p>one</p></li></ol>")
})

test("tables become one list item per row", () => {
  const { html } = markdownToNoteHtml("| Task | Status | Ticket |\n|---|---|---|\n| Fix DB | Closed | – |\n| Add **alert** | Open | [123](https://example.com/123) |")
  assert.equal(html, '<ul><li><p><strong>Fix DB</strong> — Status: Closed</p></li><li><p><strong>Add <strong>alert</strong></strong> — Status: Open · Ticket: <a href="https://example.com/123">123</a></p></li></ul>')
})

test("quotes, rules and inline formatting", () => {
  const { html } = markdownToNoteHtml("> ⚠️ Keep this safe.\n\n---\n\nUse `kubectl` with **care** and *calm*.")
  assert.equal(html, "<blockquote><p>⚠️ Keep this safe.</p></blockquote><hr><p>Use <code>kubectl</code> with <strong>care</strong> and <em>calm</em>.</p>")
})

test("only https and mailto links survive; raw HTML is text", () => {
  assert.doesNotMatch(inlineHtml("[x](javascript:alert(1))"), /href|javascript:/)
  assert.equal(inlineHtml("[x](http://plain.example)"), "x")
  assert.equal(inlineHtml("see https://a.example/p?q=1."), 'see <a href="https://a.example/p?q=1">https://a.example/p?q=1</a>.')
  assert.equal(inlineHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
  assert.equal(inlineHtml("[](https://a.example)"), '<a href="https://a.example">https://a.example</a>')
  assert.doesNotMatch(markdownToNoteHtml("<script>alert(1)</script>").html, /<script/)
})

test("snake_case and paths are not turned into italics", () => {
  assert.equal(inlineHtml("nova_libvirt and /var/lib/config_data"), "nova_libvirt and /var/lib/config_data")
})

test("file names make readable titles", () => {
  assert.equal(titleFromFileName("TKP-Ops-Notes.md"), "TKP Ops Notes")
  assert.equal(titleFromFileName(".md"), "Imported note")
})

test("plain text keeps paragraphs and line breaks, escaped", () => {
  assert.equal(plainTextToHtml("Line one\nLine <two>\n\n\nNext"), "<p>Line one<br>Line &lt;two&gt;</p><p>Next</p>")
})
