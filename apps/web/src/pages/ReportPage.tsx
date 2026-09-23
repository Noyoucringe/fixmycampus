import { useState, FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import api from '../lib/api';
import { StatusBadge, CategoryBadge } from '../components/StatusBadge';
import { ThumbsUp, AlertTriangle, MapPin } from 'lucide-react';

const CATEGORIES = ['infrastructure', 'electrical', 'plumbing', 'cleanliness', 'network', 'safety', 'other'];
const CAMPUS_CENTER: [number, number] = [12.9716, 77.5946];

interface SimilarIssue {
  _id: string;
  title: string;
  category: string;
  status: string;
  upvoteCount: number;
  score: number;
}

function LocationPicker({ position, setPosition }: { position: [number, number] | null; setPosition: (p: [number, number]) => void }) {
  useMapEvents({
    click: (e) => setPosition([e.latlng.lat, e.latlng.lng]),
  });
  return position ? <Marker position={position} /> : null;
}

export default function ReportPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('infrastructure');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [similar, setSimilar] = useState<SimilarIssue[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const checkDuplicates = useCallback(async () => {
    if (!title || title.length < 5 || !position) return;
    try {
      const res = await api.post('/issues/similar', {
        text: `${title} ${description}`,
        longitude: position[1],
        latitude: position[0],
        radiusMeters: 200,
        limit: 5,
      });
      if (res.data.data.length > 0) {
        setSimilar(res.data.data);
        setShowSimilar(true);
      }
    } catch {
      // Non-critical
    }
  }, [title, description, position]);

  const handleUpvote = async (issueId: string) => {
    try {
      await api.post(`/issues/${issueId}/upvote`);
      navigate(`/issues/${issueId}`);
    } catch {
      // Continue
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!position) {
      setError('Please select a location on the map');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('data', JSON.stringify({
        title,
        description,
        category,
        location: { type: 'Point', coordinates: [position[1], position[0]] },
      }));
      if (photo) formData.append('photo', photo);

      await api.post('/issues', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => setError('Could not get your location')
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Report an Issue</h1>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {showSimilar && similar.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">This looks already reported!</h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">We found similar issues nearby. Consider upvoting instead of creating a duplicate.</p>
          <div className="space-y-2">
            {similar.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <div className="flex gap-1 mt-1">
                    <CategoryBadge category={s.category} />
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-gray-500 ml-1">{Math.round(s.score * 100)}% match</span>
                  </div>
                </div>
                <button onClick={() => handleUpvote(s._id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm font-medium">
                  <ThumbsUp className="w-4 h-4" /> Upvote
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setShowSimilar(false)} className="mt-3 text-sm text-amber-700 hover:underline">
            No, mine is different — continue reporting
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-800">Issue Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={200}
              onBlur={checkDuplicates} placeholder="e.g., Broken streetlight near Block A"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} maxLength={2000}
              rows={4} placeholder="Describe the issue in detail..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Location</h2>
            <button type="button" onClick={useMyLocation}
              className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
              <MapPin className="w-4 h-4" /> Use my location
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-2">Click on the map to mark the issue location</p>
          <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
            <MapContainer center={position || CAMPUS_CENTER} zoom={15} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationPicker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
          {position && <p className="mt-2 text-xs text-gray-500">Selected: {position[0].toFixed(6)}, {position[1].toFixed(6)}</p>}
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-3">Photo (optional)</h2>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          {photo && <p className="mt-2 text-xs text-gray-500">{photo.name} ({(photo.size / 1024 / 1024).toFixed(1)} MB)</p>}
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold text-lg">
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
