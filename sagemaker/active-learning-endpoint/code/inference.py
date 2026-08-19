import json
import sys

# Minimal deployment smoke test: NO machine-learning logic and NO third-party
# imports (no numpy/scikit-learn/torch). The only goal is to find out whether
# a SageMaker Serverless endpoint using this container image can reach
# InService at all. If this deploys successfully, the previous repeated
# "model process exited" failures came from the ML code or its dependencies;
# if it still fails, the cause is the container image / model packaging /
# endpoint configuration itself, independent of any Python ML code.
#
# These prints are flushed immediately so they appear in CloudWatch even if
# the process is killed right after.
print("DEBUG inference.py: module import start", flush=True)
print(f"DEBUG inference.py: python version={sys.version}", flush=True)
print("DEBUG inference.py: module import done", flush=True)


def model_fn(model_dir):
    print(f"DEBUG inference.py: model_fn called, model_dir={model_dir}", flush=True)
    return {}


def input_fn(request_body, request_content_type):
    print(f"DEBUG inference.py: input_fn called, content_type={request_content_type}", flush=True)
    if request_content_type != "application/json":
        raise ValueError(f"Unsupported content type: {request_content_type}")
    return json.loads(request_body)


def predict_fn(input_data, model):
    print("DEBUG inference.py: predict_fn called", flush=True)
    # Echo back a fixed, valid response so the endpoint is trivially testable.
    return {
        "parameters": input_data.get("currentParameterSet", {}),
        "modelMetadata": {
            "strategy": "deployment-smoke-test",
            "version": "test",
        },
    }


def output_fn(prediction, accept):
    print(f"DEBUG inference.py: output_fn called, accept={accept}", flush=True)
    if accept not in ("application/json", "*/*"):
        raise ValueError(f"Unsupported accept type: {accept}")
    return json.dumps(prediction)
