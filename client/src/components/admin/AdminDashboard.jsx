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
  CheckCircle2 
} from 'lucide-react';
import axios from 'axios';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'staff' | 'inventory'

  // Staff Form State
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    role: 'ASHA_WORKER',
    phcCenter: 'PHC Kunda Hub'
  });
  const [staffSuccess, setStaffSuccess] = useState('');

  // Mock staff list
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
    setStaffSuccess(`${newStaff.name} successfully registered as ${newStaff.role}!`);
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
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overview' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Analytics Overview
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'staff' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Staff Onboarding
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'inventory' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Medicine Inventory
          </button>
        </div>
      </div>

      {/* Tab 1: Overview Analytics */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Field Intake</p>
              <p className="text-2xl font-black text-slate-900 mt-1">1,428</p>
              <span className="text-[11px] text-emerald-600 font-semibold">↑ 14% this week</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-rose-600 uppercase">Emergency Referrals</p>
              <p className="text-2xl font-black text-rose-700 mt-1">29</p>
              <span className="text-[11px] text-rose-600 font-semibold">Triaged Critical</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-indigo-600 uppercase">Active Tele-OPDs</p>
              <p className="text-2xl font-black text-indigo-900 mt-1">84</p>
              <span className="text-[11px] text-indigo-600 font-semibold">Connected Live</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-amber-600 uppercase">Low Stock Medicines</p>
              <p className="text-2xl font-black text-amber-700 mt-1">3 Alerts</p>
              <span className="text-[11px] text-amber-600 font-semibold">Replenishment Needed</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Staff Registration & Access */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Register New Health Staff
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorizes Doctor / ASHA Worker mobile number for instant portal login.
            </p>

            {staffSuccess && (
              <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="10-digit registered number"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Role</label>
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
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all"
              >
                Provision Staff Credentials
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

      {/* Tab 3: Essential Drugs & Medicine Inventory */}
      {activeTab === 'inventory' && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-indigo-600" />
            PHC Essential Drug Stock & Supply Chain
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-800">Paracetamol 500mg</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Normal</span>
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">4,500 <span className="text-xs font-normal text-slate-500">strips</span></p>
            </div>

            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-rose-900">Oxytocin 10 IU Injection</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">Low Stock</span>
              </div>
              <p className="text-xl font-black text-rose-900 mt-2">18 <span className="text-xs font-normal text-rose-600">vials (Critical)</span></p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-800">ORS Packets</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Adequate</span>
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">820 <span className="text-xs font-normal text-slate-500">units</span></p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}