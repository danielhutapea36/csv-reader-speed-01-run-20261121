# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/danielhutapea36/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/danielhutapea36/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it reads broken CSV files
exactly the way csv-reader does — same `{columns, rows, errors}` for every
input, including stray CRs, unterminated quotes, quote junk, and short/long
rows — but in about a third of the CPU time.

## The idea

csv-reader 1.0.0 reads one character at a time and builds every field a
character at a time. Most records in practice are plain lines: no quote, no
stray CR. So this reader takes a whole record at once — one `indexOf` for the
line break, one `split(',')` for its fields — and only falls back to a
field-by-field reader for a line that holds a quote or a stray CR. That
fallback itself jumps between delimiters with `indexOf` and copies whole
spans with `slice`, so it never goes character by character either. The
semantics are csv-reader's own, reimplemented from its documented policy:
BOM dropped, records end at LF/CRLF, blank lines are no records, stray CRs
dropped with a `stray_cr` error, quoted fields run to the next non-doubled
quote with `""` as one quote and CRLF/lone CR inside read as LF, junk after
a closing quote appended as it stands (`quote_junk`), an unterminated quote
read as a literal with the text after it re-read as unquoted
(`unterminated_quote`), fields kept as strings, rows padded (`short_row`) or
cut (`long_row`) to the first record's width, errors `{code, line, row}` in
the order met.

## Layout

- `solve.js` — the entry: an ES module whose `run(input)` returns
  csv-reader's answer for `{text, header}`. Dependency-free, no state kept
  between calls.
- `main.ts` — the program the harness runs: reads every case from
  `/input/cases.json`, answers each with `run`, writes
  `/output/answers.json`. Turns V8's incremental marking off first, as the
  house baseline does.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<dir for answers.json> node main.ts
```

Node 22, JavaScript/TypeScript only, nothing to install, no WebAssembly,
native addon, or prebuilt binary.

## Verification

Checked against csv-reader 1.0.0 (the kit's oracle) on the competition's
practice set and on hand-written edge cases covering every broken-row rule:

- Practice set: **6/6 cases identical** to the reference answers.
- Edge cases: **42/42 identical**, including BOM-only input, CRLF files,
  stray CRs mid-field and at EOF, lone CRs and CRLFs inside quotes,
  unterminated quotes at EOF and spanning lines, doubled quotes, quote junk
  (including junk holding a stray CR), empty quoted fields, short/long rows,
  lines holding only stray CRs, and a file of CRs with no LF at all.
- Speed on the practice set (6 cases, ~10.2 MB of CSV, `run()` CPU time,
  trimmed of warm-up, 9 rounds): this reader ~0.25 s vs csv-reader 1.0.0
  ~0.70 s — about **2.5× faster**. End to end through `main.ts`
  (including JSON parsing and writing answers): ~0.85 s vs ~1.9 s.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
