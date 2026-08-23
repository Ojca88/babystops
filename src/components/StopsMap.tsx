"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/data/stops";
import { AMENITY_ICONS, AMENITY_LABELS } from "@/lib/data/stops";
import type { LatLng } from "@/lib/geo";

// Leaflet's default marker icons reference image paths that break under
// bundlers; point them at the CDN copy instead of shipping custom assets.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [points, map]);

  return null;
}

interface StopsMapProps {
  stops: Stop[];
  route?: LatLng[];
  center?: LatLng;
  onMapClick?: (point: LatLng) => void;
  pendingPoint?: LatLng | null;
  className?: string;
}

function ClickCapture({ onMapClick }: { onMapClick?: (p: LatLng) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onMapClick) return;
    const handler = (e: L.LeafletMouseEvent) =>
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onMapClick]);

  return null;
}

export default function StopsMap({
  stops,
  route,
  center,
  onMapClick,
  pendingPoint,
  className,
}: StopsMapProps) {
  const fitPoints = useMemo(() => {
    if (route && route.length > 0) return route;
    if (stops.length > 0) return stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    return [];
  }, [route, stops]);

  const initialCenter = center ?? fitPoints[0] ?? { lat: 39.8283, lng: -98.5795 };

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={fitPoints.length > 0 ? 6 : 4}
      scrollWheelZoom
      className={className ?? "h-full w-full"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {route && route.length > 1 && (
        <Polyline
          positions={route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.7 }}
        />
      )}

      {stops.map((stop) => (
        <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={markerIcon}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{stop.name}</p>
              {stop.address && (
                <p className="text-xs text-gray-600">{stop.address}</p>
              )}
              <p className="flex flex-wrap gap-1 text-sm">
                {stop.amenities.map((a) => (
                  <span key={a} title={AMENITY_LABELS[a]}>
                    {AMENITY_ICONS[a]}
                  </span>
                ))}
              </p>
              <a
                href={`/stops/${stop.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View details
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      {pendingPoint && (
        <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={markerIcon} />
      )}

      <ClickCapture onMapClick={onMapClick} />
      {fitPoints.length > 0 && !center && <FitBounds points={fitPoints} />}
    </MapContainer>
  );
}
