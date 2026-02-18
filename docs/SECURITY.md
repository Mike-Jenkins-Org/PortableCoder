---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Security

Threat model and operational safeguards for portable multi-provider CLI execution.

## Secret Handling
- API keys are environment-based and must never be committed.
- MVP policy is external injection only: do not store provider secrets in repo or portable bundle files.
- Launch sessions should inject keys at runtime (`OPENAI_API_KEY`, `ANTHROPIC_AUTH_TOKEN`).
- OAuth mode stores provider session state under portable `state/auth/<tool>/` (host) and VM-local `/home/portable/.pcoder-auth/<tool>/`; treat portable media as sensitive when OAuth is enabled.

## Execution Safety
- Prefer argv-based process spawn over shell string interpolation.
- Validate project path inputs before passing to tool launchers.
- Keep mutation operations explicit; avoid hidden auto-apply behavior.

## Supply Chain
- Pin runtime/tool versions in lock manifests where possible.
- Document source URLs and checksums for bundled binaries.
- Maintain third-party license notices for redistributed artifacts.

## Portable Device Risk
- Assume removable media can be lost.
- External injection only is the default mitigation for MVP.
