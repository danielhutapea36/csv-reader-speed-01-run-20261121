# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/danielhutapea36/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/danielhutapea36/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it returns exactly the
same `{columns, rows, errors}` for every input — including stray CRs,
unterminated quotes, quote junk, and short/long rows — but reads with slices
and quote-to-quote jumps instead of one character at a time.

## The idea

csv-reader 1.0.0 builds every field one character at a time. This reader
copies whole spans instead: an unquoted field is a single slice unless a
stray CR splits it, and a quoted field jumps from quote to quote with
`indexOf`. Characters are compared as codes (`charCodeAt`), never as
one-character strings, and line breaks inside a quoted field are converted
with one replace, only on segments that actually hold one. The semantics are
csv-reader's own, reimplemented from its documented policy: BOM dropped,
records end at LF/CRLF, blank lines are no records, stray CRs dropped with a
`stray_cr` error, quoted fields run to the next non-doubled quote with `""`
as one quote and CRLF/lone CR inside read as LF, junk after a closing quote
appended as it stands (`quote_junk`), an unterminated quote read as a literal
with the text after it re-read as unquoted (`unterminated_quote`), fields
kept as strings, rows padded (`short_row`) or cut (`long_row`) to the first
record's width, errors `{code, line, row}` in the order met.

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

---

<sub>Entered on [make.fun](https://make.fun/?ref=d7fzh6a3&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
