// A fast drop-in for make.fun's csv-reader 1.0.0.
//
// run(input) returns exactly what csv-reader 1.0.0 returns for {text, header}:
// {columns, rows, errors}. The reading policy, restated from the competition:
// a U+FEFF at the very start is dropped; a record ends at LF or CRLF and a line
// left with no characters is no record; outside quotes a CR not followed by LF
// is dropped (stray_cr); a field that opens with a quote runs to the next quote
// that is not doubled, "" inside it is one quote and each CRLF or lone CR
// inside it reads as LF; what follows its closing quote, up to the next comma
// or line break, is appended as it stands (quote_junk, when the field ends);
// a quote that never closes is a literal character and the text after it is
// read again as unquoted (unterminated_quote); a quote inside an unquoted field
// is a literal character; fields stay strings, never trimmed or converted;
// columns is the first record when header is true, else null; rows holds the
// records after it, each padded with "" (short_row, with fields: its count) or
// cut (long_row, with extra: the cut fields) to the first record's width; each
// error is {code, line, row}, in the order met, a field's quote_junk when the
// field ends and a record's short_row or long_row when the record ends, line
// the 1-based line its record starts on, row its record's index in rows (null
// for the header).
//
// How it is fast: most records are plain lines — no quote, no stray CR — so a
// record is taken whole with indexOf/slice/split instead of one character at a
// time. Only a line that holds a quote or a stray CR falls back to a field by
// field reader, which itself jumps between delimiters with indexOf and copies
// whole spans with slice. Nothing is kept from one call to the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

const CH_QUOTE = 34; // "
const CH_COMMA = 44; // ,
const CH_LF = 10; // \n
const CH_CR = 13; // \r
const CH_BOM = 0xfeff;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === CH_BOM) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Field readers report errors against these.
  let recordLine = 1;
  let recordRow = null;

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters from pos onto `value` up to the next comma or
  // line break: a CR not followed by LF is dropped (stray_cr). Returns the
  // field, how it ended, and how many characters were kept onto it.
  function readUnquoted(value) {
    let added = 0;
    while (pos < n) {
      const comma = text.indexOf(',', pos);
      const lf = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      // The nearest delimiter, if any.
      let next = -1;
      let kind = -1;
      if (comma !== -1 && (next === -1 || comma < next)) { next = comma; kind = 0; }
      if (lf !== -1 && (next === -1 || lf < next)) { next = lf; kind = 1; }
      if (cr !== -1 && (next === -1 || cr < next)) { next = cr; kind = 2; }
      if (next === -1) {
        if (pos < n) {
          value += text.slice(pos, n);
          added += n - pos;
          pos = n;
        }
        return { value, ended: END, added };
      }
      if (next > pos) {
        value += text.slice(pos, next);
        added += next - pos;
      }
      if (kind === 0) {
        pos = next + 1;
        return { value, ended: COMMA, added };
      }
      if (kind === 1) {
        pos = next + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // A CR: a line break when followed by LF, else dropped (stray_cr).
      if (text.charCodeAt(next + 1) === CH_LF) {
        pos = next + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      pushError('stray_cr');
      pos = next + 1;
    }
    return { value, ended: END, added };
  }

  // Copies text[from..to) onto `value`, reading each CRLF or lone CR inside
  // it as one LF and counting every line break it holds.
  function appendQuotedSpan(value, from, to) {
    const cr = text.indexOf('\r', from);
    const lf = text.indexOf('\n', from);
    if ((cr === -1 || cr >= to) && (lf === -1 || lf >= to)) {
      return value + text.slice(from, to);
    }
    let out = value;
    let p = from;
    while (p < to) {
      const nextCr = text.indexOf('\r', p);
      const nextLf = text.indexOf('\n', p);
      let next = -1;
      if (nextCr !== -1 && nextCr < to && (nextLf === -1 || nextLf >= to || nextCr < nextLf)) next = nextCr;
      else if (nextLf !== -1 && nextLf < to) next = nextLf;
      if (next === -1) {
        out += text.slice(p, to);
        break;
      }
      out += text.slice(p, next);
      out += '\n';
      line += 1;
      // A CRLF is one break: skip both characters; a lone CR or LF one.
      p = next + (text.charCodeAt(next) === CH_CR && text.charCodeAt(next + 1) === CH_LF ? 2 : 1);
    }
    return out;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        pushError('unterminated_quote');
        return readUnquoted('"');
      }
      value = appendQuotedSpan(value, pos, q);
      if (text.charCodeAt(q + 1) === CH_QUOTE) {
        // A doubled quote is one quote inside the field.
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      if (pos >= n) return { value, ended: END, added: 0 };
      const c = text.charCodeAt(pos);
      if (c === CH_COMMA) {
        pos += 1;
        return { value, ended: COMMA, added: 0 };
      }
      if (c === CH_LF) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK, added: 0 };
      }
      if (c === CH_CR && text.charCodeAt(pos + 1) === CH_LF) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK, added: 0 };
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      const junk = readUnquoted(value);
      if (junk.added > 0) pushError('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === CH_LF) {
        pos += 1;
        line += 1;
      } else if (c === CH_CR && text.charCodeAt(pos + 1) === CH_LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    let fields;
    let quoted = false;

    // Fast path: the rest of this line holds no quote and no stray CR, so
    // the record is the whole line and its fields are one split. A quote or
    // a CR anywhere before the line break sends the record to the slow path.
    const nl = text.indexOf('\n', pos);
    const segEnd = nl === -1 ? n : nl;
    const q = text.indexOf('"', pos);
    if (q === -1 || q >= segEnd) {
      let contentEnd = segEnd;
      if (nl !== -1 && segEnd > pos && text.charCodeAt(segEnd - 1) === CH_CR) contentEnd = segEnd - 1;
      const cr = text.indexOf('\r', pos);
      if (cr === -1 || cr >= contentEnd) {
        fields = contentEnd === pos ? [''] : text.slice(pos, contentEnd).split(',');
        pos = nl === -1 ? n : nl + 1;
        if (nl !== -1) line += 1;
      }
    }

    if (fields === undefined) {
      fields = [];
      let field;
      do {
        quoted = text.charCodeAt(pos) === CH_QUOTE;
        field = quoted ? readQuoted() : readUnquoted('');
        fields.push(field.value);
      } while (field.ended === COMMA);
    }

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
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
