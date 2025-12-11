// src/pages/Home.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

/**
 * Home.jsx — Dashboard with integrated Google Map
 *
 * - Requires: @react-google-maps/api installed
 * - Requires env: REACT_APP_GOOGLE_MAPS_API_KEY
 *
 * Behavior:
 * - Role detection (POST /api/detect-role) — unaffected
 * - Map shows demoBins with colored markers
 * - Clicking a marker selects the bin and recenters the map
 * - UI rules unchanged (user/admin/driver)
 */

// endpoints
const DETECT_ENDPOINT = "http://localhost:4000/api/detect-role";
const REPORT_ENDPOINT = "http://localhost:4000/api/report"; // optional

// Map container style
const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "520px",
  borderRadius: "0",
};

// default center (Bengaluru center used in earlier mock)
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

// small helper: create SVG data URL for colored marker
function createMarkerSvgDataUrl(color = "#ef4444") {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'>
    <path d="M12 2c2.761 0 5 2.239 5 5 0 5-5 11-5 11s-5-6-5-11c0-2.761 2.239-5 5-5z" fill="${color}"/>
    <circle cx="12" cy="9" r="2.5" fill="#fff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * BinMap component (internal)
 * props:
 * - bins: [{ id, title, lat, lng, status, dist }]
 * - onSelectBin(bin)
 */
function BinMap({ bins = [], onSelectBin, selectedBin }) {
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const onLoad = (map) => {
    mapRef.current = map;
  };

  // center map on selected bin when it changes
  useEffect(() => {
    if (!mapRef.current || !selectedBin) return;
    const { lat, lng } = selectedBin;
    if (typeof lat === "number" && typeof lng === "number") {
      try {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(16);
      } catch (e) {
        // ignore
      }
    }
  }, [selectedBin]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[520px] text-slate-500">
        Map failed to load
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[520px] text-slate-500">
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={selectedBin && selectedBin.lat && selectedBin.lng ? { lat: selectedBin.lat, lng: selectedBin.lng } : DEFAULT_CENTER}
      zoom={14}
      onLoad={onLoad}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      }}
    >
      {bins.map((b) => {
        // choose color by status
        const color =
          (b.status || "").toLowerCase() === "overflow"
            ? "#ef4444"
            : (b.status || "").toLowerCase() === "full"
            ? "#ef4444"
            : (b.status || "").toLowerCase() === "ok" || (b.status || "").toLowerCase() === "normal"
            ? "#0ea5e9"
            : "#f59e0b"; // fallback yellow

        const icon = {
          url: createMarkerSvgDataUrl(color),
          // Do not use scaledSize until google.maps is available — SVG will scale by itself
        };

        return (
          <Marker
            key={b.id}
            position={{ lat: b.lat, lng: b.lng }}
            onClick={() => onSelectBin(b)}
            icon={icon}
          />
        );
      })}
    </GoogleMap>
  );
}

