<#
  markitdown driver - converts PDF / Office / images / HTML / CSV / etc. to Markdown.

  Resolves the real Python interpreter by full path so it never depends on PATH
  (the Microsoft Store "python.exe" App Execution Alias shadows the real one on
  this machine, and freshly-installed PATH entries don't reach already-running
  shells). markitdown's own -o flag writes UTF-8, so non-Latin text (Arabic, ...)
  round-trips correctly.

  This script is intentionally pure ASCII: Windows PowerShell 5.1 parses .ps1 as
  ANSI, so any non-ASCII literal in the source would be corrupted. Unicode test
  data is built from codepoints at runtime instead.

  USAGE
    powershell -File convert.ps1 <input-file> [output.md]   # convert one file
    powershell -File convert.ps1 <input-file> -Stdout       # print Markdown to stdout
    powershell -File convert.ps1 -SelfTest                  # sample + convert + assert
    powershell -File convert.ps1 -Install                   # pip install markitdown[all]

  NOTE: do NOT pipe binary files through the PowerShell pipeline
  (Get-Content x.pdf | markitdown) - PS mangles bytes. Pass the path instead.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)] [string]$Path,
  [Parameter(Position = 1)] [string]$OutPath,
  [switch]$Stdout,
  [switch]$SelfTest,
  [switch]$Install
)

# Continue (not Stop): a native command's stderr is wrapped as a terminating
# error under Stop in Windows PowerShell 5.1, even with 2>$null. We check
# $LASTEXITCODE explicitly instead, and use explicit `throw` for our own checks.
$ErrorActionPreference = 'Continue'
# Silence pydub's "Couldn't find ffmpeg" RuntimeWarning at the source (we don't
# do audio); this keeps native stderr clean so exit codes stay trustworthy.
$env:PYTHONWARNINGS = 'ignore'

function Get-Python {
  # Prefer the real per-user/system installs; never the WindowsApps alias stub.
  $globs = @(
    "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
    "$env:ProgramFiles\Python*\python.exe",
    "${env:ProgramFiles(x86)}\Python*\python.exe"
  )
  foreach ($g in $globs) {
    $hit = Get-ChildItem $g -ErrorAction SilentlyContinue |
           Sort-Object FullName -Descending | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  throw "Real Python interpreter not found. Run: winget install --id Python.Python.3.12 --scope user --silent"
}

$py = Get-Python

if ($Install) {
  & $py -m pip install "markitdown[all]"
  exit $LASTEXITCODE
}

# Confirm markitdown is importable before doing anything else.
& $py -c "import markitdown" 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "markitdown not installed for $py. Run: powershell -File convert.ps1 -Install"
}

if ($SelfTest) {
  # Build an Arabic word ("misr" = M-S-R) from codepoints so the source stays ASCII.
  $arabic = -join ([char]0x0645, [char]0x0635, [char]0x0631)
  $sample = Join-Path $env:TEMP 'markitdown_selftest.html'
  $html = "<h1>Quiz Seed</h1>`n<table><tr><th>Q</th><th>Answer</th></tr><tr><td>2+2</td><td>4</td></tr></table>`n<p>Unicode check: $arabic</p>`n"
  Set-Content -Path $sample -Value $html -Encoding UTF8

  $out = Join-Path $env:TEMP 'markitdown_selftest.md'
  & $py -m markitdown $sample -o $out 2>$null
  $md = Get-Content $out -Encoding UTF8 -Raw

  $ok = ($md -match '# Quiz Seed') -and ($md.Contains('|')) -and ($md.Contains($arabic))
  if ($ok) {
    Write-Host "SELF-TEST PASS - converted HTML (heading + table + Arabic) at $out"
    exit 0
  } else {
    Write-Host "SELF-TEST FAIL - output did not contain expected Markdown:"
    Write-Host $md
    exit 1
  }
}

if (-not $Path) { throw "Provide an input file. e.g. powershell -File convert.ps1 report.pdf" }
if (-not (Test-Path $Path)) { throw "Input not found: $Path" }

if ($Stdout) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  & $py -m markitdown $Path
  exit $LASTEXITCODE
}

if (-not $OutPath) {
  $OutPath = [System.IO.Path]::ChangeExtension((Resolve-Path $Path).Path, '.md')
}
& $py -m markitdown $Path -o $OutPath 2>$null
if ($LASTEXITCODE -ne 0) { throw "Conversion failed (exit $LASTEXITCODE)" }
$size = (Get-Item $OutPath).Length
Write-Host ("OK - wrote {0} ({1} bytes, UTF-8)" -f $OutPath, $size)
