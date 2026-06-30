param(
  [Parameter(Mandatory = $true)][string]$ConfigPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

if ($config.voiceName) {
  $synth.SelectVoice($config.voiceName)
}

if ($null -ne $config.rate) {
  $synth.Rate = [int]$config.rate
}

if ($null -ne $config.volume) {
  $synth.Volume = [int]$config.volume
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  22050,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)

$synth.SetOutputToWaveFile($config.outputPath, $format)

if ($config.ssml) {
  $synth.SpeakSsml($config.ssml)
} else {
  $synth.Speak($config.text)
}

$synth.Dispose()
