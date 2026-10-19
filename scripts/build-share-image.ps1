# Render a static sharing card from the existing brand icon; no deployment dependency.
param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$OutputPath = (Join-Path $ProjectRoot 'public/brand/share-card.png')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 1200,630
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$logo = [System.Drawing.Image]::FromFile((Join-Path $ProjectRoot 'public/brand/app-icon-512.png'))
$background = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.Point 0,0),
    (New-Object System.Drawing.Point 1200,630),
    [System.Drawing.Color]::FromArgb(13,20,48),
    [System.Drawing.Color]::FromArgb(19,48,58)
)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(248,250,255))
$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,226,163))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(177,199,216))
$brandFont = New-Object System.Drawing.Font 'Arial',54,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$titleFont = New-Object System.Drawing.Font 'Malgun Gothic',38,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$bodyFont = New-Object System.Drawing.Font 'Malgun Gothic',24,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$smallFont = New-Object System.Drawing.Font 'Arial',21,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.FillRectangle($background,0,0,1200,630)
    $graphics.DrawImage($logo,64,94,442,442)
    $graphics.DrawString('LEARN  /  PLAY  /  GROW',$smallFont,$muted,560,100)
    $graphics.DrawString('TOEFL Union',$brandFont,$gold,555,155)
    $graphics.DrawString('공부와 게임으로',$titleFont,$white,556,255)
    $graphics.DrawString('함께 성장하는 영어',$titleFont,$white,556,312)
    $graphics.DrawString('읽기 · 듣기 · 쓰기 · 말하기',$bodyFont,$muted,558,402)
    $graphics.DrawString('toefl-union.vercel.app',$smallFont,$muted,560,503)
    $bitmap.Save($OutputPath,[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    foreach ($resource in @($smallFont,$bodyFont,$titleFont,$brandFont,$muted,$gold,$white,$background,$logo,$graphics,$bitmap)) { $resource.Dispose() }
}
Write-Output 'Created sharing card (1200 x 630)'
