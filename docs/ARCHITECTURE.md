# Architecture

## Schema Design

### Issues Collection

The `issues` collection uses **$jsonSchema validation**, **polymorphic documents** (category-specific `categoryMeta`), and the **subset pattern** (bounded `comments` array capped at 50, `statusHistory` at 20).

```json
{
  "_id": "ObjectId",
  "title": "string (5-200 chars)",
  "description": "string (10-2000 chars)",
  "category": "infrastructure | electrical | plumbing | cleanliness | network | safety | other",
  "status": "open | assigned | in_progress | resolved | closed",
  "priority": "low | medium | high | critical",
  "location": { "type": "Point", "coordinates": [lng, lat] },
  "address": "optional string",
  "photoId": "ObjectId (GridFS reference)",
  "reportedBy": "userId string",
  "reporterName": "string",
  "assignedDepartment": "departmentId string",
  "upvotes": ["userId strings"],
  "upvoteCount": "number",
  "comments": [{ "userId", "userName", "text", "createdAt" }],
  "statusHistory": [{ "from", "to", "changedBy", "changedAt", "note?" }],
  "embedding": [768 floats],
  "createdAt": "Date",
  "updatedAt": "Date",
  "resolvedAt": "Date",
  "categoryMeta": { /* polymorphic per category */ }
}
```

### Time-Series: `issue_events`

Configured with `timeField: "timestamp"`, `metaField: "metadata"`, `granularity: "hours"`. Stores lifecycle events (created, assigned, resolved, upvoted, commented) for efficient trend analytics.

## Index Strategy

| Collection | Index | Type | Purpose |
|---|---|---|---|
| issues | `{ location: "2dsphere" }` | Geo | Viewport loading, nearby issues, geo-filtered vector search |
| issues | `{ status: 1, category: 1, createdAt: -1 }` | Compound ESR | Filtered listing with sort |
| issues | `{ createdAt: -1 }` partial (status in open/assigned/in_progress) | Partial | Fast open issue counts |
| issues | `{ assignedDepartment: 1, status: 1 }` | Compound | Department workload queries |
| issues | `{ reportedBy: 1, createdAt: -1 }` | Compound | User's reported issues |
| users | `{ email: 1 }` unique | Unique | Login lookup, duplicate prevention |
| departments | `{ slug: 1 }` unique | Unique | URL-friendly lookups |

### Atlas Search Index (`default`)

- `title`: string + autocomplete (edgeGram, 3-15)
- `description`: string (lucene.standard)
- `category`, `status`: stringFacet

### Atlas Vector Search Index (`vector_index`)

- `embedding`: vector, 768 dimensions, cosine similarity
- `location`: filter (for geo pre-filtering)
- `status`: filter (exclude resolved/closed from duplicate search)

## Key Pipelines

### Duplicate Detection (`POST /api/issues/similar`)

```
$vectorSearch (embedding, cosine, filter: status IN open/assigned/in_progress AND location $geoWithin $centerSphere)
→ $addFields { score: $meta("vectorSearchScore") }
→ $match { score >= 0.82 }
→ $project { embedding: 0 }
```

### Analytics Overview (`GET /api/analytics/overview`)

```
$facet {
  totalIssues: [$count],
  byStatus: [$group by status],
  byCategory: [$group by category],
  avgResolution: [$match resolved → $dateDiff(createdAt, resolvedAt, "hour") → $avg],
  recentTrend: [$match last 30d → $group by date → $sort]
}
```

### Department Performance (`GET /api/analytics/departments`)

```
departments.$lookup(issues, pipeline: [
  $facet {
    assigned: [$count],
    resolved: [$match resolved → $count],
    avgTime: [$match resolved → $dateDiff → $avg],
    slaBreaches: [$match open/assigned + createdAt < 48h ago → $count]
  }
])
```

## Change Streams

The API opens a change stream on `issues` with `fullDocument: "updateLookup"`. Resume tokens are persisted to a `_system` collection so the stream survives restarts. Events are emitted via Socket.IO to:
- `map` room: all insert/update events (live map)
- `dept:<id>` room: events for issues assigned to that department

## Transactions

Multi-document ACID transactions are used for:
1. **Issue assignment**: update issue status + increment department activeIssues + insert issue_event
2. **Issue resolution**: update issue status + decrement department activeIssues + increment resolvedIssues + insert issue_event

## GridFS

Photos are stored in GridFS bucket `photos`. Upload uses `multer` memory storage → GridFS upload stream. Download streams directly from GridFS to the HTTP response with caching headers.
