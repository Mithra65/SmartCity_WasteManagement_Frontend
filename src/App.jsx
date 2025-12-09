
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CameraIcon } from '@heroicons/react/24/outline';

// Leaflet marker fix for default icon when using bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

// Mock bins data
const MOCK_BINS = [
  { id: 1, name: 'Bin A', lat: 12.9716, lng: 77.5946, status: 'overflow', image: 'https://images.unsplash.com/photo-1560711168-6f0a6d8c3d6f?w=800&q=60' },
  { id: 2, name: 'Bin B', lat: 12.9722, lng: 77.5950, status: 'filled', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=60' },
  { id: 3, name: 'Bin C', lat: 12.9708, lng: 77.5936, status: 'partially-filled', image: 'https://images.unsplash.com/photo-1526403224740-0c69f5b8f3a6?w=800&q=60' },
  { id: 4, name: 'Bin D', lat: 12.9728, lng: 77.5960, status: 'empty', image: 'https://images.unsplash.com/photo-1581579187608-9b6f2b9b1f36?w=800&q=60' },
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  // returns distance in kilometers (calculated digit-by-digit)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

export default function App() {
  const [bins, setBins] = useState(MOCK_BINS);
  const [selectedBin, setSelectedBin] = useState(null);
  const [nearest, setNearest] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [captured, setCaptured] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);

  // Mock current center (city centre) - you can replace with geolocation
  const currentCenter = { lat: 12.9716, lng: 77.5946 };
}