import { useState, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { StatusBadge, CategoryBadge } from '../components/StatusBadge';
import { ThumbsUp, MessageCircle, Clock, User } from 'lucide-react';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', id],
    queryFn: async () => {
      const res = await api.get(`/issues/${id}`);
      return res.data.data;
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: () => api.post(`/issues/${id}/upvote`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.post(`/issues/${id}/comments`, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setCommentText('');
    },
  });

  const handleComment = (e: FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) commentMutation.mutate(commentText.trim());
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!issue) return <div className="p-8 text-center text-gray-500">Issue not found</div>;

  const position: [number, number] = [issue.location.coordinates[1], issue.location.coordinates[0]];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {issue.photoId && (
          <img src={`/api/photos/${issue.photoId}`} alt={issue.title} className="w-full h-64 object-cover" />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
              <div className="flex gap-2 mt-2">
                <CategoryBadge category={issue.category} />
                <StatusBadge status={issue.status} />
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{issue.priority}</span>
              </div>
            </div>
            <button
              onClick={() => upvoteMutation.mutate()}
              disabled={!user}
              className="flex flex-col items-center px-3 py-2 rounded-lg border border-gray-200 hover:bg-primary-50 hover:border-primary-300 transition disabled:opacity-50"
            >
              <ThumbsUp className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-semibold mt-1">{issue.upvoteCount}</span>
            </button>
          </div>

          <p className="mt-4 text-gray-700 whitespace-pre-wrap">{issue.description}</p>

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1"><User className="w-4 h-4" /> {issue.reporterName}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(issue.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="h-48 border-t border-gray-200">
          <MapContainer center={position} zoom={16} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={position} />
          </MapContainer>
        </div>

        {issue.statusHistory?.length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-3">Status History</h2>
            <div className="space-y-2">
              {issue.statusHistory.map((change: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <StatusBadge status={change.to} />
                  <span className="text-gray-500">{new Date(change.changedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 border-t border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Comments ({issue.comments?.length || 0})
          </h2>

          {issue.comments?.map((c: any) => (
            <div key={c._id} className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-800">{c.userName}</span>
                <span className="text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{c.text}</p>
            </div>
          ))}

          {user && (
            <form onSubmit={handleComment} className="mt-4 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
              <button type="submit" disabled={commentMutation.isPending || !commentText.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                Post
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
