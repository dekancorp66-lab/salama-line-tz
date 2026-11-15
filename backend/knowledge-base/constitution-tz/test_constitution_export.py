import csv
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).parent

class ConstitutionExportTests(unittest.TestCase):
    def test_jsonl_has_one_record_per_pdf_page(self):
        rows = [json.loads(line) for line in (ROOT / "constitution_pages.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(rows), 209)
        self.assertEqual([r["page_number"] for r in rows], list(range(1, 210)))

    def test_records_preserve_source_and_are_unverified(self):
        first = json.loads((ROOT / "constitution_pages.jsonl").read_text(encoding="utf-8").splitlines()[0])
        self.assertEqual(first["source_id"], "tanzania_constitution")
        self.assertEqual(first["language"], "sw")
        self.assertEqual(first["source_type"], "constitution")
        self.assertFalse(first["verified"])

    def test_article_inventory_contains_all_base_numbers_and_lettered_entries(self):
        with (ROOT / "article_inventory.csv").open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        ids = {r["article_number"] for r in rows}
        self.assertTrue(all(str(n) in ids for n in range(1, 153)))
        self.assertTrue({"46A", "46B", "53A", "59A", "59B", "107A", "107B", "110A", "113A", "120A"}.issubset(ids))
        self.assertEqual(len(rows), 162)

    def test_source_metadata_keeps_unknown_edition_fields_null(self):
        meta = json.loads((ROOT / "source_metadata.json").read_text(encoding="utf-8"))
        self.assertIsNone(meta["publication_date"])
        self.assertIsNone(meta["edition_statement"])
        self.assertFalse(meta["verified"])

if __name__ == "__main__":
    unittest.main()
