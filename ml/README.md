# gestur3d-ml

Python side of Gestur3D: landmark dataset processing, gesture classifier training, evaluation and ONNX export.

This package is a skeleton in Milestone 1. Training code arrives in Milestone 5, after the dataset collection tool (Milestone 4) has produced real data.

## Setup

```bash
cd ml
uv sync            # core + dev tools
uv sync --extra train   # adds PyTorch, scikit-learn, ONNX (Milestone 5)
uv run pytest
uv run ruff check .
```

## Layout (planned)

```
src/gestur3d_ml/
  data/       load JSONL exports, participant-grouped splits
  features/   landmark normalization (must match shared/landmark-spec)
  models/     static MLP, dynamic GRU / temporal CNN
  baselines/  rule-based classifiers for comparison
  train/      training loops (AdamW, early stopping)
  eval/       metrics, confusion matrices, reports
  export/     ONNX export + parity checks
```

Raw and processed datasets live outside git (`ml/data/`, ignored).
