import json
import math
import random
from typing import Any, Dict

REQUIRED_KEYS = (
    "scrollFriction",
    "x1",
    "x2",
    "inflexion",
    "physicalCoeffTuning",
    "maxLaunchVelocityPxMs",
)

TARGET_NUMBERS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300]


def model_fn(model_dir: str) -> Dict[str, Any]:
    # No persisted model artifact is required for this lightweight online policy.
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

    defaults = {
        "scrollFriction": 0.015,
        "x1": 0.78,
        "x2": 0.9,
        "inflexion": 0.35,
        "physicalCoeffTuning": 0.84,
        "maxLaunchVelocityPxMs": 40.0,
    }

    normalized = {}
    for key in REQUIRED_KEYS:
        value = candidate.get(key, defaults[key])
        try:
            normalized[key] = float(value)
        except (TypeError, ValueError):
            normalized[key] = float(defaults[key])

    return normalized


def _normalize_recent_data(raw_recent_data: Any) -> list[Dict[str, float]]:
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

        x1 = paper_params.get("x1") if paper_params.get("x1") is not None else paper_params.get("a")
        x2 = paper_params.get("x2") if paper_params.get("x2") is not None else paper_params.get("b")

        try:
            x1 = float(x1)
            x2 = float(x2)
        except (TypeError, ValueError):
            continue

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
                "x1": x1,
                "x2": x2,
                "targetNumber": target_number,
                "blockIndex": block_index,
            }
        )

    return normalized


def _build_block_observations(recent_data: list[Dict[str, float]]) -> list[Dict[str, Any]]:
    """Create one training observation per completed block with a 10-dim time vector."""
    if not recent_data:
        return []

    grouped: dict[int, list[Dict[str, float]]] = {}
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

        x1 = float(entries[0]["x1"])
        x2 = float(entries[0]["x2"])

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
                "x": [x1, x2],
                "timeVector": time_vector,
            }
        )

    return observations


def _rbf_kernel(x1: list[float], x2: list[float], length_scale: float = 0.1, sigma_f: float = 1.0) -> float:
    squared_distance = sum((a - b) ** 2 for a, b in zip(x1, x2))
    return sigma_f ** 2 * math.exp(-0.5 * squared_distance / (length_scale ** 2))


def _build_covariance_matrix(X: list[list[float]], noise: float) -> list[list[float]]:
    n = len(X)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            matrix[i][j] = _rbf_kernel(X[i], X[j])
            if i == j:
                matrix[i][j] += noise ** 2
    return matrix


def _solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float]:
    n = len(matrix)
    augmented = [row[:] + [vector[i]] for i, row in enumerate(matrix)]

    for i in range(n):
        pivot_row = max(range(i, n), key=lambda r: abs(augmented[r][i]))
        if abs(augmented[pivot_row][i]) < 1e-12:
            raise ValueError("Matrix is singular or ill-conditioned")
        augmented[i], augmented[pivot_row] = augmented[pivot_row], augmented[i]

        pivot = augmented[i][i]
        augmented[i] = [value / pivot for value in augmented[i]]

        for j in range(n):
            if j == i:
                continue
            factor = augmented[j][i]
            augmented[j] = [augmented[j][k] - factor * augmented[i][k] for k in range(n + 1)]

    return [augmented[i][n] for i in range(n)]


def _gp_predict_mean(X: list[list[float]], y: list[float], x_star: list[float], noise: float) -> float:
    K = _build_covariance_matrix(X, noise)
    alpha = _solve_linear_system(K, y)
    k_star = [_rbf_kernel(x_star, x_i) for x_i in X]
    return sum(k * a for k, a in zip(k_star, alpha))


def _generate_candidate_parameters(current: Dict[str, float], num_candidates: int = 50) -> list[Dict[str, float]]:
    candidates = []
    for _ in range(num_candidates):
        candidate = current.copy()
        candidate["x1"] = 0.6 + random.random() * 0.32
        candidate["x2"] = 0.8 + random.random() * 0.18
        candidates.append(candidate)
    candidates.append(current)
    return candidates


def _multi_objective_score(
    observations: list[Dict[str, Any]],
    candidate_x: list[float],
    noise: float,
) -> float:
    """Scalarize 10 objectives so all 10 target-times are optimized jointly."""
    X = [obs["x"] for obs in observations]
    predicted_times = []
    for objective_index in range(len(TARGET_NUMBERS)):
        y = [obs["timeVector"][objective_index] for obs in observations]
        predicted_times.append(_gp_predict_mean(X, y, candidate_x, noise=noise))

    mean_time = sum(predicted_times) / len(predicted_times)
    max_time = max(predicted_times)
    min_time = min(predicted_times)
    spread = max_time - min_time

    # Joint objective: minimize average time, worst-case time, and imbalance across targets.
    return mean_time + 0.35 * max_time + 0.10 * spread


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    current = _normalize_current_params(input_data)
    recent_data = _normalize_recent_data(input_data.get("recentData"))
    block_observations = _build_block_observations(recent_data)

    if len(block_observations) >= 2:
        candidates = _generate_candidate_parameters(current, num_candidates=100)

        try:
            best_candidate = min(
                candidates,
                key=lambda candidate: _multi_objective_score(
                    block_observations,
                    [candidate["x1"], candidate["x2"]],
                    noise=1.0,
                ),
            )
        except Exception:
            best_candidate = current
    else:
        best_candidate = current

    return {
        "parameters": best_candidate,
        "modelMetadata": {
            "strategy": "gaussian-process-multi-objective-10-target-times",
            "version": "v1",
            "dataPoints": len(recent_data),
            "blockObservations": len(block_observations),
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
