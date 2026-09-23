import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { getGridFS } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/upload', authenticate, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const bucket = getGridFS();
    const uploadStream = bucket.openUploadStream(`photo-${Date.now()}.${req.file.mimetype.split('/')[1]}`, {
      contentType: req.file.mimetype,
    });

    const readable = Readable.from(req.file.buffer);
    await new Promise<void>((resolve, reject) => {
      readable.pipe(uploadStream).on('finish', resolve).on('error', reject);
    });

    res.status(201).json({ success: true, data: { fileId: uploadStream.id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bucket = getGridFS();
    const fileId = new ObjectId(req.params.id);

    const files = await bucket.find({ _id: fileId }).toArray();
    if (files.length === 0) {
      res.status(404).json({ success: false, error: 'Photo not found' });
      return;
    }

    const file = files[0]!;
    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000');

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve photo' });
  }
});

export default router;