export default function Home() {
  const navigate = useNavigate();

  // role detection and UI state (unchanged)
  const [roleInfo, setRoleInfo] = useState({
    role: "detecting",
    source: null,
    id: null,
    description: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [manualIp, setManualIp] = useState("");
  const [useManual, setUseManual] = useState(false);

  // Report modal
  const [showReport, setShowReport] = useState(false);
  const [reportPayload, setReportPayload] = useState({ binId: "", note: "" });
  const [reportStatus, setReportStatus] = useState(null);

  // Selected bin (now with lat/lng)
  const [selectedBin, setSelectedBin] = useState({
    id: "BIN-A",
    title: "Bin A",
    status: "OVERFLOW",
    dist: "0.05 km",
    lat: DEFAULT_CENTER.lat + 0.0005,
    lng: DEFAULT_CENTER.lng + 0.0006,
  });

  const normalizedRole = (roleInfo.role || "").toString().toLowerCase();
  const showAdminButton = normalizedRole === "admin";
  const showDriverButton = normalizedRole === "driver" || normalizedRole === "truck";

  useEffect(() => {
    detectRoleFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function detectRoleFlow() {
    setLoading(true);
    setError(null);

    if (useManual && manualIp) {
      await callDetectEndpoint(manualIp);
      setLoading(false);
      return;
    }

    let ip = "";
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      if (r.ok) {
        const data = await r.json();
        ip = data.ip || "";
      }
    } catch (err) {
      ip = "";
    }

    if (!ip) ip = "203.0.173.5";
    await callDetectEndpoint(ip);
    setLoading(false);
  }

  async function callDetectEndpoint(ip) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(DETECT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server ${res.status} ${txt}`);
      }

      const data = await res.json();
      setRoleInfo({
        role: data?.role ?? "user",
        source: data?.source ?? ip,
        id: data?.id ?? null,
        description: data?.description ?? "",
      });
    } catch (err) {
      console.error("detect-role error:", err);
      setError("Failed to detect role. Make sure backend is running and allows CORS.");
      setRoleInfo((s) => ({ ...s, role: "guest", source: ip }));
    } finally {
      setLoading(false);
    }
  }

  async function handleDetectClick() {
    if (useManual && !manualIp) {
      setError("Please enter an IP to use manual detection.");
      return;
    }
    setError(null);
    await detectRoleFlow();
  }

  function handleAdminNavigate() {
    if (!showAdminButton) {
      setError("Access denied — admin IP not detected.");
      setTimeout(() => setError(null), 2500);
      return;
    }
    navigate("/admin");
  }

  function handleDriverNavigate() {
    if (!showDriverButton) {
      setError("Access denied — driver IP not detected.");
      setTimeout(() => setError(null), 2500);
      return;
    }
    navigate("/driver");
  }

  async function submitReport(e) {
    e.preventDefault();
    setReportStatus({ type: "loading", text: "Submitting report..." });
    try {
      const res = await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });
      if (!res.ok) throw new Error("report failed");
      setReportStatus({ type: "success", text: "Report submitted — thank you!" });
      setShowReport(false);
      setReportPayload({ binId: "", note: "" });
    } catch (err) {
      console.warn("report error", err);
      setReportStatus({ type: "error", text: "Could not submit report (backend may be missing)." });
    } finally {
      setTimeout(() => setReportStatus(null), 3000);
    }
  }

  // demo bins with lat/lng (Bengaluru-ish)
  const demoBins = [
    { id: "BIN-A", title: "Bin A", lat: 12.9721, lng: 77.5948, color: "red", dist: "0.05 km", status: "OVERFLOW" },
    { id: "BIN-B", title: "Bin B", lat: 12.9710, lng: 77.5960, color: "yellow", dist: "0.10 km", status: "OK" },
    { id: "BIN-C", title: "Bin C", lat: 12.9702, lng: 77.5930, color: "blue", dist: "0.85 km", status: "FULL" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left dark navy panel */}
          <aside className="lg:col-span-4 col-span-1 bg-[#0f1724] text-white rounded-2xl p-6 shadow-lg order-2 lg:order-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">SMART BIN DASHBOARD</h2>
                <p className="text-xs text-slate-300 mt-1">Monitoring • Reports • Routes</p>
              </div>
              <div className="text-sm text-slate-300">v1.0</div>
            </div>

            <div className="border-t border-white/6 pt-6">
              <div className="text-xs text-slate-300">CURRENT LOCATION</div>
              <div className="mt-2 text-sm font-medium">Center: 12.9716, 77.5946</div>
            </div>

            <div className="mt-6 border-t border-white/6 pt-6">
              <div className="text-xs text-slate-300">NEARBY BINS</div>
              <ul className="mt-3 space-y-3">
                {demoBins.map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <span
                      className={`w-3 h-3 rounded-full ${b.color === "red" ? "bg-red-400" : b.color === "yellow" ? "bg-amber-400" : "bg-sky-400"}`}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{b.title}</div>
                      <div className="text-xs text-slate-300">{b.dist}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBin({ id: b.id, title: b.title, status: b.status, dist: b.dist, lat: b.lat, lng: b.lng });
                      }}
                      className="text-xs bg-white/10 px-3 py-1 rounded text-white"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border-t border-white/6 pt-6">
              <div className="text-xs text-slate-300">ROLE</div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    loading ? "bg-yellow-100 text-yellow-800" : normalizedRole === "admin" ? "bg-indigo-100 text-indigo-800" : normalizedRole === "driver" || normalizedRole === "truck" ? "bg-emerald-100 text-emerald-800" : "bg-slate-50 text-slate-900"
                  }`}
                >
                  {loading ? "Detecting..." : roleInfo.role || "guest"}
                </span>
              </div>

              <div className="mt-4 text-xs text-slate-300">
                Source: <span className="text-white/80">{roleInfo.source ?? "-"}</span>
              </div>

            {/* Admin / Driver buttons appear here (compact) */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setShowReport(true)}
                className="w-full text-sm font-semibold bg-rose-500 hover:bg-rose-600 transition text-white px-4 py-2 rounded-lg shadow"
              >
                Report Dustbin
              </button>

              {showAdminButton && (
                <button
                  onClick={handleAdminNavigate}
                  className="w-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded-lg"
                >
                  Admin Panel
                </button>
              )}

              {showDriverButton && (
                <button
                  onClick={handleDriverNavigate}
                  className="w-full text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 transition text-white px-4 py-2 rounded-lg"
                >
                  Driver Panel
                </button>
              )}
            </div>

              <div className="mt-6 text-xs text-slate-400 border-t border-white/6 pt-4">
                Backend: <span className="text-white/80">http://localhost:4000</span>
                <div className="mt-2">Detect: <code className="text-xs bg-white/6 p-1 rounded">POST /api/detect-role</code></div>
              </div>
            </div>
          </aside>

          {/* Map area */}
          <section className="lg:col-span-8 col-span-1 bg-white rounded-2xl shadow-lg relative overflow-hidden order-1 lg:order-2">

            {/* Inserted Google Map component */}
            <div className="relative">
              <BinMap
                bins={demoBins.map(b => ({ id: b.id, title: b.title, lat: b.lat, lng: b.lng, status: b.status, dist: b.dist }))}
                selectedBin={selectedBin}
                onSelectBin={(b) => setSelectedBin({ ...b })}
              />
            </div>

            {/* Glowing info card (over map) */}
            <div className="absolute left-1/2 bottom-8 -translate-x-1/2 w-[min(760px,92%)] pointer-events-none">
              <div className="mx-auto pointer-events-auto">
                <div className="bg-white rounded-2xl p-4 shadow-2xl border border-white/60 relative overflow-hidden">
                  {/* glow */}
                  <div className="absolute inset-0 -z-10 rounded-2xl blur-xl opacity-30" style={{ background: "radial-gradient(closest-side, rgba(96,165,250,0.35), transparent)" }} />
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-slate-100">
                      <svg className="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="currentColor" strokeWidth="1.5"/><path d="M8 6v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6" stroke="currentColor" strokeWidth="1.5"/></svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-500">BIN DETAILS</div>
                      <div className="mt-1 flex items-center gap-3">
                        <div className="text-lg font-bold text-slate-900">{selectedBin.title}</div>
                        <div className="text-sm px-2 py-1 rounded-full bg-rose-50 text-rose-600 font-medium">{selectedBin.status}</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Nearby: {selectedBin.dist}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowReport(true)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
                        aria-label="Report this bin"
                      >
                        Report
                      </button>
                      <div className="text-xs text-slate-400">Report submitted will notify admin & driver.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* small bottom toolbar for mobile */}
            <div className="lg:hidden px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-600">Nearby: <span className="font-medium">{selectedBin.title} ({selectedBin.dist})</span></div>
              <button onClick={() => setShowReport(true)} className="bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold">Report</button>
            </div>
          </section>
        </div>

        {/* Floating big report button (bottom-center) */}
        <div className="fixed left-1/2 -translate-x-1/2 bottom-7 z-40">
          <button
            onClick={() => setShowReport(true)}
            className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-700 shadow-2xl flex items-center justify-center text-white text-lg font-bold transform transition-all active:scale-95"
            aria-label="Report"
            title="Report Dustbin"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="currentColor" strokeWidth="1.5"/><path d="M8 6v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>

        {/* status toast */}
        {reportStatus && (
          <div className="fixed right-6 bottom-36 z-50">
            <div className={`rounded-xl px-4 py-2 shadow ${reportStatus.type === "success" ? "bg-emerald-50 text-emerald-800" : reportStatus.type === "error" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-800"}`}>
              {reportStatus.text}
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReport && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowReport(false)} />

            <form onSubmit={submitReport} className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-xl z-10">
              <h3 className="text-lg font-semibold text-slate-900">Report Dustbin</h3>
              <p className="mt-1 text-sm text-slate-500">Report an issue quickly — this is available for all roles.</p>

              <label className="mt-4 block text-sm text-slate-600">Bin (optional)</label>
              <input
                value={reportPayload.binId}
                onChange={(e) => setReportPayload((p) => ({ ...p, binId: e.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
                placeholder={selectedBin?.id ?? "e.g. BIN-A"}
              />

              <label className="mt-4 block text-sm text-slate-600">Notes</label>
              <textarea
                value={reportPayload.note}
                onChange={(e) => setReportPayload((p) => ({ ...p, note: e.target.value }))} 
                className="mt-2 w-full min-h-[96px] rounded-md border border-slate-200 px-3 py-2"
                placeholder="What did you observe?"
              />

              <div className="mt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowReport(false)} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-rose-600">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        )}

        {/* small error bar */}
        {error && (
          <div className="mt-6 text-sm text-rose-700 bg-rose-50 p-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
