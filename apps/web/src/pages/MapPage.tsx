import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { StatusBadge, CategoryBadge } from '../components/StatusBadge';
import { ThumbsUp } from 'lucide-react';

const CAMPUS_CENTER: [number, number] = [12.9716, 77.5946];

const categoryIcons: Record<string, string> = {
  infrastructure: '#f97316',
  electrical: '#eab308',
  plumbing: '#06b6d4',
  cleanliness: '#22c55e',
  network: '#a855f7',
  safety: '#ef4444',
  other: '#6b7280',
};

function createIcon(category: string, status: string) {
  const color = status === 'resolved' || status === 'closed' ? '#9ca3af' : (categoryIcons[category] || '#6b7280');
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface MapIssue {
  _id: string;
  title: string;
  category: string;
  status: string;
  location: { coordinates: [number, number] };
  upvoteCount: number;
  priority: string;
}

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  useMapEvents({
    moveend: (e) => onBoundsChange(e.target.getBounds()),
    zoomend: (e) => onBoundsChange(e.target.getBounds()),
  });
  return null;
}

export default function MapPage() {
  const [issues, setIssues] = useState<MapIssue[]>([]);

  const fetchViewport = useCallback(async (bounds: L.LatLngBounds) => {
    try {
      const res = await api.get('/issues/viewport', {
        params: {
          swLng: bounds.getSouthWest().lng,
          swLat: bounds.getSouthWest().lat,
          neLng: bounds.getNorthEast().lng,
          neLat: bounds.getNorthEast().lat,
        },
      });
      setIssues(res.data.data);
    } catch {
      // Fallback: fetch all issues
      const res = await api.get('/issues', { params: { limit: 100 } });
      setIssues(res.data.data);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.on('issue:created', (issue: MapIssue) => {
      setIssues((prev) => [...prev, issue]);
    });
    socket.on('issue:updated', (updated: MapIssue) => {
      setIssues((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
    });
    return () => {
      socket.off('issue:created');
      socket.off('issue:updated');
    };
  }, []);

  return (
    <div className="h-[calc(100vh-57px)]">
      <MapContainer center={CAMPUS_CENTER} zoom={15} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onBoundsChange={fetchViewport} />
        {issues.map((issue) => (
          <Marker
            key={issue._id}
            position={[issue.location.coordinates[1], issue.location.coordinates[0]]}
            icon={createIcon(issue.category, issue.status)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-semibold text-sm mb-1">{issue.title}</h3>
                <div className="flex gap-1 mb-2">
                  <CategoryBadge category={issue.category} />
                  <StatusBadge status={issue.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <ThumbsUp className="w-3 h-3" /> {issue.upvoteCount}
                  </span>
                  <Link to={`/issues/${issue._id}`} className="text-xs text-primary-600 hover:underline">
                    View details
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
