import { config } from 'dotenv'; config({ path: new URL('../../../.env', import.meta.url).pathname });
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function setup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('Connected. Setting up database...');

  // --- Collections ---

  const collections = await db.listCollections().toArray();
  const existing = new Set(collections.map((c) => c.name));

  // issues collection with $jsonSchema validation
  if (!existing.has('issues')) {
    await db.createCollection('issues', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['title', 'description', 'category', 'status', 'location', 'reportedBy', 'createdAt'],
          properties: {
            title: { bsonType: 'string', minLength: 5, maxLength: 200 },
            description: { bsonType: 'string', minLength: 10, maxLength: 2000 },
            category: {
              enum: ['infrastructure', 'electrical', 'plumbing', 'cleanliness', 'network', 'safety', 'other'],
            },
            status: { enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'] },
            priority: { enum: ['low', 'medium', 'high', 'critical'] },
            location: {
              bsonType: 'object',
              required: ['type', 'coordinates'],
              properties: {
                type: { enum: ['Point'] },
                coordinates: { bsonType: 'array', minItems: 2, maxItems: 2 },
              },
            },
            upvoteCount: { bsonType: 'int', minimum: 0 },
            comments: {
              bsonType: 'array',
              maxItems: 50,
            },
            statusHistory: {
              bsonType: 'array',
              maxItems: 20,
            },
          },
        },
      },
    });
    console.log('Created issues collection with schema validation');
  }

  if (!existing.has('users')) {
    await db.createCollection('users');
    console.log('Created users collection');
  }

  if (!existing.has('departments')) {
    await db.createCollection('departments');
    console.log('Created departments collection');
  }

  // Time-series collection for issue events
  if (!existing.has('issue_events')) {
    await db.createCollection('issue_events', {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'hours',
      },
    });
    console.log('Created issue_events time-series collection');
  }

  // --- Indexes ---

  const issues = db.collection('issues');
  const users = db.collection('users');
  const departments = db.collection('departments');

  // 2dsphere for geospatial queries
  await issues.createIndex({ location: '2dsphere' });
  // Compound ESR: status + category + createdAt
  await issues.createIndex({ status: 1, category: 1, createdAt: -1 });
  // Partial index on open issues for quick counts
  await issues.createIndex(
    { createdAt: -1 },
    { partialFilterExpression: { status: { $in: ['open', 'assigned', 'in_progress'] } } }
  );
  // Department assignment lookup
  await issues.createIndex({ assignedDepartment: 1, status: 1 });
  // Reporter lookup
  await issues.createIndex({ reportedBy: 1, createdAt: -1 });

  // Users
  await users.createIndex({ email: 1 }, { unique: true });

  // Departments
  await departments.createIndex({ slug: 1 }, { unique: true });

  console.log('Created indexes');

  // --- Atlas Search indexes (programmatic creation) ---
  // These require Atlas; they'll fail on local MongoDB but that's fine
  try {
    const searchIndexes = await issues.listSearchIndexes().toArray();
    const searchNames = new Set(searchIndexes.map((i) => i.name));

    if (!searchNames.has('default')) {
      await issues.createSearchIndex({
        name: 'default',
        definition: {
          mappings: {
            dynamic: false,
            fields: {
              title: [
                { type: 'string', analyzer: 'lucene.standard' },
                { type: 'autocomplete', analyzer: 'lucene.standard', tokenization: 'edgeGram', minGrams: 3, maxGrams: 15 },
              ],
              description: { type: 'string', analyzer: 'lucene.standard' },
              category: { type: 'stringFacet' },
              status: { type: 'stringFacet' },
            },
          },
        },
      });
      console.log('Created Atlas Search index: default');
    }

    if (!searchNames.has('vector_index')) {
      await issues.createSearchIndex({
        name: 'vector_index',
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type: 'vector',
              path: 'embedding',
              numDimensions: 768,
              similarity: 'cosine',
            },
            {
              type: 'filter',
              path: 'location',
            },
            {
              type: 'filter',
              path: 'status',
            },
          ],
        },
      });
      console.log('Created Atlas Vector Search index: vector_index');
    }
  } catch (err) {
    console.warn('Could not create search indexes (requires Atlas):', (err as Error).message);
  }

  console.log('Database setup complete');
  await client.close();
}

setup().catch(console.error);

