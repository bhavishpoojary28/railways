import React, { useState, useEffect } from 'react';
import {
  QrCode, AlertTriangle, ShieldAlert, CheckCircle, Clock,
  MapPin, User, LogOut, Loader2, Send, Wifi, WifiOff,
  Plus, Calendar, Wrench, Building, ArrowRight, Check, X,
  ExternalLink, BarChart3, HelpCircle, Activity, Camera, AlertCircle
} from 'lucide-react';

const API_BASE = 'https://railways-pcck.onrender.com/api';

export default function App() {
  // Navigation State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);

  // Global App States
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(''); // 'syncing', 'done', ''
  const [draftsCount, setDraftsCount] = useState(0);

  // Parse path for dynamic routes
  // Support: /pole/:poleId
  const isPoleRoute = currentPath.startsWith('/pole/');
  const routePoleId = isPoleRoute ? currentPath.split('/pole/')[1] : null;

  // Handle network status
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncOfflineDrafts();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check of drafts
    updateDraftsCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync route changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch current user details on token change
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [token]);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token expired or invalid
        logout();
      }
    } catch (err) {
      console.error("Error fetching user session", err);
    }
  };

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    navigate('/login');
  };

  const updateDraftsCount = () => {
    const drafts = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
    setDraftsCount(drafts.length);
  };

  const syncOfflineDrafts = async () => {
    const drafts = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
    if (drafts.length === 0) return;

    setSyncStatus('syncing');
    let successCount = 0;

    for (const draft of drafts) {
      try {
        const res = await fetch(`${API_BASE}/complaints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft)
        });
        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error("Failed to sync draft complaint", err);
      }
    }

    // Remove synced items
    const remainingDrafts = drafts.slice(successCount);
    localStorage.setItem('offline_complaints', JSON.stringify(remainingDrafts));
    updateDraftsCount();

    setSyncStatus('done');
    setTimeout(() => setSyncStatus(''), 3000);
  };

  const queueOfflineComplaint = (complaintData) => {
    const drafts = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
    drafts.push(complaintData);
    localStorage.setItem('offline_complaints', JSON.stringify(drafts));
    updateDraftsCount();
  };

  // Render Routes
  return (
    <div className="min-h-screen pb-20 flex flex-col font-sans text-slate-100 bg-[#0b0f19]">
      {/* Top Banner for Offline & Sync Status */}
      <div className="sticky top-0 z-50">
        {!online && (
          <div className="bg-amber-500 text-slate-900 text-center py-1 text-xs font-semibold flex items-center justify-center gap-1">
            <WifiOff size={14} /> Offline Mode - Complaints will be queued locally
          </div>
        )}
        {syncStatus === 'syncing' && (
          <div className="bg-blue-600 text-white text-center py-1 text-xs font-semibold flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Syncing offline reports to server...
          </div>
        )}
        {syncStatus === 'done' && (
          <div className="bg-emerald-600 text-white text-center py-1 text-xs font-semibold flex items-center justify-center gap-1">
            <Wifi size={14} /> Local complaints synced successfully!
          </div>
        )}
      </div>

      {/* Header */}
      <header className="px-4 py-3 bg-[#111827]/80 backdrop-blur-md border-b border-slate-800/80 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(user ? '/dashboard' : '/login')}>
          <div className="p-2 bg-gradient-to-tr from-amber-500 to-red-600 rounded-lg shadow-lg">
            <QrCode size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-amber-400">
              RailTrack Monitor
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Pole Maintenance & Safety Hub</p>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-200">{user.name}</p>
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500">
                {user.role.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/60 rounded-full border border-slate-700 transition"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {currentPath !== '/public' && (
              <button
                onClick={() => navigate('/public')}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-700 bg-slate-800/30 text-amber-500 rounded-lg hover:bg-slate-800 transition"
              >
                Public Report
              </button>
            )}
            {currentPath !== '/login' && (
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg shadow transition"
              >
                Staff Login
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {/* Router Dispatcher */}
        {(() => {
          if (isPoleRoute) {
            return (
              <PoleDetailView
                poleId={routePoleId}
                user={user}
                token={token}
                online={online}
                queueOfflineComplaint={queueOfflineComplaint}
                navigate={navigate}
              />
            );
          }

          switch (currentPath) {
            case '/login':
              return <LoginView login={login} user={user} navigate={navigate} />;
            case '/public':
              return (
                <PublicReportView
                  online={online}
                  queueOfflineComplaint={queueOfflineComplaint}
                  navigate={navigate}
                />
              );
            case '/dashboard':
              if (!token) {
                navigate('/login');
                return null;
              }
              return (
                <DashboardView
                  user={user}
                  token={token}
                  online={online}
                  draftsCount={draftsCount}
                  syncOfflineDrafts={syncOfflineDrafts}
                  navigate={navigate}
                />
              );
            case '/scan':
              return <QRScannerView navigate={navigate} />;
            default:
              // Fallback routing
              if (token) {
                navigate('/dashboard');
              } else {
                navigate('/public');
              }
              return null;
          }
        })()}
      </main>

      {/* Mobile Bottom Navigation Bar (Shown when authenticated) */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/95 border-t border-slate-800 backdrop-blur-lg safe-bottom flex justify-around py-2 max-w-lg mx-auto shadow-2xl">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-semibold transition ${currentPath === '/dashboard' ? 'text-amber-500' : 'text-slate-400'}`}
          >
            <Activity size={18} />
            <span>Panel</span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="relative flex flex-col items-center justify-center -mt-6"
          >
            <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full text-white shadow-lg shadow-orange-500/20 border-4 border-[#0b0f19] hover:scale-105 active:scale-95 transition duration-150">
              <QrCode size={24} />
            </div>
            <span className="text-[10px] text-slate-300 font-bold mt-1">Scan Pole</span>
          </button>

          <button
            onClick={() => navigate(`/pole/POLE-SEC12-0047`)}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-semibold transition ${isPoleRoute ? 'text-amber-500' : 'text-slate-400'}`}
          >
            <MapPin size={18} />
            <span>Poles</span>
          </button>
        </nav>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 1. LOGIN VIEW
// ----------------------------------------------------
function LoginView({ login, user, navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection failed. Please check backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 mt-8 shadow-xl border border-slate-800">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight">Staff Portal</h2>
        <p className="text-xs text-slate-400 mt-1">Enter employee ID and password to access dashboard</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-200 text-xs px-3 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Employee ID</label>
          <input
            type="text"
            placeholder="e.g. EMP003"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/60 focus:border-amber-500 focus:outline-none transition placeholder-slate-500 text-slate-100"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/60 focus:border-amber-500 focus:outline-none transition placeholder-slate-500 text-slate-100"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 hover:brightness-110 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Authenticate'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-800 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Demo Credentials</p>
        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-400 text-left">
          <p>👷 <span className="font-bold">Lineman:</span> EMP003 / lineman123</p>
          <p>👨‍💼 <span className="font-bold">Supervisor:</span> EMP002 / supervisor123</p>
          <p>🛠️ <span className="font-bold">Vendor:</span> VND001 / vendor123</p>
          <p>🛡️ <span className="font-bold">Admin:</span> EMP001 / admin123</p>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. QR SCANNER VIEW (Simulation + Real)
// ----------------------------------------------------
function QRScannerView({ navigate }) {
  const [inputPole, setInputPole] = useState('');
  const [scanning, setScanning] = useState(false);

  const simulateScan = (poleId) => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      navigate(`/pole/${poleId}`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold">QR Pole Scanning Hub</h2>
        <p className="text-xs text-slate-400 mt-1">Scan physical pole code or pick a simulation pole below</p>
      </div>

      {/* Simulated Scanner camera frame */}
      <div className="relative glass-panel rounded-2xl overflow-hidden border border-slate-700/50 aspect-video flex flex-col items-center justify-center p-4">
        {scanning ? (
          <div className="text-center space-y-3">
            <Loader2 size={36} className="animate-spin text-amber-500 mx-auto" />
            <p className="text-xs font-bold text-slate-300">Decoding Track Coordinates...</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Camera size={40} className="text-slate-400 mx-auto animate-pulse" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-300">Camera Feed Simulator</p>
              <p className="text-[10px] text-slate-500">Physical scanning requires SSL/localhost. Use presets below.</p>
            </div>
          </div>
        )}

        {/* Aim borders */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500"></div>
      </div>

      {/* Simulation Presets */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Simulate QR Preset Scans</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => simulateScan('POLE-SEC12-0047')}
            className="p-3 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
          >
            <p className="text-xs font-bold text-slate-200">POLE-SEC12-0047</p>
            <p className="text-[9px] text-red-400 font-bold mt-1">Section 12 (Critical Fault)</p>
          </button>

          <button
            onClick={() => simulateScan('POLE-SEC15-0102')}
            className="p-3 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
          >
            <p className="text-xs font-bold text-slate-200">POLE-SEC15-0102</p>
            <p className="text-[9px] text-amber-400 font-bold mt-1">Section 15 (Major Overdue)</p>
          </button>

          <button
            onClick={() => simulateScan('POLE-SEC12-0045')}
            className="p-3 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
          >
            <p className="text-xs font-bold text-slate-200">POLE-SEC12-0045</p>
            <p className="text-[9px] text-emerald-400 font-bold mt-1">Section 12 (Clear Pole)</p>
          </button>

          <button
            onClick={() => simulateScan('POLE-SEC12-0046')}
            className="p-3 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
          >
            <p className="text-xs font-bold text-slate-200">POLE-SEC12-0046</p>
            <p className="text-[9px] text-slate-400 mt-1">Section 12 (Good Condition)</p>
          </button>
        </div>

        {/* Manual code entry */}
        <div className="pt-2 border-t border-slate-800">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Enter Pole ID manually</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. POLE-SEC12-0047"
              value={inputPole}
              onChange={(e) => setInputPole(e.target.value)}
              className="flex-1 text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500 text-slate-100 placeholder-slate-600"
            />
            <button
              onClick={() => inputPole && simulateScan(inputPole)}
              disabled={!inputPole}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 disabled:opacity-50 transition"
            >
              Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. POLE DETAIL VIEW & COMPLAINT FILING
// ----------------------------------------------------
function PoleDetailView({ poleId, user, token, online, queueOfflineComplaint, navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [severity, setSeverity] = useState('Routine');
  const [category, setCategory] = useState('Track Fracture');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchPoleDetail();
  }, [poleId]);

  const fetchPoleDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/poles/${poleId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setError('Track section pole details could not be found.');
      }
    } catch (err) {
      setError('Connection failure. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('media', file);

    try {
      const res = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const rData = await res.json();
        setFileUrl(rData.mediaUrl);
      } else {
        alert('File upload failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed. Saving mock path instead.');
      setFileUrl(`/uploads/mock-photo-${Date.now()}.jpg`);
    } finally {
      setUploading(false);
    }
  };

  const handleComplaintSubmit = async (e, forceCritical = false) => {
    if (e) e.preventDefault();

    const selectedSeverity = forceCritical ? 'Critical' : severity;
    const finalDescription = forceCritical ? 'CRITICAL EMERGENCY: ' + (description || 'Immediate alert trigger filed.') : description;

    // File validation for critical issues
    if (selectedSeverity === 'Critical' && !fileUrl) {
      alert('Critical complaints require a photo or video upload to proceed.');
      return;
    }

    const payload = {
      poleId,
      reportedBy: user ? user.id : null,
      severity: selectedSeverity,
      category,
      mediaUrl: fileUrl,
      description: finalDescription,
      isPublic: user ? 0 : 1
    };

    if (!online) {
      queueOfflineComplaint(payload);
      setSubmitSuccess(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSubmitSuccess(true);
        fetchPoleDetail(); // Refresh complaints
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to file complaint.');
      }
    } catch (err) {
      console.error(err);
      queueOfflineComplaint(payload);
      setSubmitSuccess(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={30} className="animate-spin text-amber-500" />
        <p className="text-xs text-slate-400">Fetching Track Coordinates...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center space-y-4">
        <AlertTriangle size={36} className="text-red-500 mx-auto" />
        <div>
          <h2 className="font-bold text-slate-200">Lookup Error</h2>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
        <button
          onClick={() => navigate('/scan')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition"
        >
          Return to Scan
        </button>
      </div>
    );
  }

  const { pole, openComplaints } = data;
  const isOverdue = new Date(pole.last_inspection_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      {/* 1. POLE METADATA CARD */}
      <div className="glass-panel rounded-2xl p-5 border-l-4 border-l-amber-500 relative">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">{pole.pole_id}</h2>
            <p className="text-xs text-slate-400">{pole.section_name}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${isOverdue ? 'bg-red-950/80 border border-red-500/40 text-red-400' : 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400'}`}>
              {isOverdue ? 'Inspection Overdue' : 'Status Clear'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
          <div>
            <p className="text-slate-500 font-semibold text-[10px] uppercase">GPS Coordinates</p>
            <p className="text-slate-300 font-medium font-mono mt-0.5">{pole.latitude.toFixed(5)}, {pole.longitude.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-semibold text-[10px] uppercase">Last Inspected</p>
            <p className="text-slate-300 font-medium mt-0.5">{pole.last_inspection_date}</p>
          </div>
        </div>
      </div>

      {/* 2. OPEN COMPLAINTS ON THIS POLE */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Active Fault Reports</span>
          <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {openComplaints.length}
          </span>
        </h3>

        {openComplaints.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No active complaints found for this pole section.</p>
        ) : (
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {openComplaints.map(c => (
              <div key={c.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c.severity === 'Critical' ? 'bg-red-500 animate-pulse' : c.severity === 'Major' ? 'bg-orange-500' : 'bg-emerald-500'
                      }`}></span>
                    <p className="text-xs font-bold text-slate-200">{c.category}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{c.description}</p>
                  <p className="text-[9px] text-slate-500">ID: {c.id} • {c.created_at}</p>
                </div>
                <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. REPORT A FAULT FORM */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Report New Fault</h3>
          {/* Quick Immediate trigger shortcut */}
          <button
            type="button"
            onClick={() => {
              if (confirm("This files an emergency Critical Track Fracture complaint with SMS alert. Do you want to continue?")) {
                setCategory('Track Fracture');
                setSeverity('Critical');
                setFileUrl(`/uploads/emergency-track-${Date.now()}.jpg`); // Mock upload URL
                alert("Simulated emergency photo attached. Click Submit to alert Section Supervisor.");
              }
            }}
            className="px-2.5 py-1 text-[9px] font-extrabold uppercase bg-red-950/80 border border-red-500/40 text-red-400 rounded-md hover:bg-red-900/30 transition flex items-center gap-1"
          >
            <ShieldAlert size={10} /> Quick Critical
          </button>
        </div>

        {submitSuccess ? (
          <div className="bg-emerald-950/30 border border-emerald-500/40 text-slate-200 p-5 rounded-xl text-center space-y-3">
            <CheckCircle size={30} className="text-emerald-500 mx-auto" />
            <div>
              <p className="text-xs font-bold">Complaint Logged Successfully</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {online ? 'Your submission has been synced and section supervisors alerted.' : 'Saved locally in drafts. It will automatically sync once you return online.'}
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitSuccess(false);
                setDescription('');
                setFileUrl('');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition"
            >
              Report Another Issue
            </button>
          </div>
        ) : (
          <form onSubmit={handleComplaintSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Routine">Routine</option>
                  <option value="Major">Major</option>
                  <option value="Critical">Critical (Requires Photo)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Track Fracture">Track Fracture</option>
                  <option value="Signal Fault">Signal Fault</option>
                  <option value="Vegetation">Vegetation</option>
                  <option value="Pole Damage">Pole Damage</option>
                  <option value="Vandalism">Vandalism</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Photo Upload</label>
              <div className="flex gap-2 items-center">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 border border-dashed border-slate-700 hover:border-amber-500/50 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer transition">
                  <Camera size={14} />
                  <span>{uploading ? 'Uploading...' : fileUrl ? 'Photo Uploaded ✓' : 'Camera / Select'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {fileUrl && (
                  <button
                    type="button"
                    onClick={() => setFileUrl('')}
                    className="px-2.5 py-2 bg-red-950/80 hover:bg-red-900/30 text-red-400 text-xs border border-red-500/40 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
              {severity === 'Critical' && !fileUrl && (
                <p className="text-[9px] text-red-400 mt-1 font-bold">⚠️ Warning: Critical complaints require photo proof.</p>
              )}
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fault Description</label>
              <textarea
                rows="2"
                placeholder="Details of structural cracking or hazard..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-extrabold uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 tracking-wider transition"
            >
              <Send size={13} /> Log Fault Report
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. PUBLIC COMMUTER VIEW (No authentication required)
// ----------------------------------------------------
function PublicReportView({ online, queueOfflineComplaint, navigate }) {
  const [poleId, setPoleId] = useState('');
  const [category, setCategory] = useState('Track Fracture');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('media', file);

    try {
      const res = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const rData = await res.json();
        setFileUrl(rData.mediaUrl);
      } else {
        alert('File upload failed.');
      }
    } catch (err) {
      console.error(err);
      setFileUrl(`/uploads/public-photo-${Date.now()}.jpg`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!poleId) {
      alert('Pole ID is required. Please type in a valid pole identifier.');
      return;
    }

    const payload = {
      poleId,
      severity: 'Major', // Default for public complaints
      category,
      mediaUrl: fileUrl,
      description: 'Commuter Public Hazard: ' + description,
      isPublic: 1
    };

    if (!online) {
      queueOfflineComplaint(payload);
      setSuccess(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit report. Ensure the pole ID exists.');
      }
    } catch (err) {
      console.error(err);
      queueOfflineComplaint(payload);
      setSuccess(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-1.5">
          <AlertTriangle className="text-amber-500 animate-bounce" size={20} /> Public Hazard Reporting
        </h2>
        <p className="text-xs text-slate-400 mt-1">Commuter safety reporting channel. Submissions are moderated.</p>
      </div>

      {success ? (
        <div className="glass-panel rounded-2xl p-6 text-center space-y-4">
          <CheckCircle size={36} className="text-emerald-500 mx-auto" />
          <div>
            <h3 className="font-bold text-slate-100">Hazard Report Received</h3>
            <p className="text-xs text-slate-400 mt-1.5">
              Thank you for alerting us. Section engineers have been notified and will verify the report.
            </p>
          </div>
          <button
            onClick={() => {
              setSuccess(false);
              setPoleId('');
              setDescription('');
              setFileUrl('');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition"
          >
            File Another Report
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pole ID (Written on Pole QR sticker)</label>
            <input
              type="text"
              placeholder="e.g. POLE-SEC12-0047"
              value={poleId}
              onChange={(e) => setPoleId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
              >
                <option value="Track Fracture">Track Fracture</option>
                <option value="Signal Fault">Signal Fault</option>
                <option value="Vegetation">Vegetation Overgrowth</option>
                <option value="Pole Damage">Physical Pole Damage</option>
                <option value="Vandalism">Vandalism</option>
                <option value="Other">Other Hazard</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Photo Upload</label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 border border-dashed border-slate-700 rounded-lg text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-200 transition">
                <Camera size={14} />
                <span className="truncate">{uploading ? 'Loading...' : fileUrl ? 'Attached ✓' : 'Capture Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Explain the Hazard</label>
            <textarea
              rows="3"
              placeholder="Describe the defect, location details, or obstruction..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 transition"
          >
            <Send size={13} /> Submit Emergency Report
          </button>
        </form>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 5. ROLE-BASED DASHBOARDS (Lineman, Vendor, Supervisor/Admin)
// ----------------------------------------------------
function DashboardView({ user, token, online, draftsCount, syncOfflineDrafts, navigate }) {
  const [complaints, setComplaints] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [suggestedVendors, setSuggestedVendors] = useState([]);

  // Selection/State modals
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'maintenance', 'vendors', 'moderation'

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const authHeader = { 'Authorization': `Bearer ${token}` };

      // Load complaints
      const complaintsRes = await fetch(`${API_BASE}/complaints`, { headers: authHeader });
      const complaintsData = await complaintsRes.json();
      setComplaints(complaintsData);

      // Load maintenance schedules
      const schedulesRes = await fetch(`${API_BASE}/maintenance`, { headers: authHeader });
      const schedulesData = await schedulesRes.json();
      setSchedules(schedulesData);

      // If supervisor/admin, load vendors too
      if (user && user.role && ['supervisor', 'admin'].includes(user.role)) {
        const vendorsRes = await fetch(`${API_BASE}/vendors/performance`, { headers: authHeader });
        const vendorsData = await vendorsRes.json();
        setVendors(vendorsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (complaintId, nextStatus, vendorId = undefined) => {
    try {
      const res = await fetch(`${API_BASE}/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          notes: statusNotes || `Moved to ${nextStatus}`,
          assignedVendorId: vendorId !== undefined ? vendorId : undefined
        })
      });
      if (res.ok) {
        setSelectedComplaint(null);
        setStatusNotes('');
        setSelectedVendorId('');
        fetchData();
      } else {
        alert('Failed to update complaint status.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleModerate = async (complaintId, action) => {
    try {
      const res = await fetch(`${API_BASE}/complaints/${complaintId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Moderation action failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteInspection = async (scheduleId, notes) => {
    try {
      const res = await fetch(`${API_BASE}/maintenance/${scheduleId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to complete inspection schedule.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Autoload vendor suggestions when selecting a complaint
  const fetchSuggestedVendors = async (sectionName) => {
    try {
      const res = await fetch(`${API_BASE}/vendors/suggest?sectionName=${encodeURIComponent(sectionName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedVendors(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={30} className="animate-spin text-amber-500" />
        <p className="text-xs text-slate-400">Syncing Dashboards...</p>
      </div>
    );
  }

  // Filter complaints & schedules based on user role
  const isLineman = user.role === 'lineman';
  const isVendor = user.role === 'vendor';
  const isSupervisorOrAdmin = ['supervisor', 'admin'].includes(user.role);

  // Vendor lists only their assigned complaints
  const filteredComplaints = isVendor
    ? complaints.filter(c => c.assigned_vendor_id === user.id && c.is_moderated === 1)
    : isLineman
      ? complaints.filter(c => c.reported_by === user.id || c.status === 'Raised')
      : complaints.filter(c => c.is_moderated === 1); // Staff only sees moderated ones

  const pendingModerationComplaints = complaints.filter(c => c.is_public === 1 && c.is_moderated === 0);

  // Lineman lists only their scheduled tasks
  const filteredSchedules = isLineman
    ? schedules.filter(s => s.assigned_staff_id === user.id)
    : schedules;

  // Visual status indicators
  const getStatusColor = (status) => {
    switch (status) {
      case 'Raised': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Acknowledged': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Assigned': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'In Progress': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Offline drafts sync banner */}
      {draftsCount > 0 && (
        <div className="p-4 bg-slate-900 border border-slate-700/60 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="text-amber-500 animate-pulse" size={18} />
            <div>
              <p className="text-xs font-bold text-slate-100">{draftsCount} Drafts Queued Locally</p>
              <p className="text-[10px] text-slate-400">Offline reports logged during network disruption</p>
            </div>
          </div>
          <button
            onClick={syncOfflineDrafts}
            disabled={!online}
            className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 rounded-lg transition"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* 2. Admin Quick Stats & KPI Grid */}
      {isSupervisorOrAdmin && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="glass-panel p-3 rounded-xl border border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unresolved</p>
              <p className="text-lg font-extrabold text-red-500 mt-1">
                {complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed' && c.is_moderated === 1).length}
              </p>
            </div>
            <div className="glass-panel p-3 rounded-xl border border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Overdue Check</p>
              <p className="text-lg font-extrabold text-amber-500 mt-1">
                {schedules.filter(s => s.status === 'Pending' && new Date(s.due_date) < new Date()).length}
              </p>
            </div>
            <div className="glass-panel p-3 rounded-xl border border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending Mods</p>
              <p className="text-lg font-extrabold text-blue-400 mt-1">
                {pendingModerationComplaints.length}
              </p>
            </div>
          </div>

          {/* Simple section-wise Heatmap */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 size={12} className="text-amber-500" /> Active Fault Heatmap by Section
              </h4>
              <span className="text-[10px] text-slate-500 font-bold">Complaints</span>
            </div>
            <div className="space-y-2">
              {['Section 12', 'Section 14', 'Section 15'].map(section => {
                const count = complaints.filter(c => {
                  return c.section_name === section && c.status !== 'Closed' && c.status !== 'Resolved';
                }).length;

                const percentage = Math.min(100, Math.max(10, count * 20));

                return (
                  <div key={section} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-300">{section}</span>
                      <span className="text-slate-400">{count} issues</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${count > 2 ? 'bg-red-500' : count > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. TABS HEADER */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition ${activeTab === 'tasks' ? 'bg-slate-800 text-amber-500 shadow' : 'text-slate-400'}`}
        >
          Fault Logs ({filteredComplaints.length})
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition ${activeTab === 'maintenance' ? 'bg-slate-800 text-amber-500 shadow' : 'text-slate-400'}`}
        >
          Checklists ({filteredSchedules.length})
        </button>
        {isSupervisorOrAdmin && (
          <>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition ${activeTab === 'vendors' ? 'bg-slate-800 text-amber-500 shadow' : 'text-slate-400'}`}
            >
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold relative transition ${activeTab === 'moderation' ? 'bg-slate-800 text-amber-500 shadow' : 'text-slate-400'}`}
            >
              Moderation
              {pendingModerationComplaints.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              )}
            </button>
          </>
        )}
      </div>

      {/* 4. ACTIVE TAB PANELS */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {filteredComplaints.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 italic text-xs">
              No active tasks or complaints logged in this queue.
            </div>
          ) : (
            filteredComplaints.map(c => (
              <div
                key={c.id}
                className="glass-panel rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block px-2 py-0.5 border text-[9px] font-bold rounded-md uppercase tracking-wider ${getStatusColor(c.status)}`}>
                      {c.status}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 mt-2">{c.pole_id} — {c.category}</h4>
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${c.severity === 'Critical' ? 'bg-red-950/80 text-red-400 border border-red-500/40 animate-pulse' : c.severity === 'Major' ? 'bg-orange-950/80 text-orange-400 border border-orange-500/40' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                    {c.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-medium">{c.description}</p>

                {c.media_url && (
                  <div className="pt-1.5">
                    <a
                      href={`https://railways-pcck.onrender.com${c.media_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-bold hover:underline"
                    >
                      <Camera size={12} /> View Attached Media/Photo
                    </a>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Reported: {c.created_at.split(' ')[0]}</span>
                  {c.company_name && <span className="font-bold text-amber-500">Assigned: {c.company_name}</span>}
                </div>

                {/* Status action trigger */}
                <div className="pt-2 flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedComplaint(c);
                      if (isSupervisorOrAdmin) {
                        fetchSuggestedVendors(c.section_name || 'Section 12');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700 rounded-lg transition flex items-center gap-1"
                  >
                    Manage Actions <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="space-y-3">
          {filteredSchedules.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No maintenance tasks scheduled.</p>
          ) : (
            filteredSchedules.map(s => {
              const isOverdue = s.status === 'Pending' && new Date(s.due_date) < new Date();
              return (
                <div key={s.id} className="glass-panel rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block px-2 py-0.5 border text-[9px] font-bold rounded-md uppercase tracking-wider ${s.status === 'Completed' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                        }`}>
                        {s.status}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 mt-2">{s.pole_id}</h4>
                      <p className="text-[10px] text-slate-400">{s.section_name} • Staff: {s.staff_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Due Date</p>
                      <p className={`text-xs font-bold ${isOverdue ? 'text-red-500 font-extrabold' : 'text-slate-300'}`}>
                        {s.due_date} {isOverdue && '⚠️'}
                      </p>
                    </div>
                  </div>

                  {s.notes && <p className="text-[11px] text-slate-500 italic">Notes: {s.notes}</p>}

                  {s.status === 'Pending' && (isLineman || isSupervisorOrAdmin) && (
                    <div className="flex gap-1.5 justify-end pt-2 border-t border-slate-800/50">
                      <button
                        onClick={() => {
                          const note = prompt("Enter inspection checklist findings:");
                          if (note !== null) handleCompleteInspection(s.id, note);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1"
                      >
                        <Check size={12} /> Mark Inspected & Clear
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'vendors' && isSupervisorOrAdmin && (
        <div className="glass-panel rounded-xl overflow-hidden border border-slate-800">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Vendor SLAs & Performance</h4>
          </div>
          <div className="divide-y divide-slate-800/80">
            {vendors.map(v => (
              <div key={v.vendorId} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{v.companyName}</h5>
                    <p className="text-[10px] text-slate-500">{v.specialization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Avg Resolution</p>
                    <p className="text-xs font-bold text-amber-500">{v.avgResolutionHours} hrs</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-900 text-center text-[10px] text-slate-400">
                  <div>
                    <span className="block font-extrabold text-slate-200">{v.totalJobs}</span>
                    <span>Total Jobs</span>
                  </div>
                  <div>
                    <span className="block font-extrabold text-emerald-400">{v.resolvedJobsCount}</span>
                    <span>Resolved</span>
                  </div>
                  <div>
                    <span className="block font-extrabold text-amber-400">{v.pendingJobsCount}</span>
                    <span>Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'moderation' && isSupervisorOrAdmin && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Hazard Reports Pending Moderation</h4>
          {pendingModerationComplaints.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No commuter hazard reports require moderation.</p>
          ) : (
            pendingModerationComplaints.map(c => (
              <div key={c.id} className="glass-panel rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-purple-950/80 text-purple-400 border border-purple-500/40 text-[9px] font-bold rounded uppercase">Public Submission</span>
                    <h4 className="text-xs font-bold text-slate-200 mt-2">{c.pole_id}</h4>
                  </div>
                  <span className="text-[10px] text-slate-500">{c.created_at}</span>
                </div>
                <p className="text-xs text-slate-400 font-medium">{c.description}</p>
                {c.media_url && (
                  <div>
                    <a
                      href={`https://railways-pcck.onrender.com${c.media_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-500 font-bold hover:underline flex items-center gap-1"
                    >
                      <Camera size={12} /> View Uploaded Photo
                    </a>
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/50">
                  <button
                    onClick={() => handleModerate(c.id, 'reject')}
                    className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900/30 text-red-400 text-xs border border-red-500/40 font-bold rounded-lg transition"
                  >
                    Reject & Close
                  </button>
                  <button
                    onClick={() => handleModerate(c.id, 'approve')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition"
                  >
                    Approve / File
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. MANAGE FAULT MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-[#070b13]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl border border-slate-700 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-100">Workflow Action Center</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">ID: {selectedComplaint.id} • Current: {selectedComplaint.status}</p>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg border border-slate-700 transition"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Action log notes</label>
              <textarea
                rows="2"
                placeholder="Log notes, e.g. Joint weld completed..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Lineman workflow options */}
            {isLineman && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatusUpdate(selectedComplaint.id, 'Acknowledged')}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 rounded-xl transition"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedComplaint.id, 'In Progress')}
                  className="py-2 bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white rounded-xl shadow transition"
                >
                  Mark In Progress
                </button>
              </div>
            )}

            {/* Vendor workflow options */}
            {isVendor && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatusUpdate(selectedComplaint.id, 'In Progress')}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 rounded-xl transition"
                >
                  Accept & Start
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedComplaint.id, 'Resolved')}
                  className="py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-xl shadow transition"
                >
                  Mark Resolved
                </button>
              </div>
            )}

            {/* Supervisor / Admin workflow options: Assign Vendor */}
            {isSupervisorOrAdmin && (
              <div className="space-y-3.5 pt-2 border-t border-slate-800">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Specialization Vendor</label>
                    <span className="text-[9px] text-amber-500 font-extrabold uppercase">Suggested</span>
                  </div>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                  >
                    <option value="">Select Vendor...</option>
                    {suggestedVendors.map(vendor => (
                      <option key={vendor.user_id} value={vendor.user_id}>
                        {vendor.company_name} ({vendor.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStatusUpdate(selectedComplaint.id, 'Closed')}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 rounded-xl transition"
                  >
                    Verify & Close
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedVendorId) {
                        alert('Please select a vendor to assign.');
                        return;
                      }
                      handleStatusUpdate(selectedComplaint.id, 'Assigned', parseInt(selectedVendorId));
                    }}
                    className="py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-115 text-xs font-bold text-white rounded-xl shadow transition"
                  >
                    Assign Vendor
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
