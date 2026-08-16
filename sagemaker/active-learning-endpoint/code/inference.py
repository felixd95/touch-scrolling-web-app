import json
import random
from typing import Any, Dict, List, Optional, Tuple

import torch
from botorch.fit import fit_gpytorch_mll
from botorch.models import MultiTaskGP
from gpytorch.mlls import ExactMarginalLogLikelihood

REQUIRED_KEYS = (
    "scrollFriction",
    "x1",
    "x2",
    "inflexion",
    "physicalCoeffTuning",
    "maxLaunchVelocityPxMs",
)

TARGET_NUMBERS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300]

DEFAULT_PARAMETER_SET = {
    "scrollFriction": 0.015,
    "x1": 0.78,
    "x2": 0.9,
    "inflexion": 0.35,
    "physicalCoeffTuning": 0.84,
    "maxLaunchVelocityPxMs": 40.0,
}

# Search space for every parameter actively optimized by the GP policy.
# Mirrors src/scrollPhysics/overScrollerPhysics.js FLING_PHYSICS_BOUNDS so the
# candidates the model proposes always stay within physically valid ranges.
PARAMETER_BOUNDS = {
    "scrollFriction": (0.005, 0.05),
    "x1": (0.6, 0.92),
    "x2": (0.8, 0.98),
    "inflexion": (0.15, 0.65),
    "physicalCoeffTuning": (0.5, 1.5),
    "maxLaunchVelocityPxMs": (20.0, 80.0),
}

# BoTorch/GPyTorch models are numerically more stable in double precision.
TORCH_DTYPE = torch.double


def model_fn(model_dir: str) -> Dict[str, Any]:
    # No persisted model artifact is required: a fresh multi-task Gaussian
    # Process (task = participant) is fitted with BoTorch on every
    # invocation from the data supplied in the request body.
    return {}


def input_fn(request_body: str, request_content_type: str) -> Dict[str, Any]:
    if request_content_type != "application/json":
        raise ValueError(f"Unsupported content type: {request_content_type}")

    payload = json.loads(request_body)
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")

    return payload


def _normalize_current_params(payload: Dict[str, Any]) -> Dict[str, float]:
    candidate = payload.get("currentParameterSet", {})
    if not isinstance(candidate, dict):
        candidate = {}

    normalized = {}
    for key in REQUIRED_KEYS:
        value = candidate.get(key, DEFAULT_PARAMETER_SET[key])
        try:
            normalized[key] = float(value)
        except (TypeError, ValueError):
            normalized[key] = float(DEFAULT_PARAMETER_SET[key])

    return normalized


def _normalize_recent_data(raw_recent_data: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_recent_data, list):
        return []

    normalized = []
    for item in raw_recent_data:
        if not isinstance(item, dict):
            continue

        time_ms = item.get("timeMs")
        if time_ms is None:
            continue

        try:
            time_ms = float(time_ms)
        except (TypeError, ValueError):
            continue

        paper_params = item.get("paperParams", {})
        if not isinstance(paper_params, dict):
            paper_params = {}

        if not paper_params and isinstance(item.get("blockParameterSet"), dict):
            paper_params = item.get("blockParameterSet")

        legacy_aliases = {"x1": "a", "x2": "b"}
        params = {}
        for key in REQUIRED_KEYS:
            value = paper_params.get(key)
            if value is None and key in legacy_aliases:
                value = paper_params.get(legacy_aliases[key])
            if value is None:
                value = DEFAULT_PARAMETER_SET[key]
            try:
                params[key] = float(value)
            except (TypeError, ValueError):
                params[key] = float(DEFAULT_PARAMETER_SET[key])

        target_number = item.get("targetNumber")
        block_index = item.get("blockIndex")

        try:
            target_number = int(target_number) if target_number is not None else None
        except (TypeError, ValueError):
            target_number = None

        try:
            block_index = int(block_index) if block_index is not None else None
        except (TypeError, ValueError):
            block_index = None

        normalized.append(
            {
                "timeMs": time_ms,
                "params": params,
                "targetNumber": target_number,
                "blockIndex": block_index,
            }
        )

    return normalized


