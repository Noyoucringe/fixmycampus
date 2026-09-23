import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb, getClient } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/assign', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  const client = getClient();
  const session = client.startSession();

  try {
    const { issueId, departmentId } = req.body;
    if (!issueId || !departmentId) {
      res.status(400).json({ success: false, error: 'issueId and departmentId are required' });
      return;
    }

    const db = getDb();

    await session.withTransaction(async () => {
      const issue = await db.collection('issues').findOneAndUpdate(
        { _id: new ObjectId(issueId) },
        {
          $set: {
            status: 'assigned',
            assignedDepartment: departmentId,
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              $each: [{
                from: 'open',
                to: 'assigned',
                changedBy: req.user!.userId,
                changedAt: new Date(),
                note: `Assigned to department`,
              }],
              $slice: -20,
            },
          } as any,
        },
        { session, returnDocument: 'after', projection: { embedding: 0 } }
      );

      if (!issue) throw new Error('Issue not found');

      await db.collection('departments').updateOne(
        { _id: new ObjectId(departmentId) },
        { $inc: { activeIssues: 1 } },
        { session }
      );

      await db.collection('issue_events').insertOne(
        {
          timestamp: new Date(),
          metadata: { issueId, type: 'assigned', userId: req.user!.userId, departmentId },
          category: issue.category,
        },
        { session }
      );
    });

    const updated = await db.collection('issues').findOne(
      { _id: new ObjectId(issueId) },
      { projection: { embedding: 0 } }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign issue' });
  } finally {
    await session.endSession();
  }
});

router.post('/resolve', authenticate, authorize('admin', 'department_head'), async (req: Request, res: Response) => {
  const client = getClient();
  const session = client.startSession();

  try {
    const { issueId } = req.body;
    if (!issueId) {
      res.status(400).json({ success: false, error: 'issueId is required' });
      return;
    }

    const db = getDb();

    await session.withTransaction(async () => {
      const issue = await db.collection('issues').findOneAndUpdate(
        { _id: new ObjectId(issueId) },
        {
          $set: {
            status: 'resolved',
            resolvedAt: new Date(),
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              $each: [{
                from: 'in_progress',
                to: 'resolved',
                changedBy: req.user!.userId,
                changedAt: new Date(),
              }],
              $slice: -20,
            },
          } as any,
        },
        { session, returnDocument: 'after', projection: { embedding: 0 } }
      );

      if (!issue) throw new Error('Issue not found');

      if (issue.assignedDepartment) {
        await db.collection('departments').updateOne(
          { _id: new ObjectId(issue.assignedDepartment) },
          { $inc: { activeIssues: -1, resolvedIssues: 1 } },
          { session }
        );
      }

      await db.collection('issue_events').insertOne(
        {
          timestamp: new Date(),
          metadata: { issueId, type: 'resolved', userId: req.user!.userId },
          category: issue.category,
        },
        { session }
      );
    });

    const updated = await db.collection('issues').findOne(
      { _id: new ObjectId(issueId) },
      { projection: { embedding: 0 } }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Resolve error:', err);
    res.status(500).json({ success: false, error: 'Failed to resolve issue' });
  } finally {
    await session.endSession();
  }
});

export default router;
