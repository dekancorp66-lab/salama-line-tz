# Katiba ya Jamhuri ya Muungano wa Tanzania — extraction audit

## Primary source
- Exact file: `KATIBA YA JAMHURI YA MUUNGANO WA TANZANIA YA MWAKA 1977 (2).pdf`
- PDF page count: **209**
- PDF metadata title: `KATIBA JAMH Ndogo (SWAHILI) GP.pmd`
- PDF metadata creation date: `2020-12-15 11:36:36 UTC`
- Document title printed in the PDF: `KATIBA YA JAMHURI YA MUUNGANO WA TANZANIA YA MWAKA 1977`
- Commencement date stated in Article 152(2): `26 Aprili, 1977`
- Separate publication date / edition statement / explicit issuing institution on the opening pages: **not identified**.
- Amendment references listed on the PDF's page 16 are captured in `source_metadata.json`.

## Extraction coverage
- Pages processed: **209/209**
- Full-text extraction: `pdftotext -layout`, page-by-page.
- Pages with fewer than 80 extracted characters: **0**
- OCR: **not invoked**; every page returned a non-trivial text layer. This does not prove every glyph or layout element is error-free.
- Full extracted text: `constitution_sw_fulltext.txt`
- Page-level JSONL: `constitution_pages.jsonl` (209 records; one per PDF page).

## Article inventory
- Contents inventory entries: **162**
- Base numbered articles represented: **152 (1–152)**
- Lettered article entries identified: **10** — 46A, 46B, 53A, 59A, 59B, 107A, 107B, 110A, 113A, 120A
- Schedules: **2** — Nyongeza ya Kwanza and Nyongeza ya Pili.
- Article inventory: `article_inventory.csv`.

## Completeness and manual-verification status
- This is a **contents-based inventory**, not a completed article-by-article full-text audit.
- Article text has **not** yet been segmented into individual article records. The page JSONL preserves the actual extracted text with original PDF page references and is suitable as an auditable staging dataset, not as a claim that article-level retrieval is complete.
- Missing/duplicate article numbers: no gap in the base-number inventory 1–152 was observed in the contents; the contents also identify the lettered entries listed above. Article-body-to-contents reconciliation remains outstanding.
- Sub-article/clause completeness: not yet audited.
- Scanned/unreadable pages: no low-text pages were detected by the stated threshold; manual visual review is still required for OCR-like glyph errors, tables, and layout ambiguities.
- Schedules were identified from the contents and final pages; their individual clauses have not been separately structured.
- No legal verification has been performed. All records are marked `verified: false`.

## Project integration status
No SalamaLine repository, project directory, existing knowledge-base JSONL, retrieval code, endpoint, frontend, README, or test suite was present in the mounted workspace when inspected. Therefore:
- No existing knowledge records were deleted or changed.
- No AI endpoint or frontend was modified.
- No claim is made that SalamaLine retrieval has been updated or tested.
- The page-level JSONL is a safe staging export only. It must be adapted to the project's actual schema and article-level records before production use.

## Human legal review required
1. Confirm the source's publication/edition status and whether the amendment references are fully reflected in the body.
2. Reconcile all 162 contents entries against the body, including lettered articles.
3. Verify exact article headings, every sub-article/clause, and both schedules against the PDF page images.
4. Review any text extraction anomalies and approve legal wording before setting any `verified` flag.
5. Confirm jurisdiction and retrieval guardrails for Union matters, Mainland Tanzania, and Zanzibar in the actual SalamaLine application.
