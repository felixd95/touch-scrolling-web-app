// amplify/functions/next-parameter-set-monitor/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
var RUNS_PER_BLOCK = 10;
var dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
var DEFAULT_PARAMETER_SET = Object.freeze({
  scrollFriction: 0.015,
  x1: 0.78,
  x2: 0.9,
  inflexion: 0.35,
  physicalCoeffTuning: 0.84,
  maxLaunchVelocityPxMs: 40
});
var buildNextParameterSet = (attemptCount) => {
  const generatedFromAttemptCount = Math.floor(attemptCount / RUNS_PER_BLOCK) * RUNS_PER_BLOCK;
  const completedBlockCount = Math.floor(attemptCount / RUNS_PER_BLOCK);
  const incrementMultiplier = completedBlockCount * 0.1;
  const withIncrement = (defaultValue) => defaultValue + defaultValue * incrementMultiplier;
  return {
    scrollFriction: withIncrement(DEFAULT_PARAMETER_SET.scrollFriction),
    x1: withIncrement(DEFAULT_PARAMETER_SET.x1),
    x2: withIncrement(DEFAULT_PARAMETER_SET.x2),
    inflexion: withIncrement(DEFAULT_PARAMETER_SET.inflexion),
    physicalCoeffTuning: withIncrement(DEFAULT_PARAMETER_SET.physicalCoeffTuning),
    maxLaunchVelocityPxMs: withIncrement(DEFAULT_PARAMETER_SET.maxLaunchVelocityPxMs),
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
