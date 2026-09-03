import json
import math
import os
import time
from datetime import datetime, timezone
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


def _to_dynamo(value):
    """Recursively convert Python floats to Decimal so the value can be written
    with boto3's DynamoDB resource, which rejects float types."""
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _to_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_dynamo(v) for v in value]
    return value


def _collect_numeric_field(attempts, key):
    """Return the numeric values stored under `key` across the given attempts,
    ignoring missing entries and non-numeric/boolean values."""
    values = []
    for attempt in attempts:
        if not isinstance(attempt, dict):
            continue
        value = attempt.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            values.append(float(value))
    return values


def _numeric_summary(values):
    """Compute count/mean/min/max/median/std for a list of numbers, or None if empty."""
    if not values:
        return None

    ordered = sorted(values)
    n = len(ordered)
    mean = sum(ordered) / n
    mid = n // 2
    median = ordered[mid] if n % 2 else (ordered[mid - 1] + ordered[mid]) / 2.0
    variance = sum((x - mean) ** 2 for x in ordered) / n

    return {
        "count": n,
        "mean": mean,
        "min": ordered[0],
        "max": ordered[-1],
        "median": median,
        "std": math.sqrt(variance),
    }


def _build_block_metrics(
    attempt_count,
    participant_attempts,
    tested_parameter_set,
    generated_parameter_set,
    raw_prediction,
    sagemaker_latency_ms,
    pooled_participant_count,
    pooled_attempt_count,
):
    """Summarize the block of trials that produced this parameter generation so
    each generated parameter block is accompanied by its own metrics record."""
    completed_block_count = math.floor(attempt_count / RUNS_PER_BLOCK)
    block_attempts = participant_attempts[-RUNS_PER_BLOCK:] if participant_attempts else []

    metrics = {
        "blockNumber": completed_block_count,
        "generatedFromAttemptCount": completed_block_count * RUNS_PER_BLOCK,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runsInBlock": len(block_attempts),
        "sagemakerLatencyMs": round(sagemaker_latency_ms, 1),
        "pooledParticipantCount": pooled_participant_count,
        "pooledAttemptCount": pooled_attempt_count,
        "testedParameterSet": tested_parameter_set,
        "generatedParameterSet": generated_parameter_set,
    }

    # Core behavioural summaries derived from the stored attempts.
    stat_fields = (
        ("timeMs", "completionTimeMs"),
        ("scrollDistance", "scrollDistancePx"),
        ("switchbackCount", "switchbacks"),
        ("overshootCount", "overshoots"),
        ("maxOvershootDistancePx", "maxOvershootDistancePx"),
    )
    for source_key, output_key in stat_fields:
        summary = _numeric_summary(_collect_numeric_field(block_attempts, source_key))
        if summary:
            metrics[output_key] = summary

    # Optional model diagnostics, only if the endpoint returned them.
    if isinstance(raw_prediction, dict):
        model_diagnostics = {}
        for score_key in ("score", "candidateScore", "acquisitionValue", "predictedMean", "predictedSpread"):
            value = raw_prediction.get(score_key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                model_diagnostics[score_key] = float(value)

        inference_diagnostics = raw_prediction.get("inferenceDiagnostics")
        if isinstance(inference_diagnostics, dict):
            for key in (
                "acquisitionValue",
                "candidateRankApprox",
                "candidateRankProbeCount",
                "fixedTaskId",
                "trainingRowCount",
                "objectiveCount",
            ):
                value = inference_diagnostics.get(key)
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    model_diagnostics[key] = float(value)

            ref_point = inference_diagnostics.get("refPoint")
            if isinstance(ref_point, list):
                numeric_ref_point = []
                for value in ref_point:
                    if isinstance(value, (int, float)) and not isinstance(value, bool):
                        numeric_ref_point.append(float(value))
                if numeric_ref_point:
                    model_diagnostics["refPoint"] = numeric_ref_point

        model_metadata = raw_prediction.get("modelMetadata")
        if isinstance(model_metadata, dict):
            strategy = model_metadata.get("strategy")
            version = model_metadata.get("version")
            participant_count = model_metadata.get("participantCount")
            total_block_observations = model_metadata.get("totalBlockObservations")

            if isinstance(strategy, str) and strategy:
                model_diagnostics["strategy"] = strategy
            if isinstance(version, str) and version:
                model_diagnostics["version"] = version
            if isinstance(participant_count, (int, float)) and not isinstance(participant_count, bool):
                model_diagnostics["participantCount"] = float(participant_count)
            if isinstance(total_block_observations, (int, float)) and not isinstance(total_block_observations, bool):
                model_diagnostics["totalBlockObservations"] = float(total_block_observations)

        if model_diagnostics:
            metrics["model"] = model_diagnostics

    return metrics


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


def _flatten_attempts_for_ml(raw_attempts):
    """Return a flat attempt list that is robust for both legacy and block-based formats."""
    if not isinstance(raw_attempts, list):
        return []

    # New format: [{runNumber, parameterSet, attempts:[...]}]
    looks_like_blocks = any(
        isinstance(entry, dict) and isinstance(entry.get("attempts"), list)
        for entry in raw_attempts
    )
    if looks_like_blocks:
        flattened = []
        for block_entry in raw_attempts:
            if not isinstance(block_entry, dict):
                continue

            run_number = block_entry.get("runNumber")
            parameter_set = block_entry.get("parameterSet")
            attempts = block_entry.get("attempts")
            if not isinstance(attempts, list):
                continue

            for idx, attempt in enumerate(attempts):
                if not isinstance(attempt, dict):
                    continue

                flattened.append(
                    {
                        **attempt,
                        "blockIndex": attempt.get("blockIndex") if attempt.get("blockIndex") is not None else run_number,
                        "attemptInBlock": attempt.get("attemptInBlock") if attempt.get("attemptInBlock") is not None else (idx + 1),
                        "blockParameterSet": attempt.get("blockParameterSet") if isinstance(attempt.get("blockParameterSet"), dict) else parameter_set,
                        # Keep compatibility for inference parser that reads paperParams.
                        "paperParams": attempt.get("paperParams") if isinstance(attempt.get("paperParams"), dict) else parameter_set,
                    }
                )

        return flattened

    # Legacy format: already a flat attempts list.
    return [entry for entry in raw_attempts if isinstance(entry, dict)]


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


def _scan_other_participants_data(table_name, exclude_participant_id):
    """Scan every participant except the calling one and return their flattened
    attempts so the SageMaker multi-task GP can pool observations across
    participants. Uses a projection (id, attempts) to keep the scan cheap and
    paginates via LastEvaluatedKey since Scan only returns up to 1MB per page.
    """
    table = dynamodb.Table(table_name)
    items = []
    scan_kwargs = {"ProjectionExpression": "id, attempts"}

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    participants_data = []
    for item in items:
        other_participant_id = item.get("id")
        if not other_participant_id or other_participant_id == exclude_participant_id:
            continue

        flat_attempts = _flatten_attempts_for_ml(_normalize_attempts(item.get("attempts")))
        if not flat_attempts:
            continue

        participants_data.append({
            "participantId": other_participant_id,
            "attempts": flat_attempts,
        })

    return participants_data


def _invoke_sagemaker(participant_id, attempt_count, current_parameter_set, participants_data):
    endpoint_name = os.environ.get("SAGEMAKER_ENDPOINT_NAME")
    if not endpoint_name:
        raise RuntimeError("Missing SAGEMAKER_ENDPOINT_NAME environment variable")

    payload = {
        "participantId": participant_id,
        "attemptCount": attempt_count,
        "completedBlockCount": math.floor(attempt_count / RUNS_PER_BLOCK),
        "runsPerBlock": RUNS_PER_BLOCK,
        "currentParameterSet": current_parameter_set,
        "participantsData": participants_data,
    }

    invoke_started = time.perf_counter()
    response = sagemaker_runtime.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="application/json",
        Body=json.dumps(payload).encode("utf-8"),
    )
    sagemaker_latency_ms = (time.perf_counter() - invoke_started) * 1000.0

    body = response.get("Body")
    raw = body.read().decode("utf-8") if body else ""
    if not raw:
        raise RuntimeError("SageMaker endpoint returned empty payload")

    parsed = json.loads(raw)
    normalized = _normalize_parameter_set(parsed)
    if not normalized:
        raise RuntimeError("SageMaker response missing required parameter fields")

    return normalized, parsed, sagemaker_latency_ms


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
    flat_attempts = _flatten_attempts_for_ml(attempts)

    if len(flat_attempts) < attempt_count:
        raise ValueError(
            f"Not enough attempts stored for participant {participant_id}: "
            f"expected at least {attempt_count}, got {len(flat_attempts)}"
        )

    # Pass all completed attempts up to the current attempt count to the ML pipeline.
    all_attempt_data = flat_attempts[:attempt_count]
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

    other_participants_data = _scan_other_participants_data(table_name, exclude_participant_id=participant_id)
    participants_data = other_participants_data + [
        {"participantId": participant_id, "attempts": all_attempt_data}
    ]

    generated_params, raw_prediction, sagemaker_latency_ms = _invoke_sagemaker(
        participant_id, attempt_count, current_params, participants_data
    )
    next_parameter_set = _build_next_parameter_set(attempt_count, generated_params)

    pooled_attempt_count = sum(len(entry.get("attempts", [])) for entry in participants_data)
    block_metrics = _build_block_metrics(
        attempt_count=attempt_count,
        participant_attempts=all_attempt_data,
        tested_parameter_set=current_params,
        generated_parameter_set=generated_params,
        raw_prediction=raw_prediction,
        sagemaker_latency_ms=sagemaker_latency_ms,
        pooled_participant_count=len(participants_data),
        pooled_attempt_count=pooled_attempt_count,
    )

    table = dynamodb.Table(table_name)
    table.update_item(
        Key={"id": participant_id},
        UpdateExpression=(
            "SET nextParameterSet = :nextParameterSet, "
            "parameterBlockMetrics = list_append(if_not_exists(parameterBlockMetrics, :empty), :metrics)"
        ),
        ExpressionAttributeValues={
            ":nextParameterSet": _to_dynamo(next_parameter_set),
            ":metrics": _to_dynamo([block_metrics]),
            ":empty": [],
        },
    )

    return {
        "nextParameterSet": json.dumps(next_parameter_set)
    }
