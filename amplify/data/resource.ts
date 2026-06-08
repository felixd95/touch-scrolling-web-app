import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Participant: a
    .model({
      firstName: a.string().required(),
      lastName: a.string().required(),
      email: a.email().required(),
      birthDate: a.date().required(),
      privateSmartphone: a.string().required(),
      screenTimePerDay: a.string().required(),
    })
    .authorization((allow) => [allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});