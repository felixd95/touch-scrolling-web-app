import json
from typing import Any, Dict, List, Optional, Tuple

import gpytorch  # noqa: E402
import numpy as np  # noqa: E402

import torch  # noqa: E402
from botorch.acquisition.multi_objective.logei import (  # noqa: E402
    qLogNoisyExpectedHypervolumeImprovement,
)
from botorch.fit import fit_gpytorch_mll  # noqa: E402
from botorch.models import ModelListGP, SingleTaskGP  # noqa: E402
from botorch.models.transforms.outcome import Standardize  # noqa: E402
from gpytorch.mlls.sum_marginal_log_likelihood import (  # noqa: E402
    SumMarginalLogLikelihood,
)

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
MAX_BLOCKS_PER_PARTICIPANT = 5

# Coarse search settings to keep endpoint latency stable.
BO_GRID_CANDIDATE_COUNT = 256
BO_PROBE_COUNT = 16

# Numerical stability configuration for GP fitting.
DEDUPLICATION_ROUND_DECIMALS = 6
OBSERVATION_NOISE_FLOOR = 1e-4
CHOLESKY_JITTER = 1e-3

PARAMETER_DECIMALS = {
    "scrollFriction": 3,
    "inflexion": 2,
    "decelerationRate": 4,
}


def model_fn(model_dir: str) -> Dict[str, Any]:
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
        aggregate_times = []
        for entry in entries:
            target = entry.get("targetNumber")
            time_ms = entry.get("timeMs")
            if isinstance(time_ms, float):
                aggregate_times.append(time_ms)
                if target in times_per_target:
                    times_per_target[target].append(time_ms)

        available_times = [t for vals in times_per_target.values() for t in vals]
        if not aggregate_times:
            continue

        # If target numbers are not available (new aggregated block format), use
        # the block-level total/mean time as a shared objective proxy.
        fallback_time = float(sum(aggregate_times) / len(aggregate_times))
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
        if len(blocks) > MAX_BLOCKS_PER_PARTICIPANT:
            blocks = blocks[-MAX_BLOCKS_PER_PARTICIPANT:]
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


def _deduplicate_training_rows(
    train_x_np: np.ndarray,
    train_y_np: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, int]:
    # Repeated/near-identical X rows can make K nearly singular. Collapse
    # duplicates by averaging Y per rounded X key.
    buckets: Dict[Tuple[float, ...], List[np.ndarray]] = {}
    for idx in range(train_x_np.shape[0]):
        key = tuple(np.round(train_x_np[idx], DEDUPLICATION_ROUND_DECIMALS).tolist())
        buckets.setdefault(key, []).append(train_y_np[idx])

    dedup_x: List[List[float]] = []
    dedup_y: List[List[float]] = []
    for key, rows in buckets.items():
        dedup_x.append(list(key))
        dedup_y.append(np.mean(np.stack(rows, axis=0), axis=0).tolist())

    return (
        np.array(dedup_x, dtype=float),
        np.array(dedup_y, dtype=float),
        int(train_x_np.shape[0] - len(dedup_x)),
    )


def _clip_param(value: float, key: str) -> float:
    low, high = PARAMETER_BOUNDS[key]
    return float(np.clip(value, low, high))


