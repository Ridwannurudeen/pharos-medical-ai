# Audit & resource log schemas

These are the verification backbone — build the writer **first** (week 1), and have it writing live to disk during every demo recording. Judges check consistency between logs, video, and hardware claims (Stage 2). NTP-sync devices before recording so timestamps line up.

## Audit log — `audit.jsonl` (one JSON object per line)

Common fields on every event:
- `ts_iso` — ISO-8601 UTC timestamp
- `monotonic_ms` — monotonic clock ms since app start (immune to wall-clock changes)
- `device_id` — short stable id per device (phone-A, anchor-1, …)
- `event` — event type (below)
- `network_state` — `offline` | `lan_only` | `online`

Event types and their extra fields:

| `event` | extra fields |
|---|---|
| `app_launch` | `app_version`, `hardware` (cpu, ram_mb, os) |
| `model_load` | `model`, `size_mb`, `quant`, `source` (local/peer), `load_ms` |
| `model_unload` | `model` |
| `ocr_start` / `ocr_end` | `image_hash`; end adds `text_len`, `latency_ms` |
| `normalize_result` | `raw_text`, `generic` (or null), `matched` (bool) |
| `ddinter_lookup` | `drug_a`, `drug_b`, `severity` (Major/Moderate/Minor/Unknown/none), `ddinter_id_a`, `ddinter_id_b` |
| `medpsy_start` / `medpsy_end` | `model`, `prompt_tokens`; end adds `completion_tokens`, `ttft_ms`, `tokens_per_sec` |
| `abstain` | `reason` (`unresolved_drug` / `not_in_dataset`) |
| `delegation_start` / `delegation_end` | `peer_pubkey` (short), `model`; end adds `ttft_ms`, `tokens_per_sec`, `recovered` (bool, true if it survived a mid-stream drop) |
| `model_registry_pull` | `model`, `peer_pubkey` (short), `size_mb`, `duration_ms` |
| `scan_result` | `result_hash`, `severity`, `delegated` (bool), `abstained` (bool) |

### Sample demo run

A real run of the shipping engine (`spike/validate-engine.ts`, QVAC OCR + MedPsy-1.7B on WSL2) is committed at [`sample-audit-run.jsonl`](sample-audit-run.jsonl) — 11 events covering `model_load` ×2 (OCR + MedPsy), the grounded scan chain, `medpsy_end` with inference performance (`prompt_tokens`, `completion_tokens`, `ttft_ms`, `tokens_per_sec`), and `model_unload` ×2. Regenerate with `MEDPSY_1_7B=… node spike/validate-engine.ts`.

## Resource log — `resources.csv`

Sampled ~1/sec during runs:

```
ts_iso,monotonic_ms,device_id,cpu_pct,ram_mb,battery_pct,network_state
```

## Network proof

Capture (tcpdump / Charles / mitmproxy) saved alongside the logs for each offline run, showing zero outbound inference traffic. Reference its filename in the demo description.
