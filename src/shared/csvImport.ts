export interface ParsedCsv {
  rows: Record<string, unknown>[]
}

const DELIMITERS = [',', ';', '\t', '|']

function decodeBuffer(buf: Buffer): string {
  const head = buf.subarray(0, 4)
  if (head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  if (head.length >= 2 && head[0] === 0xff && head[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }
  if (head.length >= 2 && head[0] === 0xfe && head[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return buf.toString('latin1')
  }
}

function countOutsideQuotes(line: string, target: string): number {
  let inQuotes = false
  let count = 0
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
    } else if (ch === target && !inQuotes) {
      count++
    }
  }
  return count
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0]
  let best = ','
  let bestCount = 0
  for (const delim of DELIMITERS) {
    const count = countOutsideQuotes(firstLine, delim)
    if (count > bestCount) {
      best = delim
      bestCount = count
    }
  }
  return best
}

function splitRecords(text: string, delim: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    record.push(field)
    field = ''
  }
  const pushRecord = () => {
    pushField()
    records.push(record)
    record = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      pushField()
    } else if (ch === '\n') {
      if (record.length > 0 || field.length > 0) pushRecord()
      else field = ''
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      if (record.length > 0 || field.length > 0) pushRecord()
      else field = ''
    } else {
      field += ch
    }
  }
  if (record.length > 0 || field.length > 0) pushRecord()
  return records
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

export function parseCsvBuffer(buf: Buffer): ParsedCsv {
  const text = decodeBuffer(buf)
  if (text.trim() === '') return { rows: [] }
  const delim = detectDelimiter(text)
  const records = splitRecords(text, delim)
    .filter((rec) => rec.some((f) => f.trim() !== ''))

  if (records.length === 0) return { rows: [] }

  const header = records[0].map(normalizeHeader)

  const rows: Record<string, unknown>[] = []
  for (const rec of records.slice(1)) {
    const obj: Record<string, unknown> = {}
    for (let i = 0; i < header.length; i++) {
      const key = header[i]
      if (!key || key in obj) continue
      obj[key] = rec[i] ?? ''
    }
    rows.push(obj)
  }
  return { rows }
}