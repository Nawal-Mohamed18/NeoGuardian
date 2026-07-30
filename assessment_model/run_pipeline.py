"""One-shot: generate dataset → preprocess → train (all inside this folder)."""

from __future__ import annotations

from generate_dataset import main as generate_main
from preprocess import main as preprocess_main
from train import main as train_main


if __name__ == "__main__":
    generate_main()
    preprocess_main()
    train_main()
