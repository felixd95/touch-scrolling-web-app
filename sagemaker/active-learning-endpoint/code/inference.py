import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

import gpytorch  # noqa: E402
import numpy as np  # noqa: E402

import torch  # noqa: E402
from botorch.acquisition import qNoisyExpectedImprovement  # noqa: E402
from botorch.fit import fit_gpytorch_mll  # noqa: E402
from botorch.models import SingleTaskGP  # noqa: E402
from botorch.models.transforms.outcome import Standardize  # noqa: E402
from gpytorch.mlls.exact_marginal_log_likelihood import (  # noqa: E402
    ExactMarginalLogLikelihood,
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

# Coarse search settings to keep endpoint latency stable.
BO_GRID_CANDIDATE_COUNT = 256
BO_PROBE_COUNT = 16

# Numerical stability configuration for GP fitting.
DEDUPLICATION_ROUND_DECIMALS = 6
OBSERVATION_NOISE_FLOOR = 1e-3
CHOLESKY_JITTER = 1e-3

# Convergence configuration: transition from global exploration to local refinement.
TRUST_REGION_START_BLOCK = 8
TRUST_REGION_TOP_K = 3
TRUST_REGION_HALF_SPAN_RATIO = 0.2

PARAMETER_DECIMALS = {
    "scrollFriction": 3,
    "inflexion": 2,
    "decelerationRate": 4,
}


def model_fn(model_dir: str) -> Dict[str, Any]:
    return {
        "model_dir": model_dir,
        "persistent_state": {
            "payload_signature": None,
            "fit_cache": {},
            "best_candidate": None,
            "diagnostics": None,
            "last_model": None,
            "last_ref_point": None,
            "last_input_scales": None,
        },
    }


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

        normalized_total_time = 0.0
        valid_measurements = 0
        for entry in entries:
            time_ms = entry.get("timeMs")
            target_number = entry.get("targetNumber")
            if not isinstance(time_ms, (int, float)):
                continue
            valid_measurements += 1
            try:
                target_number = float(target_number)
            except (TypeError, ValueError):
                target_number = 1.0
            target_number = max(target_number, 1.0)
            normalized_total_time += float(time_ms) / target_number

        if valid_measurements == 0:
            continue

        observations.append(
            {
                "blockIndex": block_idx,
                "x": x,
                "timeVector": [float(normalized_total_time)],
            }
        )

    return observations


def _select_training_block_window(
    participant_blocks: List[Dict[str, Any]],
    acquisition_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    return participant_blocks


def _normalize_participant_blocks(
    raw_participant_blocks: Any,
    acquisition_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    recent_data = _normalize_recent_data(raw_participant_blocks)
    blocks = _build_block_observations(recent_data)
    return _select_training_block_window(blocks, acquisition_config)


def _build_training_data(
    participant_blocks: List[Dict[str, Any]],
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    rows_x: List[List[float]] = []
    rows_y: List[List[float]] = []

    for block in participant_blocks:
        rows_x.append(list(block["x"]))
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
    scales: Dict[str, Any] = {"params": {}}

    for dim, key in enumerate(REQUIRED_KEYS):
        low, high = PARAMETER_BOUNDS[key]
        span = max(high - low, 1e-9)
        x[:, dim] = (x[:, dim] - low) / span
        x[:, dim] = np.clip(x[:, dim], 0.0, 1.0)
        scales["params"][key] = {"low": float(low), "high": float(high), "span": float(span)}

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
    return _sample_quantized_candidate_matrix_with_bounds(candidate_count)


def _sample_quantized_candidate_matrix_with_bounds(
    candidate_count: int,
    bounds_override: Optional[Dict[str, Tuple[float, float]]] = None,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    if candidate_count <= 0:
        candidate_count = 1

    local_rng = rng if rng is not None else np.random.default_rng()

    columns = []
    for key in REQUIRED_KEYS:
        low, high = PARAMETER_BOUNDS[key]
        if bounds_override and key in bounds_override:
            override_low, override_high = bounds_override[key]
            low = max(low, float(override_low))
            high = min(high, float(override_high))

        decimals = PARAMETER_DECIMALS[key]
        scale = 10 ** decimals
        low_i = int(np.ceil(low * scale))
        high_i = int(np.floor(high * scale))
        if high_i < low_i:
            low_i = high_i = int(round(DEFAULT_PARAMETER_SET[key] * scale))

        sampled_i = local_rng.integers(low_i, high_i + 1, size=candidate_count)
        columns.append(sampled_i.astype(float) / float(scale))

    return np.stack(columns, axis=1)


def _build_refinement_bounds(
    participant_blocks: List[Dict[str, Any]],
) -> Optional[Dict[str, Tuple[float, float]]]:
    if len(participant_blocks) < TRUST_REGION_START_BLOCK:
        return None

    ranked_blocks = sorted(
        participant_blocks,
        key=lambda block: float(block.get("timeVector", [float("inf")])[0]),
    )
    top_blocks = ranked_blocks[: max(1, TRUST_REGION_TOP_K)]
    if not top_blocks:
        return None

    top_x = np.array([block["x"] for block in top_blocks], dtype=float)
    center = np.mean(top_x, axis=0)

    bounds: Dict[str, Tuple[float, float]] = {}
    for dim, key in enumerate(REQUIRED_KEYS):
        base_low, base_high = PARAMETER_BOUNDS[key]
        span = max(base_high - base_low, 1e-9)
        half_span = max(TRUST_REGION_HALF_SPAN_RATIO * span, 1.0 / (10 ** PARAMETER_DECIMALS[key]))
        local_low = max(base_low, float(center[dim]) - half_span)
        local_high = min(base_high, float(center[dim]) + half_span)

        if local_high <= local_low:
            bounds[key] = (base_low, base_high)
        else:
            bounds[key] = (local_low, local_high)

    return bounds


def _build_deterministic_rng(participant_blocks: List[Dict[str, Any]]) -> np.random.Generator:
    seed_source = _payload_signature(participant_blocks)
    seed = int(seed_source[:16], 16) % (2 ** 32)
    return np.random.default_rng(seed)


def _normalize_candidate_matrix(candidate_params: np.ndarray, input_scales: Dict[str, Any]) -> np.ndarray:
    candidate_norm = np.zeros((candidate_params.shape[0], len(REQUIRED_KEYS)), dtype=float)
    for dim, key in enumerate(REQUIRED_KEYS):
        scale = input_scales["params"][key]
        span = max(float(scale["span"]), 1e-9)
        candidate_norm[:, dim] = (candidate_params[:, dim] - float(scale["low"])) / span
        candidate_norm[:, dim] = np.clip(candidate_norm[:, dim], 0.0, 1.0)
    return candidate_norm


def _compute_scalar_reference_point(train_objectives: "torch.Tensor") -> List[float]:
    mins = train_objectives.min(dim=0).values
    maxs = train_objectives.max(dim=0).values
    span = (maxs - mins).clamp_min(1e-6)
    ref = mins - 0.1 * span
    return ref.detach().cpu().tolist()


def _payload_signature(participant_blocks: List[Dict[str, Any]]) -> str:
    stable_rows = []
    for block in participant_blocks:
        stable_rows.append({
            "block_index": block.get("blockIndex"),
            "x": [float(v) for v in block.get("x", [])],
            "time_vector": [float(v) for v in block.get("timeVector", [])],
        })

    digest_payload = {"rows": stable_rows}
    return hashlib.sha256(json.dumps(digest_payload, sort_keys=True).encode("utf-8")).hexdigest()


def _get_persistent_model_state(model: Dict[str, Any]) -> Dict[str, Any]:
    state = model.setdefault("persistent_state", {})
    return state


def _normalize_acquisition_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    acquisition = payload.get("acquisition", {})
    if not isinstance(acquisition, dict):
        acquisition = {}

    strategy = "qnei"

    phase = acquisition.get("phase")
    if not isinstance(phase, str) or not phase.strip():
        phase = "adaptive-qnei"

    selection_mode = str(acquisition.get("selectionMode") or "acquisition").strip().lower()
    if selection_mode not in {"acquisition", "posterior-mean-minimizer"}:
        selection_mode = "acquisition"

    return {
        "strategy": strategy,
        "phase": phase,
        "selectionMode": selection_mode,
    }


def _build_acquisition_function(
    gp_model: SingleTaskGP,
    train_x: "torch.Tensor",
):
    return qNoisyExpectedImprovement(
        model=gp_model,
        X_baseline=train_x,
        prune_baseline=True,
    )


def _posterior_mean_std(gp_model: SingleTaskGP, x: "torch.Tensor") -> Tuple[float, float]:
    posterior = gp_model.posterior(x)
    mean = float(posterior.mean.squeeze().detach().cpu().item())
    variance = posterior.variance.clamp_min(0.0)
    std = float(variance.sqrt().squeeze().detach().cpu().item())
    return mean, std


def _select_candidate_with_single_objective(
    participant_blocks: List[Dict[str, Any]],
    acquisition_config: Dict[str, Any],
    current_params: Dict[str, float],
    persistent_state: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, float], Dict[str, Any]]:

    train_x_np, train_y_np = _build_training_data(participant_blocks)
    if train_x_np is None or train_y_np is None:
        raise ValueError("No training data available for scalar total-time optimization.")

    train_x_np, train_y_np, collapsed_row_count = _deduplicate_training_rows(train_x_np, train_y_np)
    if train_x_np.shape[0] < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough observations for scalar optimization: {train_x_np.shape[0]} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    train_x_norm_np, input_scales = _normalize_train_x_to_unit_cube(train_x_np)

    dtype = torch.double
    device = torch.device("cpu")

    train_x = torch.tensor(train_x_norm_np, dtype=dtype, device=device)
    train_y = torch.tensor(train_y_np[:, 0:1], dtype=dtype, device=device)
    # Minimize total normalized time; acquisition maximizes improvement, so negate.
    train_obj = -train_y

    yvar = torch.full_like(train_obj, OBSERVATION_NOISE_FLOOR)
    gp_model = SingleTaskGP(
        train_X=train_x,
        train_Y=train_obj,
        train_Yvar=yvar,
        outcome_transform=Standardize(m=1),
    )
    mll = ExactMarginalLogLikelihood(gp_model.likelihood, gp_model)
    with gpytorch.settings.cholesky_jitter(CHOLESKY_JITTER):
        fit_gpytorch_mll(mll)

    ref_point = _compute_scalar_reference_point(train_obj)
    strategy = acquisition_config["strategy"]
    selection_mode = acquisition_config.get("selectionMode", "acquisition")
    acquisition = _build_acquisition_function(
        gp_model=gp_model,
        train_x=train_x,
    )

    sampling_bounds = _build_refinement_bounds(participant_blocks)
    rng = _build_deterministic_rng(participant_blocks)

    candidate_params_np = _sample_quantized_candidate_matrix_with_bounds(
        BO_GRID_CANDIDATE_COUNT,
        bounds_override=sampling_bounds,
        rng=rng,
    )
    candidate_norm_np = _normalize_candidate_matrix(candidate_params_np, input_scales)
    candidate_norm = torch.tensor(candidate_norm_np, dtype=dtype, device=device)
    candidate_values = acquisition(candidate_norm.unsqueeze(1)).detach().cpu().numpy()

    candidate_posterior = gp_model.posterior(candidate_norm)
    candidate_mean_objs = candidate_posterior.mean.squeeze(-1).detach().cpu().numpy()

    if selection_mode == "posterior-mean-minimizer":
        best_index = int(np.argmax(candidate_mean_objs))
    else:
        best_index = int(np.argmax(candidate_values))

    acquisition_value = float(candidate_values[best_index])
    best_candidate_norm = candidate_norm[best_index : best_index + 1]

    probe_count = BO_PROBE_COUNT
    candidate_rank_approx = None
    if selection_mode == "acquisition":
        probe_params_np = _sample_quantized_candidate_matrix_with_bounds(
            probe_count,
            bounds_override=sampling_bounds,
            rng=rng,
        )
        probe_norm_np = _normalize_candidate_matrix(probe_params_np, input_scales)
        probe = torch.tensor(probe_norm_np, dtype=dtype, device=device)
        probe_values = acquisition(probe.unsqueeze(1)).detach().cpu().numpy().tolist()
        better_count = sum(1 for value in probe_values if value > acquisition_value)
        candidate_rank_approx = int(better_count + 1)

    candidate_np = best_candidate_norm.detach().cpu().numpy()[0]
    parameters = _denormalize_candidate_params(candidate_np, input_scales)

    current_param_vector = np.array(
        [[float(current_params[key]) for key in REQUIRED_KEYS]],
        dtype=float,
    )
    current_norm_np = _normalize_candidate_matrix(current_param_vector, input_scales)
    current_norm = torch.tensor(current_norm_np, dtype=dtype, device=device)

    candidate_mean_obj, candidate_std = _posterior_mean_std(gp_model, best_candidate_norm)
    current_mean_obj, current_std = _posterior_mean_std(gp_model, current_norm)

    best_observed_normalized_time = float(np.min(train_y_np[:, 0]))
    last_observed_normalized_time = float(train_y_np[-1, 0])
    predicted_candidate_normalized_time = float(-candidate_mean_obj)
    predicted_current_normalized_time = float(-current_mean_obj)
    predicted_improvement_vs_current = float(
        predicted_current_normalized_time - predicted_candidate_normalized_time
    )
    predicted_improvement_vs_best_observed = float(
        best_observed_normalized_time - predicted_candidate_normalized_time
    )

    diagnostics = {
        "acquisitionValue": acquisition_value,
        "selectionMode": selection_mode,
        "candidateRankProbeCount": probe_count,
        "acquisitionStrategy": strategy,
        "acquisitionPhase": acquisition_config.get("phase"),
        "trainingRowCount": int(train_x.shape[0]),
        "collapsedDuplicateRowCount": collapsed_row_count,
        "objectiveType": "total_normalized_time",
        "bestObservedNormalizedTime": best_observed_normalized_time,
        "lastObservedNormalizedTime": last_observed_normalized_time,
        "predictedCandidateNormalizedTime": predicted_candidate_normalized_time,
        "predictedCurrentNormalizedTime": predicted_current_normalized_time,
        "predictedImprovementVsCurrent": predicted_improvement_vs_current,
        "predictedImprovementVsBestObserved": predicted_improvement_vs_best_observed,
        "candidateUncertaintyStd": candidate_std,
        "currentUncertaintyStd": current_std,
        "searchBounds": sampling_bounds or {
            key: [float(PARAMETER_BOUNDS[key][0]), float(PARAMETER_BOUNDS[key][1])]
            for key in REQUIRED_KEYS
        },
    }

    if candidate_rank_approx is not None:
        diagnostics["candidateRankApprox"] = candidate_rank_approx

    if persistent_state is not None:
        persistent_state["last_model"] = gp_model
        persistent_state["last_ref_point"] = ref_point
        persistent_state["last_input_scales"] = input_scales
        persistent_state["fit_cache"] = {
            "train_x": train_x_np.tolist(),
            "train_y": train_y_np.tolist(),
            "acquisition": dict(acquisition_config),
        }

    return parameters, diagnostics


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    _normalize_current_params(input_data)
    acquisition_config = _normalize_acquisition_config(input_data)
    participant_blocks = _normalize_participant_blocks(
        input_data.get("participantBlocks"), acquisition_config
    )
    total_block_observations = len(participant_blocks)

    if total_block_observations < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough block observations for single-objective BO: {total_block_observations} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    persistent_state = _get_persistent_model_state(model)
    signature = _payload_signature(participant_blocks)
    cache_key = f"{signature}:{acquisition_config['strategy']}:{acquisition_config['phase']}:{acquisition_config['selectionMode']}"

    if persistent_state.get("payload_signature") == cache_key and persistent_state.get("best_candidate") is not None:
        best_candidate = persistent_state["best_candidate"]
        diagnostics = dict(persistent_state["diagnostics"] or {})
        diagnostics["modelReuse"] = True
        diagnostics["payloadSignature"] = signature
        diagnostics["acquisitionCacheKey"] = cache_key
    else:
        best_candidate, diagnostics = _select_candidate_with_single_objective(
            participant_blocks,
            acquisition_config,
            _normalize_current_params(input_data),
            persistent_state=persistent_state,
        )
        persistent_state["payload_signature"] = cache_key
        persistent_state["best_candidate"] = best_candidate
        persistent_state["diagnostics"] = diagnostics
        diagnostics = dict(diagnostics)
        diagnostics["modelReuse"] = False
        diagnostics["payloadSignature"] = signature
        diagnostics["acquisitionCacheKey"] = cache_key

    strategy = "botorch-qnoisy-ei-single-objective-per-participant-total-normalized-time"

    return {
        "parameters": best_candidate,
        "inferenceDiagnostics": diagnostics,
        "modelMetadata": {
            "strategy": strategy,
            "version": "v6-qnei-single-objective-per-participant-total-time",
            "participantCount": 1,
            "totalBlockObservations": total_block_observations,
            "acquisitionPhase": acquisition_config.get("phase"),
            "acquisitionStrategy": acquisition_config.get("strategy"),
            "selectionMode": acquisition_config.get("selectionMode"),
            "persistentModel": True,
            "modelReuse": bool(diagnostics.get("modelReuse", False)),
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
