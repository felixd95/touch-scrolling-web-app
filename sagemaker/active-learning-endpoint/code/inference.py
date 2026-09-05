import json
from typing import Any, Dict, List, Optional, Tuple

print("DEBUG inference.py: starting imports", flush=True)

import numpy as np  # noqa: E402

print(f"DEBUG inference.py: numpy imported, version={np.__version__}", flush=True)

import torch  # noqa: E402
from botorch.acquisition.multi_objective.logei import (  # noqa: E402
    qLogNoisyExpectedHypervolumeImprovement,
)
from botorch.fit import fit_gpytorch_mll  # noqa: E402
from botorch.models import ModelListGP, SingleTaskGP  # noqa: E402
from botorch.models.transforms.outcome import Standardize  # noqa: E402
from botorch.optim import optimize_acqf  # noqa: E402
from gpytorch.mlls.sum_marginal_log_likelihood import (  # noqa: E402
    SumMarginalLogLikelihood,
)

print(f"DEBUG inference.py: torch imported, version={torch.__version__}", flush=True)
print("DEBUG inference.py: botorch imports completed successfully", flush=True)

print("DEBUG inference.py: all imports completed", flush=True)

REQUIRED_KEYS = (
    "scrollFriction",
    "decelerationRate",
    "inflexion",
)

TARGET_NUMBERS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300]

DEFAULT_PARAMETER_SET = {
    "scrollFriction": 0.015,
    "decelerationRate": float(np.log(0.78) / np.log(0.9)),
    "inflexion": 0.35,
}

PARAMETER_BOUNDS = {
    "scrollFriction": (0.005, 0.05),
    "decelerationRate": (1.2, 4.0),
    "inflexion": (0.15, 0.65),
}

MIN_OBSERVATIONS_FOR_BO = 2


def model_fn(model_dir: str) -> Dict[str, Any]:
    print(f"DEBUG inference.py: model_fn called with model_dir={model_dir}", flush=True)
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

    if not (normalized["decelerationRate"] > 1):
        normalized["decelerationRate"] = float(DEFAULT_PARAMETER_SET["decelerationRate"])

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

        params = {}
        for key in REQUIRED_KEYS:
            value = paper_params.get(key)

            if value is None:
                value = DEFAULT_PARAMETER_SET[key]

            try:
                parsed_value = float(value)
            except (TypeError, ValueError):
                parsed_value = float(DEFAULT_PARAMETER_SET[key])

            if key == "decelerationRate" and not (parsed_value > 1):
                parsed_value = float(DEFAULT_PARAMETER_SET[key])

            params[key] = parsed_value

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


def _normalize_participants_data(
    raw_participants_data: Any,
    current_participant_id: Optional[str],
) -> Tuple[Dict[int, List[Dict[str, Any]]], Optional[int]]:
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


