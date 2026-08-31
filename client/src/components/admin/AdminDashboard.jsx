import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  Users, 
  Pill, 
  AlertTriangle, 
  Activity, 
  UserCheck, 
  PlusCircle, 
  CheckCircle2,
  TrendingUp,
  MapPin,
  RefreshCw,
  Send
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'outbreak' | 'inventory' | 'staff'

  // Village Cluster Outbreak Data
  const [villageClusters, setVillageClusters] = useState([
    {
      id: 'v-1',
      village: 'Kunda Village (Sector 4)',
      cases: 19,
      trend: '+45%',
      condition: 'Acute Diarrheal Outbreak & Dehydration',
      threatLevel: 'HIGH_ALERT',
      actionNeeded: 'Deploy ORS & Halogen Water Purification Tablets'
    },
    {
      id: 'v-2',
      village: 'Rampur Sub-Center',
      cases: 8,
      trend: '+12%',
      condition: 'High Grade Pediatric Viral Fever',
      threatLevel: 'MODERATE_WATCH',
      actionNeeded: 'Mobile Doctor Van Inspection Scheduled'
    },
    {
      id: 'v-3',
      village: 'Bhawanipur Ward 2',
      cases: 2,
      trend: 'Stable',
      condition: 'Maternal Hypertension Monitoring',
      threatLevel: 'NORMAL',
      actionNeeded: 'Routine Antenatal Care Checkups'
    }
  ]);

  // Essential Drugs Inventory State
  const [drugs, setDrugs] = useState([
    { id: 'd-1', name: 'Paracetamol 500mg (Tablets)', stock: 3500, minThreshold: 1000, status: 'NORMAL', unit: 'strips' },
    { id: 'd-2', name: 'Oxytocin 10 IU Injection', stock: 12, minThreshold: 50, status: 'CRITICAL', unit: 'vials' },
    { id: 'd-3', name: 'Oral Rehydration Salts (ORS)', stock: 65, minThreshold: 200, status: 'LOW_STOCK', unit: 'packets' },
    { id: 'd-4', name: 'Magnesium Sulphate 50% Inj', stock: 8, minThreshold: 30, status: 'CRITICAL', unit: 'vials' },
    { id: 'd-5', name: 'Amoxicillin 250mg Suspension', stock: 450, minThreshold: 100, status: 'NORMAL', unit: 'bottles' }
  ]);

  const [replenishSuccess, setReplenishSuccess] = useState('');

  const handleReplenish = (drugId) => {
    setDrugs(prev => prev.map(d => {
      if (d.id === drugId) {
        return { ...d, stock: d.stock + 200, status: 'NORMAL' };
      }
      return d;
    }));
    setReplenishSuccess('Autonomous replenishment requisition sent to District Warehouse!');
    setTimeout(() => setReplenishSuccess(''), 3000);
  };

  // Staff Form State
  const [newStaff, setNewStaff] = useState({ name: '', phone: '', role: 'ASHA_WORKER', phcCenter: 'PHC Kunda Hub' });
  const [staffSuccess, setStaffSuccess] = useState('');
  const [staffList, setStaffList] = useState([
    { id: 'st-1', name: 'Dr. Arvind Sharma', role: 'DOCTOR', phone: '9811223344', center: 'PHC Kunda Hub' },
    { id: 'st-2', name: 'Sunita Devi', role: 'ASHA_WORKER', phone: '9876543210', center: 'PHC Kunda Hub' },
    { id: 'st-3', name: 'Meena Kumari', role: 'ASHA_WORKER', phone: '6307325465', center: 'PHC Kunda Hub' }
  ]);

  const handleRegisterStaff = (e) => {
    e.preventDefault();
    const created = {
      id: `st-${Date.now()}`,
      name: newStaff.name,
      role: newStaff.role,
      phone: newStaff.phone,
      center: newStaff.phcCenter
    };
    setStaffList([created, ...staffList]);
    setStaffSuccess(`${newStaff.name} registered as ${newStaff.role}!`);
    setNewStaff({ name: '', phone: '', role: 'ASHA_WORKER', phcCenter: 'PHC Kunda Hub' });
    setTimeout(() => setStaffSuccess(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            PHC Administrative Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            District Medical Directorate • <span className="font-semibold text-slate-800">{user?.phcCenter}</span>
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('outbreak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'outbreak' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Outbreak Heatmap
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'inventory' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Drug Stock
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'staff' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Staff Portal
          </button>
        </div>
      </div>

      {/* Tab 1: Overview Analytics */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Field Intake</p>
              <p className="text-2xl font-black text-slate-900 mt-1">1,428</p>
              <span className="text-[11px] text-emerald-600 font-semibold">↑ 14% this week</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-rose-600 uppercase">Emergency Referrals</p>
              <p className="text-2xl font-black text-rose-700 mt-1">29</p>
              <span className="text-[11px] text-rose-600 font-semibold">Triaged Critical Red</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-indigo-600 uppercase">Active Tele-OPDs</p>
              <p className="text-2xl font-black text-indigo-900 mt-1">84</p>
              <span className="text-[11px] text-indigo-600 font-semibold">Connected WebRTC</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-amber-600 uppercase">Stock Out Risk</p>
              <p className="text-2xl font-black text-amber-700 mt-1">3 Drugs</p>
              <span className="text-[11px] text-amber-600 font-semibold">Under Min Threshold</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Outbreak Surveillance Heatmap */}
      {activeTab === 'outbreak' && (
        <div className="mt-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-rose-600" />
                  Village Epidemiological Cluster Surveillance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Automated geo-clustering based on incoming ASHA triage reports.</p>
              </div>
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl animate-pulse">
                Live Spatial Alert
              </span>
            </div>

            <div className="space-y-3">
              {villageClusters.map((cluster) => (
                <div 
                  key={cluster.id} 
                  className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    cluster.threatLevel === 'HIGH_ALERT'
                      ? 'bg-rose-50/50 border-rose-200'
                      : cluster.threatLevel === 'MODERATE_WATCH'
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{cluster.village}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        cluster.threatLevel === 'HIGH_ALERT' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        {cluster.threatLevel.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold mt-1">{cluster.condition}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Recommended Action: {cluster.actionNeeded}</p>
                  </div>

                  <div className="text-left md:text-right shrink-0">
                    <p className="text-xl font-black text-slate-900">{cluster.cases} <span className="text-xs font-normal text-slate-500">cases</span></p>
                    <span className="text-xs text-rose-600 font-bold">{cluster.trend} surge</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Essential Drug Stock & Automated Replenishment */}
      {activeTab === 'inventory' && (
        <div className="mt-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-indigo-600" />
                  PHC Essential Drug Supply Chain & Buffer Stock
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Automated threshold triggers for critical emergency medications.</p>
              </div>
            </div>

            {replenishSuccess && (
              <div className="my-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {replenishSuccess}
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {drugs.map((drug) => (
                <div key={drug.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{drug.name}</span>
                    <p className="text-xs text-slate-500">Minimum Buffer Threshold: {drug.minThreshold} {drug.unit}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-base font-black ${
                        drug.status === 'CRITICAL' ? 'text-rose-600' : drug.status === 'LOW_STOCK' ? 'text-amber-600' : 'text-slate-900'
                      }`}>
                        {drug.stock} <span className="text-xs font-medium text-slate-500">{drug.unit}</span>
                      </p>
                    </div>

                    {drug.status !== 'NORMAL' ? (
                      <button
                        onClick={() => handleReplenish(drug.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        Reorder Supply
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200">
                        In Stock
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Staff Management */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Provision Healthcare Staff
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Authorizes mobile credentials for portal access.</p>

            {staffSuccess && (
              <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{staffSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterStaff} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="e.g. Dr. Rajesh Mishra"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold"
                >
                  <option value="ASHA_WORKER">ASHA Field Worker</option>
                  <option value="DOCTOR">Medical Officer / Doctor</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20"
              >
                Save Staff Credentials
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Active Healthcare Personnel ({staffList.length})
            </h3>

            <div className="divide-y divide-slate-100">
              {staffList.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{st.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">+91 {st.phone} • {st.center}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    st.role === 'DOCTOR' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'
                  }`}>
                    {st.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}