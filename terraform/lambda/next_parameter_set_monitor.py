import json
import math
import os
from decimal import Decimal

import boto3

RUNS_PER_BLOCK = 10

DEFAULT_PARAMETER_SET = {
    "scrollFriction": 0.015,
    "x1": 0.78,
    "x2": 0.9,
    "inflexion": 0.35,
    "physicalCoeffTuning": 0.84,
    "maxLaunchVelocityPxMs": 40.0,
}

REQUIRED_KEYS = tuple(DEFAULT_PARAMETER_SET.keys())

dynamodb = boto3.resource("dynamodb")
sagemaker_runtime = boto3.client("sagemaker-runtime")


def _to_plain(value):
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, dict):
        return {k: _to_plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_plain(v) for v in value]
    return value


def _normalize_parameter_set(raw):
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return None

    if not isinstance(raw, dict):
        return None

    candidate = raw.get("parameters") if isinstance(raw.get("parameters"), dict) else raw

    normalized = {}
    for key, default in DEFAULT_PARAMETER_SET.items():
        value = candidate.get(key, default)
        try:
            normalized[key] = float(value)
        except Exception:
            return None

    return normalized


def _normalize_attempts(raw_attempts):
    if raw_attempts is None:
        return []
    if isinstance(raw_attempts, str):
        try:
            raw_attempts = json.loads(raw_attempts)
        except Exception:
            return []

    if isinstance(raw_attempts, dict) and "L" in raw_attempts:
        raw_attempts = _to_plain(raw_attempts)

    if not isinstance(raw_attempts, list):
        return []

    return [_to_plain(item) for item in raw_attempts]


def _load_participant_state(table_name, participant_id):
    table = dynamodb.Table(table_name)
    response = table.get_item(
        Key={"id": participant_id},
        ProjectionExpression="currentParameterSet,nextParameterSet,attempts"
    )
    item = response.get("Item", {})
    return {
        "currentParameterSet": item.get("currentParameterSet"),
        "nextParameterSet": item.get("nextParameterSet"),
        "attempts": _normalize_attempts(item.get("attempts")),
    }


def _invoke_sagemaker(participant_id, attempt_count, current_parameter_set, recent_data):
    endpoint_name = os.environ.get("SAGEMAKER_ENDPOINT_NAME")
    if not endpoint_name:
        raise RuntimeError("Missing SAGEMAKER_ENDPOINT_NAME environment variable")

    payload = {
        "participantId": participant_id,
        "attemptCount": attempt_count,
        "completedBlockCount": math.floor(attempt_count / RUNS_PER_BLOCK),
        "runsPerBlock": RUNS_PER_BLOCK,
        "currentParameterSet": current_parameter_set,
        "recentData": recent_data,
    }

    response = sagemaker_runtime.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="application/json",
        Body=json.dumps(payload).encode("utf-8"),
    )

    body = response.get("Body")
    raw = body.read().decode("utf-8") if body else ""
    if not raw:
        raise RuntimeError("SageMaker endpoint returned empty payload")

    parsed = json.loads(raw)
    normalized = _normalize_parameter_set(parsed)
    if not normalized:
        raise RuntimeError("SageMaker response missing required parameter fields")

    return normalized


def _build_next_parameter_set(attempt_count, generated_params):
    completed_block_count = math.floor(attempt_count / RUNS_PER_BLOCK)
    generated_from_attempt_count = completed_block_count * RUNS_PER_BLOCK

    return {
        **generated_params,
        "blockSize": RUNS_PER_BLOCK,
        "status": "ready",
        "source": "terraform-appsync-sagemaker-active-learning",
        "generatedFromAttemptCount": generated_from_attempt_count,
        "completedBlockCount": completed_block_count,
    }


def handler(event, context):
    table_name = os.environ.get("PARTICIPANT_TABLE_NAME")
    if not table_name:
        raise RuntimeError("Missing PARTICIPANT_TABLE_NAME environment variable")

    args = (event or {}).get("arguments") or {}
    participant_id = args.get("participantId")
    attempt_count = int(args.get("attemptCount", 0))

    if not participant_id:
        raise ValueError("Missing participantId")

    if attempt_count <= 0 or attempt_count % RUNS_PER_BLOCK != 0:
        raise ValueError(f"attemptCount must be an exact multiple of {RUNS_PER_BLOCK}")

    participant_state = _load_participant_state(table_name, participant_id)
    attempts = participant_state.get("attempts", [])

    if len(attempts) < attempt_count:
        raise ValueError(
            f"Not enough attempts stored for participant {participant_id}: "
            f"expected at least {attempt_count}, got {len(attempts)}"
        )

    # Pass all completed attempts up to the current attempt count to the ML pipeline.
    all_attempt_data = attempts[:attempt_count]
    if len(all_attempt_data) < attempt_count:
        raise ValueError(
            f"Not enough stored attempts for participant {participant_id}: "
            f"expected {attempt_count}, got {len(all_attempt_data)}"
        )

    current_params = (
        _normalize_parameter_set(participant_state.get("currentParameterSet"))
        or _normalize_parameter_set(participant_state.get("nextParameterSet"))
        or dict(DEFAULT_PARAMETER_SET)
    )
    generated_params = _invoke_sagemaker(participant_id, attempt_count, current_params, all_attempt_data)
    next_parameter_set = _build_next_parameter_set(attempt_count, generated_params)

    table = dynamodb.Table(table_name)
    table.update_item(
        Key={"id": participant_id},
        UpdateExpression="SET nextParameterSet = :nextParameterSet",
        ExpressionAttributeValues={":nextParameterSet": next_parameter_set},
    )

    return {
        "nextParameterSet": json.dumps(next_parameter_set)
    }
