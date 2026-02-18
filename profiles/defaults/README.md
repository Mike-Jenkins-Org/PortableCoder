# Secrets Policy (MVP)

MVP uses external secret injection only.

Do not store API keys in repository files or portable profile files.
Inject keys at runtime from shell/session environment variables.

Required env vars:
- Codex: `OPENAI_API_KEY`
- Claude Code: `ANTHROPIC_AUTH_TOKEN` (or `ANTHROPIC_API_KEY`)

PowerShell examples:
```powershell
$env:OPENAI_API_KEY = "replace_me"
$env:ANTHROPIC_AUTH_TOKEN = "replace_me"
```

Optional command overrides:
- `PCODER_CODEX_CMD`
- `PCODER_CLAUDE_CMD`
