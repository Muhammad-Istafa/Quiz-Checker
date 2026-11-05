"""Unit test for Per-Criterion Accuracy Bug Fix (Audit Item A2).

Verifies that:
1. Synthetic records with gold_criteria compute exact criterion accuracy.
2. Real records with empty gold_criteria return (0, 0) and report NaN/None rather than 0.0.
3. Mixed records compute accuracy over records that actually have gold criteria.
"""
import math
from typing import Dict, List, Tuple


def criterion_hits(record: dict) -> Tuple[int, int]:
    """Fixed _criterion_hits implementation.
    
    Returns (hits, total_gold_criteria).
    If a record has no gold criteria (e.g. real student data graded holistically),
    it returns (0, 0) rather than counting as 0 hits against a fictitious criterion.
    """
    gold_criteria = record.get("gold_criteria", [])
    if not gold_criteria:
        return 0, 0

    gold_map = {str(c["id"]).strip().lower(): float(c["awarded"]) for c in gold_criteria}
    
    if not (record.get("schema_valid_final") and record.get("parsed")):
        return 0, len(gold_map)

    parsed = record["parsed"]
    pred_criteria = parsed.get("criteria", []) if isinstance(parsed, dict) else []
    pred_map = {str(c["id"]).strip().lower(): float(c.get("awarded", 0.0)) for c in pred_criteria if isinstance(c, dict)}

    ok = sum(1 for cid, g in gold_map.items() if cid in pred_map and abs(pred_map[cid] - g) < 0.01)
    return ok, len(gold_map)


def compute_criterion_accuracy(records: List[dict]) -> float:
    """Fixed compute_metrics per-criterion accuracy calculation."""
    ok = 0
    tot = 0
    for r in records:
        a, b = criterion_hits(r)
        ok += a
        tot += b

    if tot == 0:
        return float("nan")
    return ok / tot


def test_synthetic_record():
    synth_rec = {
        "sample_id": "synth_1",
        "schema_valid_final": True,
        "gold_criteria": [
            {"id": "fib_init", "awarded": 1.0},
            {"id": "fib_loop", "awarded": 1.5},
            {"id": "fib_recur", "awarded": 1.5},
        ],
        "parsed": {
            "criteria": [
                {"id": "fib_init", "awarded": 1.0},
                {"id": "fib_loop", "awarded": 1.5},
                {"id": "fib_recur", "awarded": 1.0}, # 1 deduction
            ]
        }
    }
    hits, total = criterion_hits(synth_rec)
    assert total == 3, f"Expected 3 criteria, got {total}"
    assert hits == 2, f"Expected 2 hits, got {hits}"

    acc = compute_criterion_accuracy([synth_rec])
    assert abs(acc - (2 / 3)) < 1e-4, f"Expected ~0.6667, got {acc}"
    print("[PASS] test_synthetic_record")


def test_real_record():
    real_rec = {
        "sample_id": "real_q3_25F-0518",
        "schema_valid_final": True,
        "gold_total": 7.0,
        "gold_criteria": [],  # Real data only has GT total, no criteria breakdown
        "parsed": {
            "total": 7.0,
            "criteria": [
                {"id": "q3_c1", "awarded": 1.0},
                {"id": "q3_c2", "awarded": 3.0},
                {"id": "q3_c3", "awarded": 1.0},
                {"id": "q3_c4", "awarded": 2.0},
            ]
        }
    }
    hits, total = criterion_hits(real_rec)
    assert total == 0, f"Expected 0 criteria for holistic real record, got {total}"
    assert hits == 0, f"Expected 0 hits, got {hits}"

    acc = compute_criterion_accuracy([real_rec])
    assert math.isnan(acc), f"Expected NaN when gold criteria are absent, got {acc}"
    print("[PASS] test_real_record (reported as NaN instead of buggy 0.0%)")


def test_mixed_records():
    synth_rec = {
        "schema_valid_final": True,
        "gold_criteria": [{"id": "c1", "awarded": 1.0}, {"id": "c2", "awarded": 2.0}],
        "parsed": {"criteria": [{"id": "c1", "awarded": 1.0}, {"id": "c2", "awarded": 2.0}]}
    }
    real_rec = {
        "schema_valid_final": True,
        "gold_criteria": [],
        "parsed": {"criteria": [{"id": "q3_c1", "awarded": 1.0}]}
    }
    acc = compute_criterion_accuracy([synth_rec, real_rec])
    assert acc == 1.0, f"Expected 1.0 (unbiased by real record missing criteria), got {acc}"
    print("[PASS] test_mixed_records")


if __name__ == "__main__":
    test_synthetic_record()
    test_real_record()
    test_mixed_records()
    print("[ALL PASS] Per-criterion bug fix unit tests passed.")

