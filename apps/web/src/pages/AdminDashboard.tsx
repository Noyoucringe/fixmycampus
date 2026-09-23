import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { StatusBadge, CategoryBadge } from '../components/StatusBadge';
import { BarChart3, Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState('');

  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data.data,
  });

  const { data: issues } = useQuery({
    queryKey: ['issues', 'unassigned'],
    queryFn: async () => (await api.get('/issues', { params: { status: 'open', limit: 20, sort: 'createdAt', order: 'desc' } })).data.data,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data.data,
  });

  const assignMutation = useMutation({
    mutationFn: ({ issueId, departmentId }: { issueId: string; departmentId: string }) =>
      api.post('/admin/assign', { issueId, departmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setAssignModal(null);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (issueId: string) => api.post('/admin/resolve', { issueId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Link to="/admin/analytics" className="flex items-center gap-1 text-primary-600 hover:underline text-sm font-medium">
          <BarChart3 className="w-4 h-4" /> View Analytics <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">Total Issues</p>
            <p className="text-2xl font-bold text-gray-900">{overview.totalIssues}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-red-500" /> Open</p>
            <p className="text-2xl font-bold text-red-600">{overview.openIssues}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Resolved</p>
            <p className="text-2xl font-bold text-green-600">{overview.resolvedIssues}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4 text-blue-500" /> Avg Resolution</p>
            <p className="text-2xl font-bold text-blue-600">{overview.avgResolutionHours}h</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Open Issues (Unassigned)</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {issues?.map((issue: any) => (
            <div key={issue._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <Link to={`/issues/${issue._id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block">
                  {issue.title}
                </Link>
                <div className="flex gap-2 mt-1">
                  <CategoryBadge category={issue.category} />
                  <StatusBadge status={issue.status} />
                  <span className="text-xs text-gray-400">{new Date(issue.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => setAssignModal(issue._id)}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
                  Assign
                </button>
                {(issue.status === 'assigned' || issue.status === 'in_progress') && (
                  <button onClick={() => resolveMutation.mutate(issue._id)}
                    className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
          {(!issues || issues.length === 0) && (
            <p className="p-4 text-sm text-gray-500 text-center">No open issues</p>
          )}
        </div>
      </div>

      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Assign to Department</h3>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4">
              <option value="">Select department...</option>
              {departments?.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button disabled={!selectedDept || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ issueId: assignModal, departmentId: selectedDept })}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
