import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { LoginSchema, RegisterSchema } from '@fixmycampus/shared';
import { getDb } from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const db = getDb();
    const users = db.collection('users');

    const existing = await users.findOne({ email });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      name,
      email,
      passwordHash,
      role: 'citizen',
      createdAt: new Date(),
    });

    const token = jwt.sign(
      { userId: result.insertedId.toString(), email, role: 'citizen', name },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({ success: true, data: { token, user: { _id: result.insertedId, name, email, role: 'citizen' } } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({ success: true, data: { token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user!.userId) },
      { projection: { passwordHash: 0 } }
    );
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

export default router;
