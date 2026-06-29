// amplify/functions/next-parameter-set-monitor/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
var RUNS_PER_BLOCK = 10;
var dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
var DEFAULT_PARAMETER_SET = Object.freeze({
  a: 0.1,
  b: 0.5,
  gamma: 1,
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
    gamma: withIncrement(DEFAULT_PARAMETER_SET.gamma),
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
    new UpdateCommand({
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
export {
  handler
};
