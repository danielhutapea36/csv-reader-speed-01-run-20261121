// solve.js — a fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Returns, for every input {text, header}, exactly the answer csv-reader 1.0.0
// returns: {columns, rows, errors}. Written from scratch from the published
// broken-row policy (RULES.txt of the kit); no code copied from the reference.
//
// Speed comes from three things the reference does not do:
//   1. Fields are slices of the input, not built one character at a time.
//      An unquoted field is one slice unless a stray CR splits it; a quoted
//      field jumps from quote to quote with indexOf instead of walking chars.
//   2. Characters are read as codes (charCodeAt), never as 1-char strings.
//   3. Line breaks inside a quoted field are converted with one replace,
//      only on the rare segments that actually hold one.
//
// Policy (identical to the reference):
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next quote that is not doubled
//     ("" inside it is one quote; each CRLF or lone CR inside it is read as
//     LF); what follows its closing quote, up to the next comma or line
//     break, is appended as it stands (quote_junk, when the field ends);
//     a quote that never closes is a literal character and the text after
//     it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds
//     the records after it, each padded with "" (short_row) or cut
//     (long_row) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record
//     starts on, row its record's index in rows (null for the header).

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Reads unquoted characters onto `init` up to the next comma or line
  // break: a CR not followed by LF is dropped (stray_cr). Returns the field
  // and how it ended. Only characters kept are appended to `init`.
  function readUnquoted(init) {
    let parts = null; // segments kept before each dropped stray CR
    let start = pos;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 44) { // ,
        const value = parts === null
          ? (start === pos ? init : init + text.slice(start, pos))
          : init + parts.join('') + text.slice(start, pos);
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) { // LF
        const value = parts === null
          ? (start === pos ? init : init + text.slice(start, pos))
          : init + parts.join('') + text.slice(start, pos);
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13) { // CR
        if (text.charCodeAt(pos + 1) === 10) { // CRLF
          const value = parts === null
            ? (start === pos ? init : init + text.slice(start, pos))
            : init + parts.join('') + text.slice(start, pos);
          pos += 2;
          line += 1;
          return { value, ended: LINE_BREAK };
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [];
        parts.push(text.slice(start, pos));
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    const value = parts === null
      ? (start === pos ? init : init + text.slice(start, pos))
      : init + parts.join('') + text.slice(start, pos);
    return { value, ended: END };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let parts = null; // segments of the field's value
    let closed = false;
    while (pos < len) {
      const q = text.indexOf('"', pos);
      if (q === -1) break; // no quote left: it never closes
      if (q > pos) {
        const nl = text.indexOf('\n', pos);
        const cr = text.indexOf('\r', pos);
        if ((nl === -1 || nl >= q) && (cr === -1 || cr >= q)) {
          if (parts === null) parts = [];
          parts.push(text.slice(pos, q));
        } else {
          // CRLF and a lone CR inside quotes are each one LF.
          const seg = text.slice(pos, q);
          const breaks = seg.match(/\r\n|\r|\n/g);
          if (breaks !== null) line += breaks.length;
          if (parts === null) parts = [];
          parts.push(seg.replace(/\r\n?/g, '\n'));
        }
      }
      if (text.charCodeAt(q + 1) === 34) { // "" inside it is one quote
        if (parts === null) parts = [];
        parts.push('"');
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      closed = true;
      break;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    const value = parts === null ? '' : parts.join('');
    if (pos >= len) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) { // ,
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) { // LF
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) { // CRLF
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    const junk = readUnquoted(value);
    if (junk.value.length > value.length) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { // LF
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) { // CRLF
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
