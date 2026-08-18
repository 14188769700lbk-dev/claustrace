param(
  [string]$InputPath = "docs/demo-narration.ssml",
  [string]$OutputPath = "artifacts/ClauseTrace-narration.wav",
  [string]$Voice = "Microsoft Zira Desktop"
)

$ErrorActionPreference = "Stop"

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()

try {
  $synthesizer.SelectVoice($Voice)
  $synthesizer.Volume = 100
  $synthesizer.SetOutputToWaveFile($resolvedOutput)
  $synthesizer.SpeakSsml([IO.File]::ReadAllText($resolvedInput))
} finally {
  $synthesizer.Dispose()
}

$file = Get-Item -LiteralPath $resolvedOutput
[pscustomobject]@{
  path = $file.FullName
  bytes = $file.Length
  voice = $Voice
} | ConvertTo-Json -Compress
