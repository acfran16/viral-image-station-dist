## Blender Skills

Blender asset tasks use the skills in `.claude/skills/` (Claude Code) / `.agents/skills/` (Codex) — identical copies of https://github.com/arjun988/blender-skills.

1. For complex Blender work, read **blender-director** first.
2. If the user attaches a reference image, read `references/reference-image-match.md` and complete Reference Analysis before executing.
3. Check Blender MCP (server `blender`). If connected, execute via MCP; never narrate UI steps. Read tool schemas first (`references/mcp-tools.md`).
4. Follow `references/asset-pipeline.md`; validate with `references/validation-checklist.md` before export.
5. Naming: `references/naming-conventions.md` (`COL_` collections, `SM_` meshes).

Setup: `docs/BLENDER_MCP_SETUP.md`. Keep both skill copies in sync when updating.
