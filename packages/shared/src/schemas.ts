import { z } from 'zod';

export const IssueCategory = z.enum([
  'infrastructure',
  'electrical',
  'plumbing',
  'cleanliness',
  'network',
  'safety',
  'other',
]);

export const IssueStatus = z.enum([
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
]);

export const IssuePriority = z.enum(['low', 'medium', 'high', 'critical']);

export const UserRole = z.enum(['citizen', 'admin', 'department_head']);

export const LocationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

export const CreateIssueSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: IssueCategory,
  location: LocationSchema,
  address: z.string().max(500).optional(),
});

export const UpdateIssueSchema = z.object({
  status: IssueStatus.optional(),
  priority: IssuePriority.optional(),
  assignedDepartment: z.string().optional(),
  adminNotes: z.string().max(2000).optional(),
});

export const CommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const SimilarIssuesQuerySchema = z.object({
  text: z.string().min(3),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  radiusMeters: z.number().min(50).max(5000).default(200),
  limit: z.number().min(1).max(20).default(5),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  category: IssueCategory.optional(),
  status: IssueStatus.optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export const ViewportQuerySchema = z.object({
  swLng: z.coerce.number(),
  swLat: z.coerce.number(),
  neLng: z.coerce.number(),
  neLat: z.coerce.number(),
});
