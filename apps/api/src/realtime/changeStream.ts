import { ChangeStream, ChangeStreamDocument, ResumeToken } from 'mongodb';
import { Server as SocketServer } from 'socket.io';
import { getDb } from '../db/connection.js';

let changeStream: ChangeStream | null = null;

export async function startChangeStream(io: SocketServer): Promise<void> {
  const db = getDb();
  const issues = db.collection('issues');

  let resumeToken: ResumeToken | undefined;

  // Try to load stored resume token
  try {
    const tokenDoc = await db.collection('_system').findOne({ _id: 'change_stream_token' as any });
    if (tokenDoc?.token) {
      resumeToken = tokenDoc.token;
    }
  } catch {
    // No stored token, start fresh
  }

  const options: Record<string, unknown> = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  changeStream = issues.watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace'] } } }],
    options as any
  );

  changeStream.on('change', async (change: ChangeStreamDocument) => {
    try {
      // Store resume token
      await db.collection('_system').updateOne(
        { _id: 'change_stream_token' as any },
        { $set: { token: change._id, updatedAt: new Date() } },
        { upsert: true }
      );

      if (change.operationType === 'insert' && 'fullDocument' in change) {
        const doc = change.fullDocument;
        const { embedding, ...issueData } = doc as any;
        io.to('map').emit('issue:created', issueData);
      }

      if ((change.operationType === 'update' || change.operationType === 'replace') && 'fullDocument' in change) {
        const doc = change.fullDocument;
        if (doc) {
          const { embedding, ...issueData } = doc as any;
          io.to('map').emit('issue:updated', issueData);

          if (issueData.assignedDepartment) {
            io.to(`dept:${issueData.assignedDepartment}`).emit('issue:updated', issueData);
          }
        }
      }
    } catch (err) {
      console.error('Change stream event error:', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error('Change stream error:', err);
    setTimeout(() => startChangeStream(io), 5000);
  });

  console.log('Change stream started');
}

export function stopChangeStream(): void {
  if (changeStream) {
    changeStream.close();
    changeStream = null;
  }
}
