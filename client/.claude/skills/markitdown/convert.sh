#!/usr/bin/env bash
# markitdown driver - converts PDF / Office / images / HTML / CSV / etc. to Markdown.
#
# Installs into a dedicated venv at .claude/skills/markitdown/.venv rather than
# the system/Homebrew Python site-packages, because both are PEP 668
# "externally managed" on this machine and refuse a bare `pip install`. A venv
# also gives a fixed, known interpreter path instead of guessing at PATH.
#
# USAGE
#   convert.sh <input-file> [output.md]   # convert one file
#   convert.sh <input-file> --stdout      # print Markdown to stdout
#   convert.sh --selftest                 # sample + convert + assert
#   convert.sh --install                  # create venv + pip install markitdown[all]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python3"
# Silences pydub's harmless "Couldn't find ffmpeg or avconv" warning; ffmpeg is
# only needed for audio transcription, not PDF/Office/image/HTML text.
export PYTHONWARNINGS=ignore

usage() {
  cat <<'EOF'
Usage:
  convert.sh <input-file> [output.md]   # convert one file
  convert.sh <input-file> --stdout      # print Markdown to stdout
  convert.sh --selftest                 # sample + convert + assert
  convert.sh --install                  # create venv + pip install markitdown[all]
EOF
}

find_base_python() {
  # markitdown needs Python 3.10+; macOS's built-in system python3 (Command
  # Line Tools) is stuck on 3.9, so a newer interpreter has to come from
  # Homebrew (brew install python@3.12) or similar.
  for cand in python3.13 python3.12 python3.11 python3.10; do
    if command -v "$cand" >/dev/null 2>&1; then
      command -v "$cand"
      return 0
    fi
  done
  return 1
}

cmd_install() {
  if [ ! -x "$VENV_PY" ]; then
    local base_py
    if ! base_py="$(find_base_python)"; then
      echo "No Python 3.10+ found. Run: brew install python@3.12" >&2
      exit 1
    fi
    "$base_py" -m venv "$VENV_DIR"
  fi
  "$VENV_PY" -m pip install --upgrade pip >/dev/null
  "$VENV_PY" -m pip install "markitdown[all]"
}

require_venv() {
  if [ ! -x "$VENV_PY" ] || ! "$VENV_PY" -c "import markitdown" >/dev/null 2>&1; then
    echo "markitdown not installed. Run: $0 --install" >&2
    exit 1
  fi
}

cmd_selftest() {
  require_venv
  local tmp_html tmp_md md
  tmp_html="$(mktemp -t markitdown_selftest).html"
  tmp_md="${tmp_html%.html}.md"
  cat > "$tmp_html" <<'HTML'
<h1>Quiz Seed</h1>
<table><tr><th>Q</th><th>Answer</th></tr><tr><td>2+2</td><td>4</td></tr></table>
<p>Unicode check: مصر</p>
HTML
  "$VENV_PY" -m markitdown "$tmp_html" -o "$tmp_md"
  md="$(cat "$tmp_md")"
  if [[ "$md" == *"# Quiz Seed"* && "$md" == *"|"* && "$md" == *"مصر"* ]]; then
    echo "SELF-TEST PASS - converted HTML (heading + table + Arabic) at $tmp_md"
  else
    echo "SELF-TEST FAIL - output did not contain expected Markdown:" >&2
    echo "$md" >&2
    exit 1
  fi
}

cmd_convert() {
  require_venv
  local input="$1" out="${2:-}" size
  [ -f "$input" ] || { echo "Input not found: $input" >&2; exit 1; }
  [ -n "$out" ] || out="${input%.*}.md"
  "$VENV_PY" -m markitdown "$input" -o "$out"
  size=$(wc -c < "$out" | tr -d ' ')
  echo "OK - wrote $out ($size bytes, UTF-8)"
}

cmd_stdout() {
  require_venv
  local input="$1"
  [ -f "$input" ] || { echo "Input not found: $input" >&2; exit 1; }
  "$VENV_PY" -m markitdown "$input"
}

case "${1:-}" in
  ""|-h|--help)
    usage
    [ -n "${1:-}" ]
    ;;
  --install) cmd_install ;;
  --selftest) cmd_selftest ;;
  *)
    if [ "${2:-}" = "--stdout" ]; then
      cmd_stdout "$1"
    else
      cmd_convert "$1" "${2:-}"
    fi
    ;;
esac
