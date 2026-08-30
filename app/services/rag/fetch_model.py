"""Setup-time download of the embedding model into ``data/models/``.

Run once, with internet available (8_Decisions_2.md §9 permits setup-time egress):

    cd app && ../.venv/Scripts/python.exe -m services.rag.fetch_model

After this, ``services/rag/vector_db.py`` loads the weights purely from local
disk with ``HF_HUB_OFFLINE=1``. This module imports ``huggingface_hub`` directly
and never imports ``vector_db``, so the offline env vars are not set here.
"""

from __future__ import annotations

from pathlib import Path

from core.config import EMBEDDING_MODEL_DIR, EMBEDDING_MODEL_REPO


def _already_present(target: Path) -> bool:
    if not (target / "config.json").exists():
        return False
    weights = ("model.safetensors", "pytorch_model.bin")
    return any((target / w).exists() for w in weights)


def download() -> Path:
    """Download the model snapshot; a no-op if it is already on disk."""
    target = EMBEDDING_MODEL_DIR
    if _already_present(target):
        print(f"Embedding model already present: {target}")
        return target

    from huggingface_hub import snapshot_download

    target.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {EMBEDDING_MODEL_REPO} -> {target} ...")
    snapshot_download(
        repo_id=EMBEDDING_MODEL_REPO,
        local_dir=str(target),
        allow_patterns=[
            "*.json",
            "*.txt",
            "*.safetensors",
            "*.bin",
            "*.md",
            "1_Pooling/*",
        ],
    )
    print(f"Done. Model is at: {target}")
    return target


if __name__ == "__main__":
    download()
