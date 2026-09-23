import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const departments = await db.collection('departments').find().toArray();
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

router.post('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const result = await db.collection('departments').insertOne({
      name,
      slug,
      description: description || '',
      activeIssues: 0,
      resolvedIssues: 0,
      members: [],
    });

    res.status(201).json({ success: true, data: { _id: result.insertedId, name, slug } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
});

export default router;
