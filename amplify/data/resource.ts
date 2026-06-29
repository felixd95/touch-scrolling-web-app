import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { nextParameterSetMonitor } from '../functions/next-parameter-set-monitor/resource';

const schema = a.schema({
  TriggerNextParameterSetResult: a.customType({
    nextParameterSet: a.string().required(),
  }),
  Participant: a
    .model({
      firstName: a.string().required(),
      lastName: a.string().required(),
      email: a.email().required(),
      birthDate: a.date().required(),
      privateSmartphone: a.string().required(),
      screenTimePerDay: a.string().required(),
      attempts: a.json().array(),
      nextParameterSet: a.json(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
  Result: a
    .model({
      participantId: a.id().required(),
      // use string fallback for numeric values to avoid unsupported type errors in the builder
      timeMs: a.string().required(),
      scrollDistance: a.string().required(),
      timestamp: a.string().required(),
      multiplierUsed: a.string().required(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
  triggerNextParameterSet: a
    .mutation()
    .arguments({
      participantId: a.id().required(),
      attemptCount: a.integer().required(),
    })
    .returns(a.ref('TriggerNextParameterSetResult'))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(nextParameterSetMonitor)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});