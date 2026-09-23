import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../lib/api';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#06b6d4', '#6b7280'];

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data.data,
  });

  const { data: deptPerf } = useQuery({
    queryKey: ['analytics', 'departments'],
    queryFn: async () => (await api.get('/analytics/departments')).data.data,
  });

  const { data: trends } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: async () => (await api.get('/analytics/trends')).data.data,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Issues by Category */}
        {overview?.issuesByCategory && (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-4">Issues by Category</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.issuesByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Status Distribution */}
        {overview?.issuesByStatus && (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-4">Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={overview.issuesByStatus} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={100} label={({ _id, count }) => `${_id} (${count})`}>
                  {overview.issuesByStatus.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trends */}
        {trends && trends.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-4">Event Trends (30 days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="assigned" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Trend */}
        {overview?.recentTrend && overview.recentTrend.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-4">New Issues (30 days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.recentTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Department Performance */}
      {deptPerf && deptPerf.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Department Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Department</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Assigned</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Resolved</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Avg Resolution</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">SLA Breaches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptPerf.map((dept: any) => (
                  <tr key={dept.department || dept._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{dept.department}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{dept.assigned}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{dept.resolved}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{dept.avgResolutionHours}h</td>
                    <td className="px-4 py-3 text-right">
                      <span className={dept.slaBreaches > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                        {dept.slaBreaches}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