def _normalize_train_x_to_unit_cube(
    train_x_np: np.ndarray,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    x = train_x_np.copy()
    scales: Dict[str, Any] = {
        "params": {},
        "task": {},
    }

    for dim, key in enumerate(REQUIRED_KEYS):
        low, high = PARAMETER_BOUNDS[key]
        span = max(high - low, 1e-9)
        x[:, dim] = (x[:, dim] - low) / span
        x[:, dim] = np.clip(x[:, dim], 0.0, 1.0)
        scales["params"][key] = {"low": float(low), "high": float(high), "span": float(span)}

    task_low = float(np.min(train_x_np[:, -1]))
    task_high = float(np.max(train_x_np[:, -1]))
    task_span = max(task_high - task_low, 1e-9)
    if task_high > task_low:
        x[:, -1] = (x[:, -1] - task_low) / task_span
        x[:, -1] = np.clip(x[:, -1], 0.0, 1.0)
    else:
        x[:, -1] = 0.0

    scales["task"] = {
        "low": task_low,
        "high": task_high,
        "span": float(task_span),
        "isDegenerate": bool(task_high <= task_low),
    }

    return x, scales


def _denormalize_candidate_params(candidate_norm: np.ndarray, scales: Dict[str, Any]) -> Dict[str, float]:
    params = {}
    for dim, key in enumerate(REQUIRED_KEYS):
        scale = scales["params"][key]
        value = float(scale["low"] + float(candidate_norm[dim]) * float(scale["span"]))
        clipped = _clip_param(value, key)
        params[key] = round(clipped, PARAMETER_DECIMALS.get(key, 4))
    return params


def _sample_quantized_candidate_matrix(candidate_count: int) -> np.ndarray:
    if candidate_count <= 0:
        candidate_count = 1

    columns = []
    for key in REQUIRED_KEYS:
        low, high = PARAMETER_BOUNDS[key]
        decimals = PARAMETER_DECIMALS[key]
        scale = 10 ** decimals
        low_i = int(np.ceil(low * scale))
        high_i = int(np.floor(high * scale))
        if high_i < low_i:
            low_i = high_i = int(round(DEFAULT_PARAMETER_SET[key] * scale))

        sampled_i = np.random.randint(low_i, high_i + 1, size=candidate_count)
        columns.append(sampled_i.astype(float) / float(scale))

    return np.stack(columns, axis=1)


def _normalize_candidate_matrix(
    candidate_params: np.ndarray,
    input_scales: Dict[str, Any],
    fixed_task_feature: float,
) -> np.ndarray:
    candidate_norm = np.zeros((candidate_params.shape[0], len(REQUIRED_KEYS) + 1), dtype=float)
    for dim, key in enumerate(REQUIRED_KEYS):
        scale = input_scales["params"][key]
        span = max(float(scale["span"]), 1e-9)
        candidate_norm[:, dim] = (candidate_params[:, dim] - float(scale["low"])) / span
        candidate_norm[:, dim] = np.clip(candidate_norm[:, dim], 0.0, 1.0)

    candidate_norm[:, len(REQUIRED_KEYS)] = float(np.clip(fixed_task_feature, 0.0, 1.0))
    return candidate_norm


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

    train_x_np, train_y_np, collapsed_row_count = _deduplicate_training_rows(train_x_np, train_y_np)
    if train_x_np.shape[0] < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough observations for qLogNEHVI: {train_x_np.shape[0]} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    train_x_norm_np, input_scales = _normalize_train_x_to_unit_cube(train_x_np)

    dtype = torch.double
    device = torch.device("cpu")

    train_x = torch.tensor(train_x_norm_np, dtype=dtype, device=device)
    # We minimize completion times. qLogNEHVI maximizes objectives, so negate.
    train_obj = -torch.tensor(train_y_np, dtype=dtype, device=device)

    models = []
    for objective_idx in range(train_obj.shape[1]):
        y_i = train_obj[:, objective_idx : objective_idx + 1]
        yvar_i = torch.full_like(y_i, OBSERVATION_NOISE_FLOOR)
        models.append(
            SingleTaskGP(
                train_X=train_x,
                train_Y=y_i,
                train_Yvar=yvar_i,
                outcome_transform=Standardize(m=1),
            )
        )

    model = ModelListGP(*models)
    mll = SumMarginalLogLikelihood(model.likelihood, model)
    with gpytorch.settings.cholesky_jitter(CHOLESKY_JITTER):
        fit_gpytorch_mll(mll)

    task_scale = input_scales["task"]
    if task_scale.get("isDegenerate"):
        fixed_task_feature = 0.0
    else:
        fixed_task_feature = float(
            (float(current_task_id) - float(task_scale["low"])) / float(task_scale["span"])
        )
        fixed_task_feature = float(np.clip(fixed_task_feature, 0.0, 1.0))

    ref_point = _compute_ref_point_for_maximization(train_obj)
    acquisition = qLogNoisyExpectedHypervolumeImprovement(
        model=model,
        ref_point=ref_point,
        X_baseline=train_x,
        prune_baseline=True,
    )

    candidate_params_np = _sample_quantized_candidate_matrix(BO_GRID_CANDIDATE_COUNT)
    candidate_norm_np = _normalize_candidate_matrix(candidate_params_np, input_scales, fixed_task_feature)
    candidate_norm = torch.tensor(candidate_norm_np, dtype=dtype, device=device)
    candidate_values = acquisition(candidate_norm.unsqueeze(1)).detach().cpu().numpy()
    best_index = int(np.argmax(candidate_values))
    acquisition_value = float(candidate_values[best_index])
    best_candidate_norm = candidate_norm[best_index : best_index + 1]

    # Approximate the candidate rank by comparing against random probes under the
    # same fixed participant task feature.
    probe_count = BO_PROBE_COUNT
    probe_params_np = _sample_quantized_candidate_matrix(probe_count)
    probe_norm_np = _normalize_candidate_matrix(probe_params_np, input_scales, fixed_task_feature)
    probe = torch.tensor(probe_norm_np, dtype=dtype, device=device)
    probe_values = acquisition(probe.unsqueeze(1)).detach().cpu().numpy().tolist()
    better_count = sum(1 for value in probe_values if value > acquisition_value)
    candidate_rank_approx = int(better_count + 1)

    candidate_np = best_candidate_norm.detach().cpu().numpy()[0]
    parameters = _denormalize_candidate_params(candidate_np, input_scales)

    diagnostics = {
        "acquisitionValue": acquisition_value,
        "candidateRankApprox": candidate_rank_approx,
        "candidateRankProbeCount": probe_count,
        "refPoint": ref_point,
        "fixedTaskId": int(current_task_id),
        "fixedTaskFeatureNormalized": fixed_task_feature,
        "inputNormalization": {
            "type": "min-max-unit-cube",
            "parameterBounds": PARAMETER_BOUNDS,
            "task": task_scale,
        },
        "trainingRowCount": int(train_x.shape[0]),
        "collapsedDuplicateRowCount": collapsed_row_count,
        "objectiveCount": int(train_obj.shape[1]),
        "numericalStability": {
            "deduplicationRoundDecimals": DEDUPLICATION_ROUND_DECIMALS,
            "observationNoiseFloor": OBSERVATION_NOISE_FLOOR,
            "choleskyJitter": CHOLESKY_JITTER,
        },
        "searchConfig": {
            "strategy": "quantized-random-acquisition-search",
            "gridCandidateCount": BO_GRID_CANDIDATE_COUNT,
            "probeCount": BO_PROBE_COUNT,
            "maxBlocksPerParticipant": MAX_BLOCKS_PER_PARTICIPANT,
            "parameterDecimals": PARAMETER_DECIMALS,
        },
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