def _build_multiobjective_training_data(
    blocks_by_task_id: Dict[int, List[Dict[str, Any]]],
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    rows_x: List[List[float]] = []
    rows_y: List[List[float]] = []

    for task_id, blocks in blocks_by_task_id.items():
        for block in blocks:
            rows_x.append([*block["x"], float(task_id)])
            rows_y.append(block["timeVector"])

    if not rows_x:
        return None, None

    return np.array(rows_x, dtype=float), np.array(rows_y, dtype=float)


def _clip_param(value: float, key: str) -> float:
    low, high = PARAMETER_BOUNDS[key]
    return float(np.clip(value, low, high))


def _compute_ref_point_for_maximization(train_objectives: "torch.Tensor") -> List[float]:
    mins = train_objectives.min(dim=0).values
    maxs = train_objectives.max(dim=0).values
    span = (maxs - mins).clamp_min(1e-6)
    ref = mins - 0.1 * span
    return ref.detach().cpu().tolist()


def _select_candidate_with_qlognehvi(
    blocks_by_task_id: Dict[int, List[Dict[str, Any]]],
    current_task_id: int,
) -> Tuple[Dict[str, float], Dict[str, Any]]:

    train_x_np, train_y_np = _build_multiobjective_training_data(blocks_by_task_id)
    if train_x_np is None or train_y_np is None:
        raise ValueError("No training data available for qLogNEHVI.")
    if train_x_np.shape[0] < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough observations for qLogNEHVI: {train_x_np.shape[0]} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    dtype = torch.double
    device = torch.device("cpu")

    train_x = torch.tensor(train_x_np, dtype=dtype, device=device)
    # We minimize completion times. qLogNEHVI maximizes objectives, so negate.
    train_obj = -torch.tensor(train_y_np, dtype=dtype, device=device)

    models = []
    for objective_idx in range(train_obj.shape[1]):
        y_i = train_obj[:, objective_idx : objective_idx + 1]
        models.append(
            SingleTaskGP(
                train_X=train_x,
                train_Y=y_i,
                outcome_transform=Standardize(m=1),
            )
        )

    model = ModelListGP(*models)
    mll = SumMarginalLogLikelihood(model.likelihood, model)
    fit_gpytorch_mll(mll)

    param_lows = [PARAMETER_BOUNDS[key][0] for key in REQUIRED_KEYS]
    param_highs = [PARAMETER_BOUNDS[key][1] for key in REQUIRED_KEYS]
    task_col = train_x[:, -1]
    task_low = float(task_col.min().item())
    task_high = float(task_col.max().item())

    bounds = torch.tensor(
        [param_lows + [task_low], param_highs + [task_high]],
        dtype=dtype,
        device=device,
    )

    ref_point = _compute_ref_point_for_maximization(train_obj)
    acquisition = qLogNoisyExpectedHypervolumeImprovement(
        model=model,
        ref_point=ref_point,
        X_baseline=train_x,
        prune_baseline=True,
    )

    candidate, _ = optimize_acqf(
        acq_function=acquisition,
        bounds=bounds,
        q=1,
        num_restarts=8,
        raw_samples=128,
        fixed_features={len(REQUIRED_KEYS): float(current_task_id)},
        options={"batch_limit": 4, "maxiter": 100},
    )

    candidate_batch = candidate.unsqueeze(0)
    acquisition_value = float(acquisition(candidate_batch).detach().cpu().item())

    # Approximate the candidate rank by comparing against random probes under the
    # same fixed participant task feature.
    probe_count = 64
    probe = torch.rand((probe_count, len(REQUIRED_KEYS) + 1), dtype=dtype, device=device)
    lower = bounds[0]
    upper = bounds[1]
    probe = lower + (upper - lower) * probe
    probe[:, len(REQUIRED_KEYS)] = float(current_task_id)
    probe_values = acquisition(probe.unsqueeze(1)).detach().cpu().numpy().tolist()
    better_count = sum(1 for value in probe_values if value > acquisition_value)
    candidate_rank_approx = int(better_count + 1)

    candidate_np = candidate.detach().cpu().numpy()[0]
    parameters = {
        "scrollFriction": _clip_param(float(candidate_np[0]), "scrollFriction"),
        "decelerationRate": _clip_param(float(candidate_np[1]), "decelerationRate"),
        "inflexion": _clip_param(float(candidate_np[2]), "inflexion"),
    }

    diagnostics = {
        "acquisitionValue": acquisition_value,
        "candidateRankApprox": candidate_rank_approx,
        "candidateRankProbeCount": probe_count,
        "refPoint": ref_point,
        "fixedTaskId": int(current_task_id),
        "trainingRowCount": int(train_x.shape[0]),
        "objectiveCount": int(train_obj.shape[1]),
    }

    return parameters, diagnostics


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    _normalize_current_params(input_data)
    current_participant_id = input_data.get("participantId")

    blocks_by_task_id, current_task_id = _normalize_participants_data(
        input_data.get("participantsData"), current_participant_id
    )
    total_block_observations = sum(len(blocks) for blocks in blocks_by_task_id.values())

    if current_task_id is None:
        raise ValueError("Current participant not found in normalized participantsData.")
    if total_block_observations < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough block observations for qLogNEHVI: {total_block_observations} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    best_candidate, diagnostics = _select_candidate_with_qlognehvi(
        blocks_by_task_id, current_task_id
    )
    strategy = "botorch-qlognehvi-multi-objective-10-target-times"

    return {
        "parameters": best_candidate,
        "inferenceDiagnostics": diagnostics,
        "modelMetadata": {
            "strategy": strategy,
            "version": "v3-botorch-qlognehvi",
            "participantCount": len(blocks_by_task_id),
            "totalBlockObservations": total_block_observations,
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
