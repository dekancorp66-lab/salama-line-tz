# SalamaLine AI Knowledge Package — Mainland Tanzania

## Purpose
This package is a starter, source-traceable knowledge dataset for a Swahili-first SalamaLine support platform focused on violence against women and children (VAWC), safeguarding, first-line support and referrals.

**Geographic configuration: Mainland Tanzania only.** Zanzibar laws, institutions, procedures and referrals are excluded. Do not infer that the Mainland Law of the Child Act applies in Zanzibar.

## Files
- `salamaline_knowledge.jsonl` — source-linked knowledge records.
- `salamaline_qa.jsonl` — bilingual question-and-answer examples.
- `salamaline_scenarios.jsonl` — synthetic training/evaluation scenarios.
- `salamaline_safety.jsonl` — safety and escalation rules.
- `salamaline_sources.json` — source catalogue and limitations.
- `README.md` — this guide.

## Recommended architecture
1. Keep these records in a version-controlled knowledge repository.
2. Parse each JSONL line as one independent JSON object.
3. Chunk and embed `content` plus `english_equivalent`; preserve `id`, `topic`, `source_ids`, `geographic_scope` and evidence status as metadata.
4. On retrieval, filter legal and referral records to `Mainland Tanzania`.
5. Return short answers with source title/year and, after page-level verification, page/section citations.
6. Route high-risk child-protection, urgent safety, clinical and formal-report requests to an approved human workflow.
7. Maintain a separate, manually verified referral directory. This package deliberately contains no invented phone numbers or service contacts.
8. Keep user chat history separate from formal help-request records. Apply data minimization, access controls, retention limits and clear consent.

## How to load JSONL
```python
import json

def load_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

knowledge = load_jsonl("salamaline_knowledge.jsonl")
qa = load_jsonl("salamaline_qa.jsonl")
scenarios = load_jsonl("salamaline_scenarios.jsonl")
safety = load_jsonl("salamaline_safety.jsonl")
```

## RAG vs fine-tuning
- Use RAG for factual knowledge, policy content, legal scope, source attribution and material that must be updated.
- Use synthetic Q&A/scenarios to evaluate response quality and safety.
- Do not fine-tune on identifiable survivor conversations or case files. Fine-tuning is not a substitute for retrieval, safeguarding policy, access control or human escalation.

## Source and scope cautions
- `The Law of the Child Act, Cap. 13, R.E. 2023` is treated as Mainland Tanzania legislation.
- WHO publications are global professional guidance, not Tanzanian legislation.
- The 2014 WHO clinical handbook is not a current Tanzania clinical protocol. Verify all clinical details against current Mainland Tanzania guidance.
- NPA-VAWC II is a national action plan, not legislation. This package configures service/legal records for Mainland use only; confirm specific implementation coverage and institutional pathways before production.
- This is a structured summary package, not a complete legal opinion, clinical protocol or verified service directory.
- Verify exact statutory wording, amendments, institutional responsibilities and page citations before deploying legal or safeguarding answers.

## Before production
- Obtain legal review by a Mainland Tanzania-qualified professional.
- Obtain clinical review by qualified Mainland Tanzania health professionals.
- Verify every referral organisation, location, service, phone number, hours and escalation contact.
- Conduct child safeguarding and privacy impact assessments.
- Test bilingual answers, refusal boundaries, urgent handoff and location filtering.
- Establish a review owner and review date for each record.
- Record version changes and retire outdated content.

## Data counts
- Knowledge records: 25
- Bilingual Q&A records: 10
- Synthetic scenarios: 8
- Safety rules: 18

Generated as an initial structured knowledge package from the four identified source documents and their reviewed summaries. It should be validated against the original page-level documents before production use.
