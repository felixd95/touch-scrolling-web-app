import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { nextParameterSetMonitor } from './functions/next-parameter-set-monitor/resource';

const backend = defineBackend({
  data,
  nextParameterSetMonitor,
});

const participantTable = backend.data.resources.tables.Participant;
participantTable.grantReadWriteData(backend.nextParameterSetMonitor.resources.lambda);
backend.nextParameterSetMonitor.resources.lambda.addEnvironment('PARTICIPANT_TABLE_NAME', participantTable.tableName);
