/** @param {string} value @returns {string[][]} */
export function parseCsv(value) {
  let rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') { field += '"'; index += 1 }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ",") { row = [...row, field]; field = "" }
    else if (character === "\n") { const nextRow = [...row, field]; if (nextRow.some(Boolean)) rows = [...rows, nextRow]; row = []; field = "" }
    else if (character !== "\r") field += character
  }

  if (quoted) throw new Error("Invalid CSV: unclosed quoted field")
  const finalRow = [...row, field]
  if (finalRow.some(Boolean)) rows = [...rows, finalRow]
  return rows
}
