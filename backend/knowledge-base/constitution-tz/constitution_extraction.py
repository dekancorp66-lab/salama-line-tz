#!/usr/bin/env python3
"""Extract a supplied Kiswahili Constitution PDF into auditable page-level JSONL.

Usage:
  python constitution_extraction.py input.pdf output_dir

This intentionally does not claim article-level segmentation or legal verification.
It preserves page boundaries so a project-specific parser can be reviewed against source pages.
"""
import sys, json, subprocess
from pathlib import Path

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: constitution_extraction.py input.pdf output_dir")
    pdf = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    info = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
    import re
    pages = int(re.search(r"^Pages:\\s+(\\d+)", info, re.M).group(1))
    jsonl = out / "constitution_pages.jsonl"
    with jsonl.open("w", encoding="utf-8") as f:
        all_text = []
        for page in range(1, pages + 1):
            text = subprocess.run(
                ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(pdf), "-"],
                check=True, capture_output=True, text=True
            ).stdout.strip()
            all_text.append(text)
            f.write(json.dumps({
                "source_id": "tanzania_constitution",
                "document_title": "Katiba ya Jamhuri ya Muungano wa Tanzania, ya mwaka 1977",
                "jurisdiction": "United Republic of Tanzania",
                "language": "sw",
                "page_number": page,
                "source_type": "constitution",
                "content": text,
                "verified": False,
                "extraction_method": "pdftotext -layout",
                "source_pdf": pdf.name
            }, ensure_ascii=False) + "\\n")
        (out / "constitution_sw_fulltext.txt").write_text("\\n".join(all_text), encoding="utf-8")
    print(f"Processed {pages} pages; page-level JSONL written to {jsonl}")

if __name__ == "__main__":
    main()
