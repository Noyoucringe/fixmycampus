import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/overview', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const [result] = await db.collection('issues').aggregate([
      {
        $facet: {
          totalIssues: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          avgResolution: [
            { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
            {
              $project: {
                resolutionHours: {
                  $dateDiff: { startDate: '$createdAt', endDate: '$resolvedAt', unit: 'hour' },
                },
              },
            },
            { $group: { _id: null, avg: { $avg: '$resolutionHours' } } },
          ],
          recentTrend: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]).toArray();

    const statusMap: Record<string, number> = {};
    for (const s of result.byStatus) statusMap[s._id] = s.count;

    res.json({
      success: true,
      data: {
        totalIssues: result.totalIssues[0]?.count || 0,
        openIssues: (statusMap.open || 0) + (statusMap.assigned || 0) + (statusMap.in_progress || 0),
        resolvedIssues: (statusMap.resolved || 0) + (statusMap.closed || 0),
        avgResolutionHours: Math.round(result.avgResolution[0]?.avg || 0),
        issuesByCategory: result.byCategory,
        issuesByStatus: result.byStatus,
        recentTrend: result.recentTrend.map((t: any) => ({ date: t._id, count: t.count })),
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

router.get('/departments', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const departments = await db.collection('departments').aggregate([
      {
        $lookup: {
          from: 'issues',
          let: { deptId: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$assignedDepartment', '$$deptId'] } } },
            {
              $facet: {
                assigned: [{ $count: 'count' }],
                resolved: [{ $match: { status: 'resolved' } }, { $count: 'count' }],
                avgTime: [
                  { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
                  {
                    $project: {
                      hours: { $dateDiff: { startDate: '$createdAt', endDate: '$resolvedAt', unit: 'hour' } },
                    },
                  },
                  { $group: { _id: null, avg: { $avg: '$hours' } } },
                ],
                slaBreaches: [
                  {
                    $match: {
                      status: { $in: ['open', 'assigned', 'in_progress'] },
                      createdAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
                    },
                  },
                  { $count: 'count' },
                ],
              },
            },
          ],
          as: 'stats',
        },
      },
      { $unwind: { path: '$stats', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          department: '$name',
          assigned: { $ifNull: [{ $arrayElemAt: ['$stats.assigned.count', 0] }, 0] },
          resolved: { $ifNull: [{ $arrayElemAt: ['$stats.resolved.count', 0] }, 0] },
          avgResolutionHours: { $round: [{ $ifNull: [{ $arrayElemAt: ['$stats.avgTime.avg', 0] }, 0] }, 0] },
          slaBreaches: { $ifNull: [{ $arrayElemAt: ['$stats.slaBreaches.count', 0] }, 0] },
        },
      },
    ]).toArray();

    res.json({ success: true, data: departments });
  } catch (err) {
    console.error('Department analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch department analytics' });
  }
});

router.get('/trends', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { days = '30' } = req.query as Record<string, string>;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const trends = await db.collection('issue_events').aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$metadata.type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
      {
        $group: {
          _id: '$_id.date',
          events: { $push: { type: '$_id.type', count: '$count' } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    res.json({
      success: true,
      data: trends.map((t: any) => ({
        date: t._id,
        ...Object.fromEntries(t.events.map((e: any) => [e.type, e.count])),
      })),
    });
  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch trends' });
  }
});

router.get('/hotspots', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const hotspots = await db.collection('issues').aggregate([
      { $match: { status: { $in: ['open', 'assigned', 'in_progress'] } } },
      {
        $bucket: {
          groupBy: { $arrayElemAt: ['$location.coordinates', 0] },
          boundaries: Array.from({ length: 21 }, (_, i) => -180 + i * 18),
          default: 'other',
          output: {
            count: { $sum: 1 },
            locations: { $push: '$location' },
            topCategory: { $first: '$category' },
          },
        },
      },
    ]).toArray();

    res.json({ success: true, data: hotspots });
  } catch (err) {
    console.error('Hotspots error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch hotspots' });
  }
});

export default router;
