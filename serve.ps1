# Server statis sederhana untuk pengembangan lokal (tanpa Node/Python). Jalankan: powershell -File serve.ps1
param([int]$Port = 8765)
$root = $PSScriptRoot
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.sql'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "MathLens dev server: http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $p = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($p.StartsWith($root) -and (Test-Path $p -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($p)
      $ext = [IO.Path]::GetExtension($p).ToLower()
      $c.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $c.Response.Headers.Add('Cache-Control', 'no-store')
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
