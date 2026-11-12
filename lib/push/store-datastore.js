// Subscription store backed by Firestore in Datastore mode — the project's
// existing (default) database (App Engine created it in 2023, and a project
// can only have one (default) database, which is also the only one covered by
// the free tier). Replaces the Netlify Blobs store the remnants site uses.
// Same four methods:
//   put(id, record) · get(id) · remove(id) · list() → [{ id, ...record }]
// Record shape: { subscription: { endpoint, keys }, teams: string[], types: string[], createdAt, updatedAt }
//
// Entities are kind "PushSubscription", keyed by sha256(endpoint). The
// subscription itself is stored as an unindexed JSON string — nothing ever
// queries on it, and indexing endpoints/keys would just waste index writes.
//
// On App Engine the client authenticates as the app's default service account
// and picks up the project automatically. Locally it uses Application Default
// Credentials (`gcloud auth application-default login`); the rest of the site
// works without them, only the /push routes need them.
//
// Env (all optional): DATASTORE_PROJECT, DATASTORE_DATABASE (default: the
// "(default)" database), PUSH_KIND (default: "PushSubscription").
const { Datastore } = require('@google-cloud/datastore');

let ds;
function datastore() {
  ds ??= new Datastore({
    projectId: process.env.DATASTORE_PROJECT || undefined,
    databaseId: process.env.DATASTORE_DATABASE || undefined,
  });
  return ds;
}

function fromEntity(e) {
  if (!e) return null;
  const { subscription, teams, types, createdAt, updatedAt } = e;
  return { subscription: JSON.parse(subscription), teams: teams ?? [], types: types ?? [], createdAt, updatedAt };
}

function createDatastoreStore(kind = process.env.PUSH_KIND || 'PushSubscription') {
  const key = (id) => datastore().key([kind, id]);
  return {
    put: (id, record) => datastore().save({
      key: key(id),
      data: {
        subscription: JSON.stringify(record.subscription),
        teams: record.teams,
        types: record.types,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      excludeFromIndexes: ['subscription'],
    }),
    async get(id) {
      const [entity] = await datastore().get(key(id));
      return fromEntity(entity);
    },
    remove: (id) => datastore().delete(key(id)),
    async list() {
      const [entities] = await datastore().runQuery(datastore().createQuery(kind));
      return entities.map((e) => ({ id: e[datastore().KEY].name, ...fromEntity(e) }));
    },
  };
}

module.exports = { createDatastoreStore };
