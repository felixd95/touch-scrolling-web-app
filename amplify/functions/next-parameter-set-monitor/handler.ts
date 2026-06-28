import type { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const RUNS_PER_BLOCK = 10;

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const DEFAULT_PARAMETER_SET = Object.freeze({
  a: 0.1,
  b: 0.5,
  k: 1.0,
  alpha: 1.0,
  beta: 0.5,
  decay: 0.95,
  flickVelocityThreshold: 0.2,
  flickDistanceThreshold: 12,
});

const parseAttempts = (attemptsRaw: unknown) => {
  if (Array.isArray(attemptsRaw)) return attemptsRaw;

  if (typeof attemptsRaw === 'string') {
    try {
      const parsed = JSON.parse(attemptsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const getAttemptsCount = (recordNewImage: Record<string, unknown> | undefined, participant: Record<string, unknown>) => {
  const rawAttempts = recordNewImage?.attempts as { L?: unknown[] } | undefined;
  if (rawAttempts && Array.isArray(rawAttempts.L)) {
    return rawAttempts.L.length;
  }

  const parsedAttempts = parseAttempts(participant.attempts);
  if (parsedAttempts.length > 0) {
    return parsedAttempts.length;
  }

  if (participant.attempts && typeof participant.attempts === 'object') {
    const attemptsObject = participant.attempts as Record<string, unknown>;

    if (Array.isArray((attemptsObject as { L?: unknown[] }).L)) {
      return ((attemptsObject as { L?: unknown[] }).L || []).length;
    }

    const keys = Object.keys(attemptsObject);
    const looksLikeIndexedObject = keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
    if (looksLikeIndexedObject) {
      return keys.length;
    }
  }

  return 0;
};

const buildNextParameterSet = (attemptCount: number) => {
  const generatedFromAttemptCount = Math.floor(attemptCount / RUNS_PER_BLOCK) * RUNS_PER_BLOCK;
  const completedBlockCount = Math.floor(attemptCount / RUNS_PER_BLOCK);
  const incrementMultiplier = completedBlockCount * 0.1;
  const withIncrement = (defaultValue: number) => defaultValue + defaultValue * incrementMultiplier;

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
    status: 'ready',
    source: 'participant-stream-monitor',
    generatedAt: new Date().toISOString(),
    generatedFromAttemptCount,
    completedBlockCount,
  };
};

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (!record.dynamodb?.NewImage) continue;
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') continue;

    const eventSourceArn = record.eventSourceARN;
    const participantTableName = eventSourceArn?.split(':table/')[1]?.split('/stream/')[0];
    if (!participantTableName) {
      throw new Error('Unable to determine participant table name from stream event');
    }

    const participant = unmarshall(record.dynamodb.NewImage) as Record<string, unknown>;
    const participantId = typeof participant.id === 'string' ? participant.id : null;
    if (!participantId) continue;

    const currentNextParameterSet =
      participant.nextParameterSet && typeof participant.nextParameterSet === 'object'
        ? participant.nextParameterSet as Record<string, unknown>
        : null;

    const attemptCount = getAttemptsCount(record.dynamodb.NewImage as Record<string, unknown>, participant);
    const nextParameterSet = buildNextParameterSet(attemptCount);

    console.log(
      `next-parameter-set-monitor participantId=${participantId} attemptCount=${attemptCount} generatedFromAttemptCount=${nextParameterSet.generatedFromAttemptCount}`
    );

    if (
      currentNextParameterSet?.status === 'ready' &&
      Number(currentNextParameterSet.generatedFromAttemptCount) === nextParameterSet.generatedFromAttemptCount
    ) {
      continue;
    }

    await dynamoClient.send(
      new UpdateCommand({
        TableName: participantTableName,
        Key: { id: participantId },
        UpdateExpression: 'SET nextParameterSet = :nextParameterSet',
        ExpressionAttributeValues: {
          ':nextParameterSet': nextParameterSet,
        },
      })
    );
  }
};