def _build_block_observations(recent_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create one training observation per completed block with a 10-dim time vector."""
    if not recent_data:
        return []

    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for idx, entry in enumerate(recent_data):
        block_index = entry.get("blockIndex")
        if not isinstance(block_index, int) or block_index <= 0:
            block_index = (idx // len(TARGET_NUMBERS)) + 1
        grouped.setdefault(block_index, []).append(entry)

    observations = []
    for block_idx in sorted(grouped.keys()):
        entries = grouped[block_idx]
        if not entries:
            continue

        block_params = entries[0]["params"]
        x = [block_params[key] for key in REQUIRED_KEYS]

        times_per_target = {target: [] for target in TARGET_NUMBERS}
        for entry in entries:
            target = entry.get("targetNumber")
            time_ms = entry.get("timeMs")
            if target in times_per_target and isinstance(time_ms, float):
                times_per_target[target].append(time_ms)

        available_times = [t for vals in times_per_target.values() for t in vals]
        if not available_times:
            continue

        fallback_time = float(sum(available_times) / len(available_times))
        time_vector = []
        for target in TARGET_NUMBERS:
            values = times_per_target[target]
            if values:
                time_vector.append(float(sum(values) / len(values)))
            else:
                time_vector.append(fallback_time)

        observations.append(
            {
                "blockIndex": block_idx,
                "x": x,
                "timeVector": time_vector,
            }
        )

    return observations


def _generate_candidate_parameters(current: Dict[str, float], num_candidates: int = 100) -> List[Dict[str, float]]:
    candidates = []
    for _ in range(num_candidates):
        candidate = current.copy()
        for key in REQUIRED_KEYS:
            low, high = PARAMETER_BOUNDS[key]
            candidate[key] = random.uniform(low, high)
        candidates.append(candidate)
    candidates.append(dict(current))
    return candidates


def _normalize_participants_data(
    raw_participants_data: Any,
    current_participant_id: Optional[str],
) -> Tuple[Dict[int, List[Dict[str, Any]]], Optional[int]]:
    """Group every participant's attempts into per-block observations and
    assign each participant a stable integer task id for the multi-task GP.
    Returns (blocks_by_task_id, current_participant_task_id).
    """
    blocks_by_task_id: Dict[int, List[Dict[str, Any]]] = {}
    current_task_id = None

    if not isinstance(raw_participants_data, list):
        return blocks_by_task_id, current_task_id

    for entry in raw_participants_data:
        if not isinstance(entry, dict):
            continue

        participant_id = entry.get("participantId")
        if not participant_id:
            continue

        recent_data = _normalize_recent_data(entry.get("attempts"))
        blocks = _build_block_observations(recent_data)
        if not blocks:
            continue

        task_id = len(blocks_by_task_id)
        blocks_by_task_id[task_id] = blocks

        if participant_id == current_participant_id:
            current_task_id = task_id

    return blocks_by_task_id, current_task_id


def _build_task_training_data(
    blocks_by_task_id: Dict[int, List[Dict[str, Any]]],
    target_index: int,
) -> Tuple[Optional[torch.Tensor], Optional[torch.Tensor]]:
    """Build the (scrollFriction, x1, x2, inflexion, physicalCoeffTuning,
    maxLaunchVelocityPxMs, task_id) -> time training tensors for one of the
    10 target-number objectives, pooling observations across participants."""
    rows_x = []
    rows_y = []

    for task_id, blocks in blocks_by_task_id.items():
        for block in blocks:
            rows_x.append([*block["x"], float(task_id)])
            rows_y.append([block["timeVector"][target_index]])

    if not rows_x:
        return None, None

    train_x = torch.tensor(rows_x, dtype=TORCH_DTYPE)
    train_y = torch.tensor(rows_y, dtype=TORCH_DTYPE)
    return train_x, train_y


def _fit_multi_task_gp(train_x: torch.Tensor, train_y: torch.Tensor) -> MultiTaskGP:
    """Fit a BoTorch MultiTaskGP where the last input column is the task
    (participant) index. The ICM multi-task kernel lets the model share
    statistical strength about the parameter -> completion-time relationship
    across participants instead of fitting each participant in isolation."""
    model = MultiTaskGP(train_x, train_y, task_feature=-1)
    mll = ExactMarginalLogLikelihood(model.likelihood, model)
    fit_gpytorch_mll(mll)
    return model


def _select_best_candidate_index(
    blocks_by_task_id: Dict[int, List[Dict[str, Any]]],
    candidate_params: List[Dict[str, float]],
    current_task_id: int,
) -> Optional[int]:
    """Fit one multi-task GP per target-time objective and scalarize the 10
    posterior-mean predictions (mean + weighted worst-case + spread) across
    every candidate, returning the index of the best candidate."""
    candidate_x = torch.tensor(
        [[*(c[key] for key in REQUIRED_KEYS), float(current_task_id)] for c in candidate_params],
        dtype=TORCH_DTYPE,
    )

    predicted_times = []
    for target_index in range(len(TARGET_NUMBERS)):
        train_x, train_y = _build_task_training_data(blocks_by_task_id, target_index)
        if train_x is None or train_x.shape[0] < 2:
            return None

        model = _fit_multi_task_gp(train_x, train_y)
        model.eval()
        with torch.no_grad():
            posterior = model.posterior(candidate_x)
            predicted_times.append(posterior.mean.squeeze(-1))

    stacked_times = torch.stack(predicted_times, dim=0)  # (10 objectives, num_candidates)
    mean_time = stacked_times.mean(dim=0)
    max_time = stacked_times.max(dim=0).values
    min_time = stacked_times.min(dim=0).values
    spread = max_time - min_time

    # Joint objective: minimize average time, worst-case time, and imbalance across targets.
    score = mean_time + 0.35 * max_time + 0.10 * spread
    return int(torch.argmin(score).item())


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    current = _normalize_current_params(input_data)
    current_participant_id = input_data.get("participantId")

    blocks_by_task_id, current_task_id = _normalize_participants_data(
        input_data.get("participantsData"), current_participant_id
    )
    total_block_observations = sum(len(blocks) for blocks in blocks_by_task_id.values())

    best_candidate = current
    strategy = "fallback-current-parameters"

    if total_block_observations >= 2 and current_task_id is not None:
        candidates = _generate_candidate_parameters(current, num_candidates=100)

        try:
            best_index = _select_best_candidate_index(blocks_by_task_id, candidates, current_task_id)
            if best_index is not None:
                best_candidate = candidates[best_index]
                strategy = "botorch-multitask-gp-multi-objective-10-target-times"
        except Exception:
            best_candidate = current

    return {
        "parameters": best_candidate,
        "modelMetadata": {
            "strategy": strategy,
            "version": "v2",
            "participantCount": len(blocks_by_task_id),
            "totalBlockObservations": total_block_observations,
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
