import type { z } from 'zod';
import type {
  IssueCategory as IssueCategorySchema,
  IssueStatus as IssueStatusSchema,
  IssuePriority as IssuePrioritySchema,
  UserRole as UserRoleSchema_,
  LocationSchema,
} from './schemas.js';

export type IssueCategoryType = z.infer<typeof IssueCategorySchema>;
export type IssueStatusType = z.infer<typeof IssueStatusSchema>;
export type IssuePriorityType = z.infer<typeof IssuePrioritySchema>;
export type UserRoleType = z.infer<typeof UserRoleSchema_>;
export type GeoLocation = z.infer<typeof LocationSchema>;

export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRoleType;
  department?: string;
  createdAt: Date;
}

export interface Comment {
  _id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Date;
}

export interface StatusChange {
  from: IssueStatusType;
  to: IssueStatusType;
  changedBy: string;
  changedAt: Date;
  note?: string;
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: IssueCategoryType;
  status: IssueStatusType;
  priority: IssuePriorityType;
  location: GeoLocation;
  address?: string;
  photoId?: string;
  reportedBy: string;
  reporterName: string;
  assignedDepartment?: string;
  upvotes: string[];
  upvoteCount: number;
  comments: Comment[];
  statusHistory: StatusChange[];
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  categoryMeta?: Record<string, unknown>;
}

export interface Department {
  _id: string;
  name: string;
  slug: string;
  description: string;
  activeIssues: number;
  resolvedIssues: number;
  members: string[];
}

export interface IssueEvent {
  timestamp: Date;
  issueId: string;
  event: 'created' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'upvoted' | 'commented';
  category: IssueCategoryType;
  department?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRoleType;
  name: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface SearchResult {
  issues: Issue[];
  facets: {
    categories: { _id: string; count: number }[];
    statuses: { _id: string; count: number }[];
  };
  total: number;
  highlights?: Record<string, { path: string; texts: { value: string; type: string }[] }[]>;
}

export interface AnalyticsOverview {
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  avgResolutionHours: number;
  issuesByCategory: { _id: string; count: number }[];
  issuesByStatus: { _id: string; count: number }[];
  recentTrend: { date: string; count: number }[];
}

export interface DepartmentPerformance {
  department: string;
  assigned: number;
  resolved: number;
  avgResolutionHours: number;
  slaBreaches: number;
}

export interface Hotspot {
  location: GeoLocation;
  count: number;
  topCategory: string;
}
