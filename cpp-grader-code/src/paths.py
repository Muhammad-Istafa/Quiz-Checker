"""Dataset path resolver for v2 data and legacy compatibility (Phase 1 & Phase 4).

Resolves where NB1 writes its dataset and where NB2/NB3 read it:
- Default v2 output: <BASE_DIR>/cpp-grader-data-v2
- Fallbacks: DATA_DIR environment variable, or single attached Kaggle dataset with data_manifest.json
"""
import glob
import os

DATASET_DIRNAME = os.environ.get("DATASET_DIRNAME", "cpp-grader-data-v2")
MANIFEST_NAME = "data_manifest.json"


def base_dir() -> str:
    env = os.environ.get("BASE_DIR")
    if env:
        return env.rstrip("/\\")
    return "/kaggle/working" if os.path.isdir("/kaggle/working") else "."


def nb1_output_dir() -> str:
    """Folder NB1 writes the v2 dataset into."""
    return os.path.join(base_dir(), DATASET_DIRNAME)


def resolve_data_dir(required_file: str = MANIFEST_NAME) -> str:
    """Folder later phases read the dataset from."""
    env = os.environ.get("DATA_DIR")
    if env:
        if os.path.isfile(os.path.join(env, required_file)):
            return env
        # Check subdirectories
        for sub in ["cpp-grader-data-v2", "output/teacher_distilled"]:
            p = os.path.join(env, sub)
            if os.path.isfile(os.path.join(p, required_file)):
                return p

    # 1. Check local teacher distilled output first if present
    teacher_local = os.path.join(base_dir(), "output", "teacher_distilled")
    if os.path.isfile(os.path.join(teacher_local, "train_sft_distilled.jsonl")):
        return teacher_local

    # 2. Check local v2 output
    local = nb1_output_dir()
    if os.path.isfile(os.path.join(local, required_file)):
        return local

    # 3. Check for extracted bundle in Quiz-Checker
    clone_local = os.path.join(base_dir(), "Quiz-Checker", "cpp-grader-data-v2")
    if os.path.isfile(os.path.join(clone_local, required_file)):
        return clone_local

    # 4. Search /kaggle/input (both shallow and deep)
    found = []
    if os.path.isdir("/kaggle/input"):
        try:
            for match in glob.glob(f"/kaggle/input/**/{required_file}", recursive=True):
                found.append(os.path.dirname(match))
        except Exception:
            pass

    found = sorted(set(found))
    if len(found) == 1:
        return found[0]
    if len(found) > 1:
        # Prefer teacher distilled, then v2
        distill_cands = [p for p in found if os.path.isfile(os.path.join(p, "train_sft_distilled.jsonl"))]
        if distill_cands:
            return distill_cands[0]
        v2_cands = [p for p in found if "v2" in p.lower() or os.path.isfile(os.path.join(p, "train_sft_v2.jsonl"))]
        if v2_cands:
            return v2_cands[0]
        return found[0]

    # Check for legacy v1-1 local folder if v2 not yet built
    legacy_local = os.path.join(base_dir(), "cpp-grader-data-v1-1")
    if os.path.isfile(os.path.join(legacy_local, required_file)):
        return legacy_local

    raise FileNotFoundError(
        f"No dataset found (looked for {required_file} in {local} and /kaggle/input). "
        "Run NB1 (nb1_data.py) or attach its output dataset, or set DATA_DIR."
    )
