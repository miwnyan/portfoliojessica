param(
  [string]$InputGif = (Join-Path $PSScriptRoot '..\assets\coelhinho-base.gif'),
  [string]$OutputGif = (Join-Path $PSScriptRoot '..\assets\coelhinho.gif'),
  [string]$StaticPng = (Join-Path $PSScriptRoot '..\assets\coelhinho-estatico.png')
)

$ErrorActionPreference = 'Stop'

function Get-TintedRgb {
  param([int]$Red, [int]$Green, [int]$Blue)

  # O preto é a cor armazenada no índice transparente do GIF.
  if ($Red -eq 0 -and $Green -eq 0 -and $Blue -eq 0) {
    return 0
  }

  $luminance = 0.2126 * $Red + 0.7152 * $Green + 0.0722 * $Blue
  $anchors = @(
    @{ L = 0;   C = @(62, 34, 52) },
    @{ L = 70;  C = @(99, 54, 79) },
    @{ L = 135; C = @(143, 85, 120) },
    @{ L = 180; C = @(188, 127, 163) },
    @{ L = 218; C = @(239, 173, 208) },
    @{ L = 255; C = @(249, 206, 225) }
  )

  $low = $anchors[0]
  $high = $anchors[$anchors.Count - 1]
  for ($index = 0; $index -lt $anchors.Count - 1; $index++) {
    if ($luminance -le $anchors[$index + 1].L) {
      $low = $anchors[$index]
      $high = $anchors[$index + 1]
      break
    }
  }

  $span = $high.L - $low.L
  $mix = if ($span -eq 0) { 0 } else { ($luminance - $low.L) / $span }
  $result = for ($channel = 0; $channel -lt 3; $channel++) {
    [Math]::Round($low.C[$channel] + ($high.C[$channel] - $low.C[$channel]) * $mix)
  }

  return (($result[0] -shl 16) -bor ($result[1] -shl 8) -bor $result[2])
}

function Set-TintedPalette {
  param(
    [byte[]]$Bytes,
    [int]$Offset,
    [int]$ColorCount
  )

  for ($index = 0; $index -lt $ColorCount; $index++) {
    $colorOffset = $Offset + $index * 3
    $rgb = Get-TintedRgb $Bytes[$colorOffset] $Bytes[$colorOffset + 1] $Bytes[$colorOffset + 2]
    $Bytes[$colorOffset] = [byte](($rgb -shr 16) -band 255)
    $Bytes[$colorOffset + 1] = [byte](($rgb -shr 8) -band 255)
    $Bytes[$colorOffset + 2] = [byte]($rgb -band 255)
  }
}

$resolvedInput = (Resolve-Path -LiteralPath $InputGif).Path
$bytes = [IO.File]::ReadAllBytes($resolvedInput)
$signature = [Text.Encoding]::ASCII.GetString($bytes, 0, 6)
if ($signature -notin @('GIF87a', 'GIF89a')) {
  throw "O arquivo de entrada não é um GIF válido: $resolvedInput"
}

$paletteCount = 0
$packedScreen = $bytes[10]
$position = 13
if (($packedScreen -band 0x80) -ne 0) {
  $globalColors = 1 -shl (($packedScreen -band 0x07) + 1)
  Set-TintedPalette $bytes $position $globalColors
  $position += $globalColors * 3
  $paletteCount++
}

while ($position -lt $bytes.Length) {
  $blockType = $bytes[$position]

  if ($blockType -eq 0x3B) {
    break
  }

  if ($blockType -eq 0x21) {
    # Extensão GIF: rótulo seguido por uma sequência de sub-blocos.
    $position += 2
    while ($position -lt $bytes.Length) {
      $blockLength = $bytes[$position]
      $position++
      if ($blockLength -eq 0) { break }
      $position += $blockLength
    }
    continue
  }

  if ($blockType -eq 0x2C) {
    if ($position + 9 -ge $bytes.Length) { throw 'Descritor de imagem GIF incompleto.' }
    $packedImage = $bytes[$position + 9]
    $position += 10

    if (($packedImage -band 0x80) -ne 0) {
      $localColors = 1 -shl (($packedImage -band 0x07) + 1)
      Set-TintedPalette $bytes $position $localColors
      $position += $localColors * 3
      $paletteCount++
    }

    # Tamanho mínimo do código LZW e dados de imagem em sub-blocos.
    $position++
    while ($position -lt $bytes.Length) {
      $blockLength = $bytes[$position]
      $position++
      if ($blockLength -eq 0) { break }
      $position += $blockLength
    }
    continue
  }

  throw ('Bloco GIF inesperado 0x{0:X2} no byte {1}.' -f $blockType, $position)
}

$outputDirectory = Split-Path -Parent $OutputGif
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
[IO.File]::WriteAllBytes($OutputGif, $bytes)

# Gera o primeiro quadro estático para prefers-reduced-motion sem redesenhar o sprite.
Add-Type -AssemblyName System.Drawing
$gif = [Drawing.Image]::FromFile((Resolve-Path -LiteralPath $OutputGif).Path)
try {
  [void]$gif.SelectActiveFrame([Drawing.Imaging.FrameDimension]::Time, 0)
  $frame = New-Object Drawing.Bitmap $gif
  try {
    $frame.Save($StaticPng, [Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $frame.Dispose()
  }
}
finally {
  $gif.Dispose()
}

Write-Output "GIF recolorido: $OutputGif"
Write-Output "Quadro estático: $StaticPng"
Write-Output "Tabelas de cor atualizadas: $paletteCount"
