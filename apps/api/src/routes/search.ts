import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { q, category, status, page = '1', limit = '10' } = req.query as Record<string, string>;

    if (!q) {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const mustClauses: unknown[] = [
      {
        compound: {
          should: [
            { text: { query: q, path: 'title', score: { boost: { value: 3 } }, fuzzy: { maxEdits: 1 } } },
            { text: { query: q, path: 'description', fuzzy: { maxEdits: 1 } } },
          ],
          minimumShouldMatch: 1,
        },
      },
    ];

    const filterClauses: unknown[] = [];
    if (category) filterClauses.push({ text: { query: category, path: 'category' } });
    if (status) filterClauses.push({ text: { query: status, path: 'status' } });

    const pipeline: any[] = [
      {
        $search: {
          index: 'default',
          compound: {
            must: mustClauses,
            ...(filterClauses.length > 0 ? { filter: filterClauses } : {}),
          },
          highlight: { path: ['title', 'description'] },
        },
      },
      {
        $facet: {
          results: [
            { $addFields: { score: { $meta: 'searchScore' }, highlights: { $meta: 'searchHighlights' } } },
            { $project: { embedding: 0 } },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
          ],
          totalCount: [{ $count: 'count' }],
          categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    ];

    const [result] = await db.collection('issues').aggregate(pipeline).toArray();

    res.json({
      success: true,
      data: {
        issues: result.results,
        facets: { categories: result.categories, statuses: result.statuses },
        total: result.totalCount[0]?.count || 0,
      },
      meta: { page: pageNum, limit: limitNum },
    });
  } catch (err) {
    console.error('Search error:', err);
    // Fallback to regex search if Atlas Search is not available
    try {
      const db = getDb();
      const { q, category, status, page = '1', limit = '10' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

      const filter: Record<string, unknown> = {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      };
      if (category) filter.category = category;
      if (status) filter.status = status;

      const [issues, total] = await Promise.all([
        db.collection('issues')
          .find(filter, { projection: { embedding: 0 } })
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .toArray(),
        db.collection('issues').countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: { issues, facets: { categories: [], statuses: [] }, total },
        meta: { page: pageNum, limit: limitNum },
      });
    } catch (fallbackErr) {
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  }
});

export default router;
