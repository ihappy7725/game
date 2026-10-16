$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$words = Get-Content -LiteralPath (Join-Path $projectRoot 'src/data/shooter-words.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$audioDirectory = Join-Path $projectRoot 'public/audio/shooter'
New-Item -ItemType Directory -Path $audioDirectory -Force | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    # 설치된 영어 음성으로 파일만 생성하며 외부 서비스를 호출하지 않습니다.
    $english = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
    if (-not $english) { throw '오프라인 영어 음성이 필요합니다.' }
    $synth.SelectVoice($english.VoiceInfo.Name)
    $synth.Rate = 1
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    foreach ($word in $words) {
        if ($word -notmatch '^[a-z]+$') { throw '단어 식별자를 확인하세요.' }
        $synth.SetOutputToWaveFile((Join-Path $audioDirectory ($word + '.wav')), $format)
        $synth.Speak([string]$word)
        $synth.SetOutputToNull()
    }
} finally { $synth.Dispose() }
