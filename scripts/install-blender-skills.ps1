# Windows: run from repo root:  powershell -ExecutionPolicy Bypass -File scripts\install-blender-skills.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Get-Command uvx -ErrorAction SilentlyContinue)) { throw "Install uv first: https://docs.astral.sh/uv/getting-started/installation/" }

foreach ($pair in @(@("$root\.claude\skills", "$HOME\.claude\skills"), @("$root\.agents\skills", "$HOME\.agents\skills"))) {
  New-Item -ItemType Directory -Force $pair[1] | Out-Null
  Copy-Item -Recurse -Force "$($pair[0])\*" $pair[1]
}

# Claude Desktop MCP (uvx needs cmd /c on Windows)
$cfg = "$env:APPDATA\Claude\claude_desktop_config.json"
New-Item -ItemType Directory -Force (Split-Path $cfg) | Out-Null
$d = if (Test-Path $cfg) { Get-Content $cfg -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
if (-not $d.mcpServers) { $d | Add-Member mcpServers ([pscustomobject]@{}) -Force }
$srv = @{ command = "cmd"; args = @("/c","uvx","blender-mcp"); env = @{ BLENDER_HOST="localhost"; BLENDER_PORT="9876"; DISABLE_TELEMETRY="true" } }
$d.mcpServers | Add-Member blender $srv -Force
$d | ConvertTo-Json -Depth 10 | Set-Content $cfg

if (Get-Command claude -ErrorAction SilentlyContinue) { claude mcp add --scope user blender -- cmd /c uvx blender-mcp 2>$null }

# Codex MCP
$toml = "$HOME\.codex\config.toml"
New-Item -ItemType Directory -Force (Split-Path $toml) | Out-Null
if (-not (Test-Path $toml)) { New-Item $toml | Out-Null }
if (-not (Select-String -Path $toml -Pattern '^\[mcp_servers.blender\]' -Quiet)) {
@'

[mcp_servers.blender]
command = "cmd"
args = ["/c", "uvx", "blender-mcp"]

[mcp_servers.blender.env]
BLENDER_HOST = "localhost"
BLENDER_PORT = "9876"
DISABLE_TELEMETRY = "true"
'@ | Add-Content $toml
}
Write-Host "Done. Restart Claude Desktop and Codex, then connect the BlenderMCP addon in Blender (N panel)."
