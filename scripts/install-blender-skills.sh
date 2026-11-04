#!/usr/bin/env bash
# Installs the Blender skills + Blender MCP globally for Claude (Code + Desktop) and Codex.
# Run from the repo root on macOS/Linux:  bash scripts/install-blender-skills.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
command -v uvx >/dev/null || { echo "Install uv first: https://docs.astral.sh/uv/getting-started/installation/"; exit 1; }

# Skills
mkdir -p "$HOME/.claude/skills" "$HOME/.agents/skills"
cp -R "$ROOT/.claude/skills/." "$HOME/.claude/skills/"      # Claude Code + Claude Desktop (Code tab)
cp -R "$ROOT/.agents/skills/." "$HOME/.agents/skills/"      # Codex

# Claude Desktop MCP config
case "$(uname -s)" in
  Darwin) CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
  *)      CFG="${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json" ;;
esac
mkdir -p "$(dirname "$CFG")"; [ -f "$CFG" ] || echo '{}' > "$CFG"
python3 - "$CFG" <<'PY'
import json, sys
p = sys.argv[1]; d = json.load(open(p))
d.setdefault("mcpServers", {})["blender"] = {"command": "uvx", "args": ["blender-mcp"],
  "env": {"BLENDER_HOST": "localhost", "BLENDER_PORT": "9876", "DISABLE_TELEMETRY": "true"}}
json.dump(d, open(p, "w"), indent=2)
PY

# Claude Code user-level MCP (skip if CLI absent)
command -v claude >/dev/null && claude mcp add --scope user blender -- uvx blender-mcp 2>/dev/null || true

# Codex MCP
mkdir -p "$HOME/.codex"; touch "$HOME/.codex/config.toml"
grep -q '^\[mcp_servers.blender\]' "$HOME/.codex/config.toml" || cat >> "$HOME/.codex/config.toml" <<'TOML'

[mcp_servers.blender]
command = "uvx"
args = ["blender-mcp"]

[mcp_servers.blender.env]
BLENDER_HOST = "localhost"
BLENDER_PORT = "9876"
DISABLE_TELEMETRY = "true"
TOML
echo "Done. Restart Claude Desktop and Codex, then connect the BlenderMCP addon in Blender (N panel)."
