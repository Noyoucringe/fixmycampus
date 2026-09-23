import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { CreateIssueSchema, UpdateIssueSchema, CommentSchema, SimilarIssuesQuerySchema } from '@fixmycampus/shared';
import { getDb, getGridFS } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { getEmbeddingProvider } from '../services/embedding.js';

const router = Router();

router.post('/', authenticate, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const body = CreateIssueSchema.parse(JSON.parse(req.body.data || '{}'));
    const db = getDb();

    let photoId: ObjectId | undefined;
    if (req.file) {
      const bucket = getGridFS();
      const uploadStream = bucket.openUploadStream(`issue-${Date.now()}.${req.file.mimetype.split('/')[1]}`, {
        contentType: req.file.mimetype,
      });
      const readable = Readable.from(req.file.buffer);
      await new Promise<void>((resolve, reject) => {
        readable.pipe(uploadStream).on('finish', resolve).on('error', reject);
      });
      photoId = uploadStream.id;
    }

    const embeddingProvider = getEmbeddingProvider();
    const embedding = await embeddingProvider.embed(`${body.title} ${body.description}`);

    const issue = {
      ...body,
      status: 'open' as const,
      priority: 'medium' as const,
      photoId,
      reportedBy: req.user!.userId,
      reporterName: req.user!.name,
      upvotes: [],
      upvoteCount: 0,
      comments: [],
      statusHistory: [],
      embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('issues').insertOne(issue);

    await db.collection('issue_events').insertOne({
      timestamp: new Date(),
      metadata: { issueId: result.insertedId.toString(), type: 'created', userId: req.user!.userId },
      category: body.category,
    });

    res.status(201).json({ success: true, data: { ...issue, _id: result.insertedId } });
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ success: false, error: 'Failed to create issue' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, category, page = '1', limit = '10', sort = 'createdAt', order = 'desc' } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const sortOrder = order === 'asc' ? 1 : -1;

    const [issues, total] = await Promise.all([
      db.collection('issues')
        .find(filter, { projection: { embedding: 0 } })
        .sort({ [sort]: sortOrder })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .toArray(),
      db.collection('issues').countDocuments(filter),
    ]);

    res.json({ success: true, data: issues, meta: { page: pageNum, limit: limitNum, total } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch issues' });
  }
});

router.get('/viewport', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { swLng, swLat, neLng, neLat } = req.query as Record<string, string>;

    const issues = await db.collection('issues').find(
      {
        location: {
          $geoWithin: {
            $box: [
              [parseFloat(swLng), parseFloat(swLat)],
              [parseFloat(neLng), parseFloat(neLat)],
            ],
          },
        },
      },
      { projection: { _id: 1, title: 1, category: 1, status: 1, location: 1, upvoteCount: 1, priority: 1 } }
    ).toArray();

    res.json({ success: true, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch viewport issues' });
  }
});

router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { lng, lat, maxDistance = '1000' } = req.query as Record<string, string>;

    const issues = await db.collection('issues').aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distance',
          maxDistance: parseFloat(maxDistance),
          spherical: true,
        },
      },
      { $project: { embedding: 0 } },
      { $limit: 20 },
    ]).toArray();

    res.json({ success: true, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch nearby issues' });
  }
});

router.post('/similar', async (req: Request, res: Response) => {
  try {
    const body = SimilarIssuesQuerySchema.parse(req.body);
    const db = getDb();
    const embeddingProvider = getEmbeddingProvider();
    const queryVector = await embeddingProvider.embed(body.text);

    const radiusRadians = body.radiusMeters / 6378100;

    const results = await db.collection('issues').aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: 50,
          limit: body.limit,
          filter: {
            $and: [
              { status: { $in: ['open', 'assigned', 'in_progress'] } },
              {
                location: {
                  $geoWithin: {
                    $centerSphere: [[body.longitude, body.latitude], radiusRadians],
                  },
                },
              },
            ],
          },
        },
      },
      { $addFields: { score: { $meta: 'vectorSearchScore' } } },
      { $match: { score: { $gte: 0.82 } } },
      { $project: { embedding: 0 } },
    ]).toArray();

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Similar search error:', err);
    res.json({ success: true, data: [] });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const issue = await db.collection('issues').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { embedding: 0 } }
    );
    if (!issue) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch issue' });
  }
});

router.patch('/:id', authenticate, authorize('admin', 'department_head'), validate(UpdateIssueSchema), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates: Record<string, unknown> = { ...req.body, updatedAt: new Date() };

    if (req.body.status === 'resolved') {
      updates.resolvedAt = new Date();
    }

    const updateOp: any = { $set: updates };
    if (req.body.status) {
      updateOp.$push = {
        statusHistory: {
          $each: [{ from: '', to: req.body.status, changedBy: req.user!.userId, changedAt: new Date() }],
          $slice: -20,
        },
      };
    }

    const result = await db.collection('issues').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      updateOp,
      { returnDocument: 'after', projection: { embedding: 0 } }
    );

    if (!result) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update issue' });
  }
});

router.post('/:id/upvote', authenticate, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const issueId = new ObjectId(req.params.id);
    const userId = req.user!.userId;

    const result = await db.collection('issues').findOneAndUpdate(
      { _id: issueId, upvotes: { $ne: userId } },
      { $addToSet: { upvotes: userId }, $inc: { upvoteCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after', projection: { embedding: 0 } }
    );

    if (!result) {
      const existing = await db.collection('issues').findOne({ _id: issueId });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Issue not found' });
        return;
      }
      res.json({ success: true, data: existing, message: 'Already upvoted' });
      return;
    }

    await db.collection('issue_events').insertOne({
      timestamp: new Date(),
      metadata: { issueId: issueId.toString(), type: 'upvoted', userId },
      category: result.category,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upvote' });
  }
});

router.post('/:id/comments', authenticate, validate(CommentSchema), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const comment = {
      _id: new ObjectId().toString(),
      userId: req.user!.userId,
      userName: req.user!.name,
      text: req.body.text,
      createdAt: new Date(),
    };

    const result = await db.collection('issues').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $push: { comments: { $each: [comment], $slice: -50 } } as any,
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after', projection: { embedding: 0 } }
    );

    if (!result) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }

    await db.collection('issue_events').insertOne({
      timestamp: new Date(),
      metadata: { issueId: req.params.id, type: 'commented', userId: req.user!.userId },
      category: result.category,
    });

    res.json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

export default router;
