---
name: markitdown
description: Convert PDF, Word, PowerPoint, Excel, images, HTML, CSV, JSON, EPub, ZIP and audio files to Markdown using Microsoft markitdown. Use when asked to convert/extract/ingest a document to Markdown, turn a PDF/DOCX/XLSX into text, OCR or read a file's contents, or seed app content from a document.
---

# markitdown — document → Markdown

[Microsoft markitdown](https://github.com/microsoft/markitdown) converts many file
types (PDF, DOCX, PPTX, XLSX/XLS, images, audio, HTML, CSV/JSON/XML, ZIP, EPub,
YouTube URLs) into LLM-friendly Markdown — preserving headings, tables, and
non-Latin text (Arabic verified).

It's a **Python** tool. macOS's built-in system Python (Command Line Tools) is
stuck on 3.9, and markitdown needs 3.10+, so a newer interpreter comes from
Homebrew. The driver is [convert.sh](convert.sh) — it installs markitdown into
a dedicated venv at `.claude/skills/markitdown/.venv` (gitignored) rather than
the Homebrew site-packages, which Homebrew marks "externally managed" and
refuses a bare `pip install` into.

All paths below are relative to the repo root. Verified on macOS (Darwin,
Apple Silicon), Homebrew Python 3.12.14, markitdown 0.1.7.

## Run (agent path) — use the driver

```bash
# Convert one file (writes <name>.md next to the input, or a chosen output path)
.claude/skills/markitdown/convert.sh path/to/file.pdf out.md

# Print Markdown to stdout instead of a file
.claude/skills/markitdown/convert.sh path/to/file.pdf --stdout

# Smoke test (creates a sample HTML, converts, asserts heading+table+Arabic)
.claude/skills/markitdown/convert.sh --selftest
```

`--selftest` prints `SELF-TEST PASS ...` and exits 0 when the toolchain is
healthy. A real conversion prints e.g. `OK - wrote out.md (48273 bytes, UTF-8)`.

## Prerequisites (already done on this machine; here for a fresh box)

```bash
# 1. Python 3.10+ via Homebrew (the system python3 is too old)
brew install python@3.12

# 2. markitdown with all format extras — via the driver:
.claude/skills/markitdown/convert.sh --install
```

`--install` creates `.claude/skills/markitdown/.venv` off the newest Homebrew
Python it finds (3.13 → 3.10) and runs `pip install "markitdown[all]"` inside
it. Extras pulled in: pdf, docx, pptx, xlsx/xls, outlook, audio & YouTube
transcription, Azure Document Intelligence. It's a normal `venv` + `pip`
install — safe to delete `.venv` and re-run `--install` if it ever gets into
a bad state.

## Direct invocation (no driver)

```bash
py=".claude/skills/markitdown/.venv/bin/python3"
PYTHONWARNINGS=ignore "$py" -m markitdown path/to/file.pdf -o out.md
```

Python API (verified):

```bash
"$py" -c "from markitdown import MarkItDown; md=MarkItDown(enable_plugins=False); print(md.convert('path/to/file.pdf').text_content[:60])"
```

## Gotchas (learned the hard way here)

- **Homebrew's global site-packages is PEP 668 "externally managed."** A bare
  `pip install markitdown` against `/opt/homebrew/bin/python3.12` fails with
  `externally-managed-environment`. The driver sidesteps this entirely with a
  venv — don't try to install straight into the Homebrew interpreter.
- **Never pipe a binary file through a shell text pipeline** (e.g.
  `cat x.pdf | markitdown`) — pass the path, or use `-o`/`--stdout`, which the
  driver already does.
- **stderr ≠ failure.** markitdown imports pydub, which warns `Couldn't find
  ffmpeg or avconv` on stderr when audio support is unused. The driver sets
  `PYTHONWARNINGS=ignore` so this stays out of the way; it's not fatal either
  way since the script only fails on a non-zero exit code, unlike PowerShell's
  stricter stderr-as-error behavior on the original Windows port of this
  driver.
- **No mojibake workaround needed here.** Unlike Windows PowerShell 5.1 (which
  parses `.ps1` as ANSI and mangles non-ASCII source literals), bash and
  macOS's Terminal are UTF-8 native end to end — Arabic prints correctly both
  in the source and at the console, no codepoint-building trick required.
- **A stray first run under this harness's sandbox was killed (exit 137)**
  with no error output; re-running succeeded immediately and a `time -l`
  check showed a ~160MB peak footprint, well under any real memory limit — if
  `--selftest` or a conversion is killed silently, just retry once before
  assuming something is actually broken.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Python 3.10+ found` | `brew install python@3.12`, then `--install`. |
| `markitdown not installed. Run: ... --install` | `.claude/skills/markitdown/convert.sh --install` |
| `externally-managed-environment` pip error | You installed straight into Homebrew's python instead of using the driver's venv. |
| Command killed with no output (exit 137) | Sandbox flake seen once during setup — retry the same command. |
| Want audio (`.mp3`/`.wav`) transcription | `brew install ffmpeg` so pydub can decode it. |
