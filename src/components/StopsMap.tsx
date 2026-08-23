"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/data/stops";
import { AMENITY_ICONS, AMENITY_LABELS } from "@/lib/data/stops";
import type { LatLng } from "@/lib/geo";

// Custom teardrop pins (SVG, inlined) instead of Leaflet's default blue
// marker image, to match the app's coral/teal palette without depending
// on an external image CDN.
function pinIcon(hex: string) {
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${hex}"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

const markerIcon = pinIcon("#ff6b4a");
const pendingIcon = pinIcon("#14b8a6");

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

  const initialCenter = center ?? fitPoints[0] ?? { lat: 40.4168, lng: -3.7038 };

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={6}
      scrollWheelZoom
      className={className ?? "h-full w-full"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {route && route.length > 1 && (
        <Polyline
          positions={route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#ff6b4a", weight: 4, opacity: 0.8 }}
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
              <p className="flex flex-wrap gap-2 text-xs text-gray-600">
                {stop.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a];
                  return (
                    <span key={a} className="flex items-center gap-1" title={AMENITY_LABELS[a]}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {AMENITY_LABELS[a]}
                    </span>
                  );
                })}
              </p>
              <a
                href={`/stops/${stop.id}`}
                className="text-sm font-medium text-teal-600 hover:underline"
              >
                Ver detalles
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      {pendingPoint && (
        <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon} />
      )}

      <ClickCapture onMapClick={onMapClick} />
      {fitPoints.length > 0 && !center && <FitBounds points={fitPoints} />}
    </MapContainer>
  );
}
