import json
from typing import Any, Dict

REQUIRED_KEYS = (
    "scrollFriction",
    "x1",
    "x2",
    "inflexion",
    "physicalCoeffTuning",
    "maxLaunchVelocityPxMs",
)


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


def _normalize_recent_data(raw_recent_data: Any) -> list[Dict[str, Any]]:
    if not isinstance(raw_recent_data, list):
        return []

    normalized = []
    for item in raw_recent_data:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def predict_fn(input_data: Dict[str, Any], model: Dict[str, Any]) -> Dict[str, Any]:
    current = _normalize_current_params(input_data)
    recent_data = _normalize_recent_data(input_data.get("recentData"))

    # Placeholder for an actual Gaussian process model.
    # The current code uses a simple step based on the latest block data
    # and maintains compatibility with a real SageMaker model interface.
    if recent_data:
        weights = []
        for attempt in recent_data:
            try:
                weights.append(float(attempt.get("scrollDistance", 0)))
            except (TypeError, ValueError):
                weights.append(0.0)

        variation = float(sum(weights) / len(weights)) if weights else 1.0
        increment = 0.05 + min(max(variation / 100.0, 0.0), 0.15)
    else:
        increment = 0.10

    next_params = {key: value * (1.0 + increment) for key, value in current.items()}

    return {
        "parameters": next_params,
        "modelMetadata": {
            "strategy": "active-learning-gaussian-placeholder",
            "version": "v1",
            "dataPoints": len(recent_data),
        },
    }


def output_fn(prediction: Dict[str, Any], accept: str) -> str:
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")

    return json.dumps(prediction)
