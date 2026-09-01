import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchInventoryApi, replenishDrugApi, fetchPatientsApi } from '../../utils/api';
import { 
  Building2, 
  Pill, 
  UserCheck, 
  PlusCircle, 
  CheckCircle2, 
  MapPin, 
  RefreshCw 
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [drugs, setDrugs] = useState([]);
  const [patientsCount, setPatientsCount] = useState(0);
  const [replenishSuccess, setReplenishSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Village Cluster Outbreak Data
  const [villageClusters] = useState([
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

  const loadAdminData = async () => {
    try {
      const [{ data: inv }, { data: pList }] = await Promise.all([
        fetchInventoryApi(),
        fetchPatientsApi()
      ]);
      setDrugs(inv || []);
      setPatientsCount(pList.length || 0);
    } catch (err) {
      console.error('Admin data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleReplenish = async (drugId) => {
    try {
      const { data } = await replenishDrugApi(drugId);
      setDrugs(drugs.map(d => (d._id === drugId ? data : d)));
      setReplenishSuccess('Autonomous replenishment requisition updated in MongoDB Atlas!');
      setTimeout(() => setReplenishSuccess(''), 3000);
    } catch (err) {
      console.error('Replenish failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
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
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Live Database Patients</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{patientsCount}</p>
              <span className="text-[11px] text-emerald-600 font-semibold">● Synced with MongoDB Atlas</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-indigo-600 uppercase">Tracked Essential Drugs</p>
              <p className="text-2xl font-black text-indigo-900 mt-1">{drugs.length}</p>
              <span className="text-[11px] text-indigo-600 font-semibold">Buffer Inventory Active</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-rose-600 uppercase">Surveillance Clusters</p>
              <p className="text-2xl font-black text-rose-700 mt-1">{villageClusters.length}</p>
              <span className="text-[11px] text-rose-600 font-semibold">Spatial Alert Active</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'outbreak' && (
        <div className="mt-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600" />
              Village Epidemiological Cluster Surveillance
            </h3>
            <div className="space-y-3">
              {villageClusters.map((cluster) => (
                <div key={cluster.id} className="p-4 rounded-2xl border bg-rose-50/50 border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{cluster.village}</span>
                    <p className="text-xs text-slate-700 font-semibold mt-1">{cluster.condition}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{cluster.actionNeeded}</p>
                  </div>
                  <div className="text-left md:text-right shrink-0">
                    <p className="text-xl font-black text-slate-900">{cluster.cases} cases</p>
                    <span className="text-xs text-rose-600 font-bold">{cluster.trend} surge</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="mt-6 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-600" />
              PHC Essential Drug Stock (MongoDB Live)
            </h3>

            {replenishSuccess && (
              <div className="my-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {replenishSuccess}
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {drugs.map((drug) => (
                <div key={drug._id || drug.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{drug.name}</span>
                    <p className="text-xs text-slate-500">Min Buffer: {drug.minThreshold} {drug.unit}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-base font-black text-slate-900">{drug.stock} {drug.unit}</p>
                    {drug.status !== 'NORMAL' ? (
                      <button
                        onClick={() => handleReplenish(drug._id || drug.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm"
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

    </div>
  );
}