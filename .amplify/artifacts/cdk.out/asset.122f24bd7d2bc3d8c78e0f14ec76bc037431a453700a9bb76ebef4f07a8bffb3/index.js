var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// amplify/functions/next-parameter-set-monitor/handler.ts
var handler_exports = {};
__export(handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(handler_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var RUNS_PER_BLOCK = 10;
var dynamoClient = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var DEFAULT_PARAMETER_SET = Object.freeze({
  a: 0.1,
  b: 0.5,
  k: 1,
  alpha: 1,
  beta: 0.5,
  decay: 0.95,
  flickVelocityThreshold: 0.2,
  flickDistanceThreshold: 12
});
var buildNextParameterSet = (attemptCount) => {
  const generatedFromAttemptCount = Math.floor(attemptCount / RUNS_PER_BLOCK) * RUNS_PER_BLOCK;
  const completedBlockCount = Math.floor(attemptCount / RUNS_PER_BLOCK);
  const incrementMultiplier = completedBlockCount * 0.1;
  const withIncrement = (defaultValue) => defaultValue + defaultValue * incrementMultiplier;
  return {
    a: withIncrement(DEFAULT_PARAMETER_SET.a),
    b: withIncrement(DEFAULT_PARAMETER_SET.b),
    k: withIncrement(DEFAULT_PARAMETER_SET.k),
    alpha: withIncrement(DEFAULT_PARAMETER_SET.alpha),
    beta: withIncrement(DEFAULT_PARAMETER_SET.beta),
    decay: withIncrement(DEFAULT_PARAMETER_SET.decay),
    flickVelocityThreshold: withIncrement(DEFAULT_PARAMETER_SET.flickVelocityThreshold),
    flickDistanceThreshold: withIncrement(DEFAULT_PARAMETER_SET.flickDistanceThreshold),
    blockSize: RUNS_PER_BLOCK,
    status: "ready",
    source: "participant-block-trigger",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    generatedFromAttemptCount,
    completedBlockCount
  };
};
var handler = async (event) => {
  const participantTableName = process.env.PARTICIPANT_TABLE_NAME;
  if (!participantTableName) {
    throw new Error("Missing PARTICIPANT_TABLE_NAME environment variable");
  }
  const participantId = event.arguments.participantId;
  const attemptCount = Number(event.arguments.attemptCount);
  if (!participantId) {
    throw new Error("Missing participantId");
  }
  if (!Number.isFinite(attemptCount)) {
    throw new Error("Invalid attemptCount");
  }
  const nextParameterSet = buildNextParameterSet(attemptCount);
  await dynamoClient.send(
    new import_lib_dynamodb.UpdateCommand({
      TableName: participantTableName,
      Key: { id: participantId },
      UpdateExpression: "SET nextParameterSet = :nextParameterSet",
      ExpressionAttributeValues: {
        ":nextParameterSet": nextParameterSet
      }
    })
  );
  return {
    nextParameterSet: JSON.stringify(nextParameterSet)
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
