import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchInventoryApi, replenishDrugApi, fetchPatientsApi } from '../../utils/api';
import { 
  Building2, 
  PackageCheck, 
  AlertTriangle, 
  Plus, 
  Users, 
  CheckCircle2, 
  UserPlus, 
  Stethoscope, 
  Truck, 
  X,
  Phone,
  ShieldCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Tab State
  const [activeTab, setActiveTab] = useState('STAFF'); // 'STAFF', 'INVENTORY', 'REFERRALS'
  
  // Data States
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  // Registered Healthcare Staff Roster (Day 4 Feature)
  const [staffList, setStaffList] = useState([
    { id: 'STF-01', name: 'Dr. Arvind Sharma', role: 'DOCTOR', phone: '+91 98112 23344', center: 'PHC Kunda Hub', status: 'ON_DUTY' },
    { id: 'STF-02', name: 'Dr. Neha Verma', role: 'DOCTOR', phone: '+91 98221 44556', center: 'CHC Babaganj', status: 'OFF_DUTY' },
    { id: 'STF-03', name: 'Sunita Devi', role: 'ASHA_WORKER', phone: '+91 98765 43210', center: 'Kunda Village Sector 1', status: 'FIELD_ACTIVE' },
    { id: 'STF-04', name: 'Kavita Kumari', role: 'ASHA_WORKER', phone: '+91 98980 11223', center: 'Kunda Village Sector 2', status: 'FIELD_ACTIVE' }
  ]);

  // Form State for Adding Staff
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'DOCTOR',
    phone: '',
    center: 'PHC Kunda Hub'
  });

  const loadData = async () => {
    try {
      const [{ data: invData }, { data: pList }] = await Promise.all([
        fetchInventoryApi(),
        fetchPatientsApi()
      ]);
      setInventory(invData || []);
      setPatients(pList || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    socket.on('inventory_updated', (updatedDrug) => {
      setInventory((prev) => 
        prev.map(item => ((item._id || item.id) === (updatedDrug._id || updatedDrug.id) ? updatedDrug : item))
      );
    });
    socket.on('patient_queue_updated', () => loadData());
    socket.on('patient_deleted', () => loadData());

    return () => {
      socket.off('inventory_updated');
      socket.off('patient_queue_updated');
      socket.off('patient_deleted');
    };
  }, [socket]);

  // Handle Staff Addition
  const handleAddStaffSubmit = (e) => {
    e.preventDefault();
    const created = {
      id: `STF-0${staffList.length + 1}`,
      name: newStaff.name,
      role: newStaff.role,
      phone: newStaff.phone,
      center: newStaff.center,
      status: newStaff.role === 'DOCTOR' ? 'ON_DUTY' : 'FIELD_ACTIVE'
    };
    setStaffList([created, ...staffList]);
    setNewStaff({ name: '', role: 'DOCTOR', phone: '', center: 'PHC Kunda Hub' });
    setShowAddStaffModal(false);
  };

  // Replenish Drug
  const handleReplenish = async (id) => {
    try {
      const { data } = await replenishDrugApi(id);
      setInventory((prev) => 
        prev.map(item => ((item._id || item.id) === id ? data : item))
      );
    } catch (err) {
      console.error('Replenishment failed:', err);
    }
  };

  const criticalCount = patients.filter(p => p.severity === 'CRITICAL_RED').length;
  const activeDoctors = staffList.filter(s => s.role === 'DOCTOR' && s.status === 'ON_DUTY').length;
  const activeAshas = staffList.filter(s => s.role === 'ASHA_WORKER').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            PHC Administration & CMO Surveillance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            District Medical Directorate • Primary Health Center Cluster Hub
          </p>
        </div>

        {/* Action Button: Add Healthcare Staff */}
        <button
          onClick={() => setShowAddStaffModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Enroll Medical Officer / ASHA
        </button>
      </div>

      {/* Realistic Healthcare KPIs (No technical database jargon) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registered Citizens</span>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{patients.length}</h3>
          <p className="text-[11px] text-teal-600 font-semibold mt-0.5">Cluster Population Baseline</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Critical Triage</span>
          <h3 className="text-2xl font-black text-rose-600 mt-1">{criticalCount}</h3>
          <p className="text-[11px] text-rose-500 font-semibold mt-0.5">Requiring Hospital Referral</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">On-Duty Doctors</span>
          <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeDoctors}</h3>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Tele-OPD Available</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active ASHA Network</span>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">{activeAshas}</h3>
          <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">Covering Cluster Sectors</p>
        </div>
      </div>

      {/* Admin Module Tabs (Staff, Inventory, Referral Cases) */}
      <div className="flex items-center gap-2 mt-8 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('STAFF')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'STAFF'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'INVENTORY'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Drug Logistics & Stock ({inventory.length})
        </button>

        <button
          onClick={() => setActiveTab('REFERRALS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'REFERRALS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          Critical Referrals ({criticalCount})
        </button>
      </div>

      {/* Tab 1: Staff Directory */}
      {activeTab === 'STAFF' && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Healthcare Personnel & Duty Roster
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Authorised medical staff deployed across PHC cluster</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Assigned PHC / Village Hub</th>
                  <th className="py-3 px-4 text-right">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {staffList.map((stf) => (
                  <tr key={stf.id} className="hover:bg-slate-50/70 transition-all">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{stf.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{stf.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        stf.role === 'DOCTOR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {stf.role === 'DOCTOR' ? <Stethoscope className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {stf.role === 'DOCTOR' ? 'Medical Officer' : 'ASHA Field Worker'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{stf.phone}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{stf.center}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ● {stf.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Drug Inventory */}
      {activeTab === 'INVENTORY' && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Essential Drug Stock & Emergency Supplies
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Depletion thresholds and 1-click replenishment</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Drug Formulation</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Available Units</th>
                  <th className="py-3 px-4">Threshold</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Emergency Refill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {inventory.map((drug) => {
                  const drugId = drug._id || drug.id;
                  const isLow = drug.stock <= drug.minThreshold || drug.status === 'LOW_STOCK';
                  const displayName = drug.drugName || drug.name || 'Essential Medicine';
                  const displayBatch = drug.batchNumber || drug.batch || 'MED-BATCH-01';

                  return (
                    <tr key={drugId} className="hover:bg-slate-50/70 transition-all">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{displayName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{displayBatch}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{drug.stock} {drug.unit || 'units'}</td>
                      <td className="py-3.5 px-4 text-slate-500">{drug.minThreshold} {drug.unit || 'units'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isLow ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {isLow ? 'CRITICAL LOW' : 'OPTIMAL'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleReplenish(drugId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          +200 Units
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Critical Referrals Overview */}
      {activeTab === 'REFERRALS' && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              District Tele-OPD Escalation Tracker
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">High-risk cases prioritized for First Referral Unit (FRU)</p>
          </div>

          {criticalCount === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              No active critical referrals at this hour.
            </div>
          ) : (
            <div className="space-y-3">
              {patients.filter(p => p.severity === 'CRITICAL_RED').map((p) => (
                <div key={p._id || p.id} className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.name} ({p.age}y, {p.gender})</h4>
                    <p className="text-slate-500 mt-0.5">Cluster: {p.village} • Category: {p.category}</p>
                    <p className="font-mono text-rose-700 font-bold mt-1">Vitals: BP {p.lastVitals?.bp || 'High'} • SpO2: {p.lastVitals?.spO2}%</p>
                  </div>
                  <span className="self-start sm:self-center px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
                    Emergency Tele-Referral Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Enroll New Healthcare Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Enroll Healthcare Staff
                </h3>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Staff Name</label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="e.g. Dr. Priya Patel or Anita Devi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Operational Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium bg-white"
                >
                  <option value="DOCTOR">Medical Officer (Doctor)</option>
                  <option value="ASHA_WORKER">ASHA Field Worker</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Facility / Sector Hub</label>
                <input
                  type="text"
                  required
                  value={newStaff.center}
                  onChange={(e) => setNewStaff({ ...newStaff, center: e.target.value })}
                  placeholder="e.g. PHC Kunda Hub or Village Sector 3"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}