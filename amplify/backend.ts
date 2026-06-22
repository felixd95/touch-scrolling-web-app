import { defineBackend } from '@aws-amplify/backend';
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { data } from './data/resource';
import { nextParameterSetMonitor } from './functions/next-parameter-set-monitor/resource';

const backend = defineBackend({
  data,
  nextParameterSetMonitor,
});

backend.data.resources.cfnResources.amplifyDynamoDbTables.Participant.streamSpecification = {
  streamViewType: StreamViewType.NEW_AND_OLD_IMAGES,
};

const participantTable = backend.data.resources.tables.Participant;
participantTable.grantReadWriteData(backend.nextParameterSetMonitor.resources.lambda);
participantTable.grantStreamRead(backend.nextParameterSetMonitor.resources.lambda);

backend.nextParameterSetMonitor.resources.lambda.addEventSource(
  new DynamoEventSource(participantTable, {
    startingPosition: StartingPosition.LATEST,
    batchSize: 10,
    retryAttempts: 2,
  })
);
