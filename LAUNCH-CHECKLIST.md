# Launch checklist

Building privately (no Build-in-Public social posts). Note: the repo must still be **public + Apache-2.0 and judge-accessible at submission** for eligibility — develop in a private repo if you like, but flip it public for the submission.

## Before June 1 (setup — not judged, disclose as prior work)
- [ ] Register on DoraHacks; add **all** teammates to the project page (required for eligibility).
- [ ] Lock the team in writing: members, prize split, weekly time commitment.
- [ ] Add the official **Apache-2.0 `LICENSE`** file (use GitHub's license picker so the text is exact).
- [ ] Create the GitHub repo (private during dev is fine).
- [ ] Stage datasets into `data/raw/` (DDInter, RxNorm prescribable, DrugBank Vocabulary) — see `data/README.md`.
- [ ] Download MedPsy GGUFs (1.7B for phone, 4B for laptop anchor); confirm the model license on the HF card.
- [ ] **Run the Day-1 spike** (`day1-spike.md`): Gate A (P2P delegation + offline model pull + failover) and Gate B (OCR→normalize→DDInter→MedPsy, offline). This decides the scope below.

## Spike verdict → scope
- [ ] **A pass + B pass** → build the unified product (solo tier first, then mesh).
- [ ] **A fail + B pass** → ship the solo phone app; drop the mesh (no wasted work).
- [ ] **B fail** → stop and reassess grounding before building.

## June 1+ (judged build)
- [ ] Build the **audit-log + resource-log writer first** (`docs/audit-log-schema.md`) — verification backbone.
- [ ] Solo tier: camera → OCR → normalize → DDInter lookup → MedPsy explanation → result card with TTFT/TPS.
- [ ] Encrypted local SQLite shelf (add/remove meds).
- [ ] Abstain path + persistent disclaimer banner.
- [ ] Mesh tier (only if spike passed): anchor provider (MedPsy-4B), delegation by public key, offline model-registry pull, mid-stream failover.
- [ ] `npm run verify` over a fixed fixture set; CI runs it on every push.
- [ ] Build the fixed, **pre-verified** demo-case set (every drug pair confirmed against authoritative sources).

## Submission (by June 21 23:59 UTC — aim for the early-bird window)
- [ ] Make the repo **public**, Apache-2.0.
- [ ] Reproducibility README + hardware specs + system-profiler screenshots.
- [ ] Structured remote-API-call file (target: none — all inference local).
- [ ] Audit log + resource log + network capture bundled as evidence.
- [ ] ≤5-min demo video (YouTube unlisted): airplane mode visible, interaction caught, mesh moments, logs writing live.
- [ ] Confirm early-bird deadline against the official rules — they list both **June 14** and **June 17**; target the earlier (June 14) to be safe.
