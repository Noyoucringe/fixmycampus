import { Link } from 'react-router-dom';
import { ThumbsUp, MapPin, Clock } from 'lucide-react';
import { StatusBadge, CategoryBadge } from './StatusBadge';

interface Issue {
  _id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  upvoteCount: number;
  createdAt: string;
  address?: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Link to={`/issues/${issue._id}`} className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{issue.title}</h3>
        <div className="flex items-center gap-1 text-gray-500 text-xs shrink-0">
          <ThumbsUp className="w-3.5 h-3.5" />
          {issue.upvoteCount}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <CategoryBadge category={issue.category} />
        <StatusBadge status={issue.status} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        {issue.address && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {issue.address}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(issue.createdAt)}
        </span>
      </div>
    </Link>
  );
}
