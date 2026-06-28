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
var import_util_dynamodb = require("@aws-sdk/util-dynamodb");
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
var parseAttempts = (attemptsRaw) => {
  if (Array.isArray(attemptsRaw)) return attemptsRaw;
  if (typeof attemptsRaw === "string") {
    try {
      const parsed = JSON.parse(attemptsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};
var getAttemptsCount = (recordNewImage, participant) => {
  const rawAttempts = recordNewImage?.attempts;
  if (rawAttempts && Array.isArray(rawAttempts.L)) {
    return rawAttempts.L.length;
  }
  const parsedAttempts = parseAttempts(participant.attempts);
  if (parsedAttempts.length > 0) {
    return parsedAttempts.length;
  }
  if (participant.attempts && typeof participant.attempts === "object") {
    const attemptsObject = participant.attempts;
    if (Array.isArray(attemptsObject.L)) {
      return (attemptsObject.L || []).length;
    }
    const keys = Object.keys(attemptsObject);
    const looksLikeIndexedObject = keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
    if (looksLikeIndexedObject) {
      return keys.length;
    }
  }
  return 0;
};
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
    source: "participant-stream-monitor",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    generatedFromAttemptCount,
    completedBlockCount
  };
};
var handler = async (event) => {
  for (const record of event.Records) {
    if (!record.dynamodb?.NewImage) continue;
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    const eventSourceArn = record.eventSourceARN;
    const participantTableName = eventSourceArn?.split(":table/")[1]?.split("/stream/")[0];
    if (!participantTableName) {
      throw new Error("Unable to determine participant table name from stream event");
    }
    const participant = (0, import_util_dynamodb.unmarshall)(record.dynamodb.NewImage);
    const participantId = typeof participant.id === "string" ? participant.id : null;
    if (!participantId) continue;
    const currentNextParameterSet = participant.nextParameterSet && typeof participant.nextParameterSet === "object" ? participant.nextParameterSet : null;
    const attemptCount = getAttemptsCount(record.dynamodb.NewImage, participant);
    const nextParameterSet = buildNextParameterSet(attemptCount);
    console.log(
      `next-parameter-set-monitor participantId=${participantId} attemptCount=${attemptCount} generatedFromAttemptCount=${nextParameterSet.generatedFromAttemptCount}`
    );
    if (currentNextParameterSet?.status === "ready" && Number(currentNextParameterSet.generatedFromAttemptCount) === nextParameterSet.generatedFromAttemptCount) {
      continue;
    }
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
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
