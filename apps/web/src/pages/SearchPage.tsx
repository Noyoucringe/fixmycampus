import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import IssueCard from '../components/IssueCard';
import { Search, Filter } from 'lucide-react';

const CATEGORIES = ['infrastructure', 'electrical', 'plumbing', 'cleanliness', 'network', 'safety', 'other'];
const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, category, status],
    queryFn: async () => {
      if (!debouncedQuery) return null;
      const params: Record<string, string> = { q: debouncedQuery };
      if (category) params.category = category;
      if (status) params.status = status;
      const res = await api.get('/search', { params });
      return res.data.data;
    },
    enabled: debouncedQuery.length > 0,
  });

  const handleSearch = (q: string) => {
    setQuery(q);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (status) params.status = status;
    setSearchParams(params);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search issues..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-lg"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-48 shrink-0 hidden md:block">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Filter className="w-4 h-4" /> Filters</h3>

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>

          {data?.facets?.categories?.length > 0 && (
            <div className="mb-4">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Category counts</label>
              <ul className="mt-1 space-y-1">
                {data.facets.categories.map((f: any) => (
                  <li key={f._id} className="text-sm text-gray-600 flex justify-between">
                    <span>{f._id}</span>
                    <span className="text-gray-400">{f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="flex-1">
          {isLoading && <p className="text-gray-500">Searching...</p>}
          {!debouncedQuery && <p className="text-gray-500">Type to search for issues</p>}
          {data && (
            <>
              <p className="text-sm text-gray-500 mb-4">{data.total} result{data.total !== 1 ? 's' : ''}</p>
              <div className="space-y-3">
                {data.issues.map((issue: any) => (
                  <IssueCard key={issue._id} issue={issue} />
                ))}
              </div>
              {data.issues.length === 0 && <p className="text-gray-500 text-center py-8">No matching issues found</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
