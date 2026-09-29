import json
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np  # noqa: E402

import torch  # noqa: E402
from botorch.acquisition import qLogNoisyExpectedImprovement  # noqa: E402
from botorch.acquisition.analytic import PosteriorMean  # noqa: E402
from botorch.fit import fit_gpytorch_mll  # noqa: E402
from botorch.models import SingleTaskGP  # noqa: E402
from botorch.models.transforms.input import Normalize  # noqa: E402
from botorch.models.transforms.outcome import Standardize  # noqa: E402
from botorch.optim import optimize_acqf  # noqa: E402
from botorch.sampling.normal import SobolQMCNormalSampler  # noqa: E402
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



def _load_parameter_bounds() -> Dict[str, Tuple[float, float]]:
    # Shared source of truth with the frontend (src/scrollPhysics/parameterBounds.json).
    # Terraform packages a copy next to this file as code/parameter_bounds.json; the
    # repo-relative path is the fallback for local runs.
    candidate_paths = (
        os.path.join(os.path.dirname(__file__), "parameter_bounds.json"),
        os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "src", "scrollPhysics", "parameterBounds.json",
        ),
    )
    for path in candidate_paths:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                raw = json.load(handle)
            return {
                key: (float(raw[key]["min"]), float(raw[key]["max"]))
                for key in REQUIRED_KEYS
            }
        except (OSError, ValueError, KeyError, TypeError):
            continue
    raise RuntimeError(
        "Parameter bounds file not found (code/parameter_bounds.json or "
        "src/scrollPhysics/parameterBounds.json)."
    )


PARAMETER_BOUNDS = _load_parameter_bounds()

MIN_OBSERVATIONS_FOR_BO = 2

# Acquisition-function optimization settings (BoTorch closed-loop qNEI tutorial).
MC_SAMPLES = 128
NUM_RESTARTS = 10
RAW_SAMPLES = 256

PARAMETER_DECIMALS = {
    "scrollFriction": 3,
    "inflexion": 2,
    "decelerationRate": 4,
}


def model_fn(model_dir: str) -> Dict[str, Any]:
    return {"model_dir": model_dir}


def input_fn(request_body: str, request_content_type: str) -> Dict[str, Any]:
    if request_content_type != "application/json":
        raise ValueError(f"Unsupported content type: {request_content_type}")

    payload = json.loads(request_body)
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")

    return payload


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


def _normalize_participant_blocks(raw_participant_blocks: Any) -> List[Dict[str, Any]]:
    recent_data = _normalize_recent_data(raw_participant_blocks)
    return _build_block_observations(recent_data)


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


def _parameter_bounds_tensor(dtype: "torch.dtype", device: "torch.device") -> "torch.Tensor":
    lows = [PARAMETER_BOUNDS[key][0] for key in REQUIRED_KEYS]
    highs = [PARAMETER_BOUNDS[key][1] for key in REQUIRED_KEYS]
    return torch.tensor([lows, highs], dtype=dtype, device=device)


def _select_candidate(
    participant_blocks: List[Dict[str, Any]],
    acquisition_phase: Optional[str],
) -> Tuple[Dict[str, float], Dict[str, Any]]:
    train_x_np, train_y_np = _build_training_data(participant_blocks)
    if train_x_np is None or train_y_np is None:
        raise ValueError("No training data available for qNEI optimization.")
    if train_x_np.shape[0] < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough observations for qNEI: {train_x_np.shape[0]} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    dtype = torch.double
    device = torch.device("cpu")
    bounds = _parameter_bounds_tensor(dtype, device)

    train_x = torch.tensor(train_x_np, dtype=dtype, device=device)
    train_y = torch.tensor(train_y_np[:, 0:1], dtype=dtype, device=device)
    # Minimize total normalized time; BoTorch maximizes, so optimize the negative.
    train_obj = -train_y

    model = SingleTaskGP(
        train_X=train_x,
        train_Y=train_obj,
        input_transform=Normalize(d=train_x.shape[-1], bounds=bounds),
        outcome_transform=Standardize(m=1),
    )
    mll = ExactMarginalLogLikelihood(model.likelihood, model)
    fit_gpytorch_mll(mll)

    # Training blocks explore/exploit with qNEI; the final recommendation returns the
    # model's best estimate (posterior-mean optimum), not an exploratory proposal.
    if acquisition_phase == "final-model":
        acqf = PosteriorMean(model)
        strategy_name = "PosteriorMean"
    else:
        sampler = SobolQMCNormalSampler(sample_shape=torch.Size([MC_SAMPLES]))
        acqf = qLogNoisyExpectedImprovement(
            model=model,
            X_baseline=train_x,
            sampler=sampler,
            prune_baseline=True,
        )
        strategy_name = "qLogNoisyExpectedImprovement"

    candidate, acq_value = optimize_acqf(
        acq_function=acqf,
        bounds=bounds,
        q=1,
        num_restarts=NUM_RESTARTS,
        raw_samples=RAW_SAMPLES,
    )

    candidate_np = candidate.detach().cpu().numpy()[0]
    parameters: Dict[str, float] = {}
    for dim, key in enumerate(REQUIRED_KEYS):
        low, high = PARAMETER_BOUNDS[key]
        value = float(np.clip(candidate_np[dim], low, high))
        parameters[key] = round(value, PARAMETER_DECIMALS.get(key, 4))

    diagnostics = {
        "acquisitionStrategy": strategy_name,
        "acquisitionPhase": acquisition_phase,
        "acquisitionValue": float(acq_value.detach().cpu().item()),
        "trainingRowCount": int(train_x.shape[0]),
        "objectiveType": "total_normalized_time",
        "bestObservedNormalizedTime": float(np.min(train_y_np[:, 0])),
    }
    return parameters, diagnostics


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    participant_blocks = _normalize_participant_blocks(input_data.get("participantBlocks"))
    total_block_observations = len(participant_blocks)
    if total_block_observations < MIN_OBSERVATIONS_FOR_BO:
        raise ValueError(
            f"Not enough block observations for qNEI: {total_block_observations} < {MIN_OBSERVATIONS_FOR_BO}."
        )

    acquisition = input_data.get("acquisition")
    acquisition_phase = None
    if isinstance(acquisition, dict):
        phase_value = acquisition.get("phase")
        if isinstance(phase_value, str) and phase_value.strip():
            acquisition_phase = phase_value

    parameters, diagnostics = _select_candidate(participant_blocks, acquisition_phase)

    return {
        "parameters": parameters,
        "inferenceDiagnostics": diagnostics,
        "modelMetadata": {
            "strategy": "botorch-qlognei-single-objective-total-normalized-time",
            "participantCount": 1,
            "totalBlockObservations": total_block_observations,
            "acquisitionPhase": acquisition_phase,
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
