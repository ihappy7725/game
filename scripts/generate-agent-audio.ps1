$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$missions = Get-Content -LiteralPath (Join-Path $projectRoot 'src/data/agent-missions.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$audioDirectory = Join-Path $projectRoot 'public/audio/agent'
New-Item -ItemType Directory -Path $audioDirectory -Force | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    # 외부 서비스와 재생 장치를 사용하지 않고 WAV 파일로만 합성합니다.
    $english = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
    if (-not $english) { throw '오프라인 영어 음성이 설치되어 있지 않습니다.' }
    $synth.SelectVoice($english.VoiceInfo.Name)
    $synth.Rate = 0
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    foreach ($mission in $missions) {
        if ($mission.id -notmatch '^[a-z-]+$') { throw '음성 파일 식별자를 확인하세요.' }
        $target = Join-Path $audioDirectory ($mission.id + '.wav')
        $synth.SetOutputToWaveFile($target, $format)
        $synth.Speak([string]$mission.transcript)
        $synth.SetOutputToNull()
        Write-Output ($mission.id + ': ' + (Get-Item -LiteralPath $target).Length + ' bytes')
    }
} finally { $synth.Dispose() }
