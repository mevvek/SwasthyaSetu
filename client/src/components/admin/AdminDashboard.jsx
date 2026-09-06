import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchInventoryApi, replenishDrugApi, fetchPatientsApi, fetchPrescriptionsApi } from '../../utils/api';
import AmbulanceDispatchModal from '../common/AmbulanceDispatchModal';
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
  ShieldCheck, 
  Flame, 
  Baby, 
  Activity, 
  MapPin, 
  FileText, 
  Clock, 
  Radio, 
  Send, 
  AlertCircle, 
  Heart, 
  Calendar,
  ExternalLink,
  Award,
  Pill,
  Printer,
  Boxes,
  PhoneCall,
  History,
  Siren,
  Megaphone,
  ArrowRightLeft,
  Warehouse,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Volume2
} from 'lucide-react';

const formatSafeDate = (rawDate) => {
  if (!rawDate) return 'Just now';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ' • ' + d.toLocaleDateString('en-GB');
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Tab State: 'OUTBREAK' | 'ANC' | 'TELE_AUDIT' | 'REFERRALS' | 'STAFF' | 'INVENTORY'
  const [activeTab, setActiveTab] = useState('OUTBREAK');
  
  // Data States
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  
  // Action 1: Admin 108 Dispatch Override State
  const [dispatchPatientTarget, setDispatchPatientTarget] = useState(null);
  const [dispatchedOverrides, setDispatchedOverrides] = useState({});

  // Action 2: Outbreak Directive Broadcast Modal State
  const [targetDirectiveVillage, setTargetDirectiveVillage] = useState(null);
  const [directiveForm, setDirectiveForm] = useState({
    protocol: 'DENGUE_MALARIA_SCREEN',
    customNotes: 'Commence mandatory door-to-door temperature and fever triage. Distribute ORS packets.',
    priority: 'HIGH'
  });
  const [activeDirectivesMap, setActiveDirectivesMap] = useState({});

  // CMO Voice Directive Recording States
  const [directiveAudioBase64, setDirectiveAudioBase64] = useState(null);
  const [isDirectiveRecording, setIsDirectiveRecording] = useState(false);
  const [directiveAudioSeconds, setDirectiveAudioSeconds] = useState(0);
  const [isPlayingDirectiveAudio, setIsPlayingDirectiveAudio] = useState(false);

  const directiveRecorderRef = useRef(null);
  const directiveChunksRef = useRef([]);
  const directiveTimerRef = useRef(null);
  const directivePlayerRef = useRef(null);
  const directiveStreamRef = useRef(null);

  // Action 3: Staff Reassignment State
  const [editingStaffTarget, setEditingStaffTarget] = useState(null);
  const [reassignForm, setReassignForm] = useState({ center: '', status: 'ON_DUTY' });

  // Action 4: Bulk Indent Toast State
  const [bulkSanctionNotif, setBulkSanctionNotif] = useState(null);

  // Grouped Patient Audit Inspection State
  const [selectedAuditEntry, setSelectedAuditEntry] = useState(null);
  const [selectedSlipIndex, setSelectedSlipIndex] = useState(0);

  // Registered Healthcare Staff Roster
  const [staffList, setStaffList] = useState([
    { id: 'STF-01', name: 'Dr. Arvind Sharma', role: 'DOCTOR', phone: '+91 98112 23344', center: 'PHC Kunda Hub', status: 'ON_DUTY' },
    { id: 'STF-02', name: 'Dr. Neha Verma', role: 'DOCTOR', phone: '+91 98221 44556', center: 'CHC Babaganj', status: 'OFF_DUTY' },
    { id: 'STF-03', name: 'Sunita Devi', role: 'ASHA_WORKER', phone: '+91 98765 43210', center: 'Kunda Village Sector 1', status: 'FIELD_ACTIVE' },
    { id: 'STF-04', name: 'Kavita Kumari', role: 'ASHA_WORKER', phone: '+91 98980 11223', center: 'Kunda Village Sector 2', status: 'FIELD_ACTIVE' }
  ]);

  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'DOCTOR',
    phone: '',
    center: 'PHC Kunda Hub'
  });

  // Audio Recording Handlers for CMO Directive
  const startDirectiveAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      directiveStreamRef.current = stream;
      directiveChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      directiveRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          directiveChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(directiveChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setDirectiveAudioBase64(reader.result);
        };

        if (directiveStreamRef.current) {
          directiveStreamRef.current.getTracks().forEach(track => track.stop());
          directiveStreamRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsDirectiveRecording(true);
      setDirectiveAudioSeconds(0);

      directiveTimerRef.current = setInterval(() => {
        setDirectiveAudioSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone permission is required to record voice directive.');
    }
  };

  const stopDirectiveAudio = () => {
    if (directiveRecorderRef.current && isDirectiveRecording) {
      directiveRecorderRef.current.stop();
      setIsDirectiveRecording(false);
      if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
    }
    if (directiveStreamRef.current) {
      directiveStreamRef.current.getTracks().forEach(track => track.stop());
      directiveStreamRef.current = null;
    }
  };

  const deleteDirectiveAudio = () => {
    if (directivePlayerRef.current) directivePlayerRef.current.pause();
    setIsPlayingDirectiveAudio(false);
    setDirectiveAudioBase64(null);
    setDirectiveAudioSeconds(0);
    if (directiveStreamRef.current) {
      directiveStreamRef.current.getTracks().forEach(track => track.stop());
      directiveStreamRef.current = null;
    }
  };

  const togglePlayDirectiveAudio = () => {
    if (!directivePlayerRef.current) return;
    if (isPlayingDirectiveAudio) {
      directivePlayerRef.current.pause();
      setIsPlayingDirectiveAudio(false);
    } else {
      directivePlayerRef.current.play().then(() => setIsPlayingDirectiveAudio(true)).catch(() => setIsPlayingDirectiveAudio(false));
    }
  };

  useEffect(() => {
    return () => {
      if (directiveTimerRef.current) clearInterval(directiveTimerRef.current);
      if (directiveStreamRef.current) {
        directiveStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [{ data: invData }, { data: pList }, { data: rxList }] = await Promise.all([
        fetchInventoryApi().catch(() => ({ data: [] })),
        fetchPatientsApi().catch(() => ({ data: [] })),
        fetchPrescriptionsApi().catch(() => ({ data: [] }))
      ]);
      setInventory(invData || []);
      setPatients(pList || []);
      setPrescriptions(rxList || []);
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
    socket.on('prescription_dispatched', () => loadData());

    return () => {
      socket.off('inventory_updated');
      socket.off('patient_queue_updated');
      socket.off('patient_deleted');
      socket.off('prescription_dispatched');
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

  // Action 3: Handle Staff Transfer Submit
  const handleReassignSubmit = (e) => {
    e.preventDefault();
    if (!editingStaffTarget) return;

    setStaffList(prev => prev.map(s => {
      if (s.id === editingStaffTarget.id) {
        return {
          ...s,
          center: reassignForm.center,
          status: reassignForm.status
        };
      }
      return s;
    }));

    if (socket) {
      socket.emit('staff_reassigned', {
        staffId: editingStaffTarget.id,
        name: editingStaffTarget.name,
        newCenter: reassignForm.center,
        status: reassignForm.status,
        updatedBy: 'District CMO'
      });
    }

    setEditingStaffTarget(null);
  };

  // Standard Replenish Drug (+200 Units)
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

  // Action 4: Central Bulk Warehouse Indent (+1000 Units)
  const handleBulkSanction = async (drug) => {
    const drugId = drug._id || drug.id;
    try {
      await replenishDrugApi(drugId);
      const updatedStock = (drug.stock || 0) + 1000;
      const updatedDrugObj = { ...drug, stock: updatedStock, status: 'OPTIMAL' };

      setInventory(prev => prev.map(item => (item._id || item.id) === drugId ? updatedDrugObj : item));
      setBulkSanctionNotif(`District Warehouse sanctioned +1,000 units of ${drug.drugName || drug.name}`);

      if (socket) {
        socket.emit('inventory_updated', updatedDrugObj);
      }

      setTimeout(() => setBulkSanctionNotif(null), 4000);
    } catch (err) {
      console.error('Bulk sanction error:', err);
    }
  };

  // Action 1: Handle 108 Dispatch Override Confirm
  const handleConfirmAdminDispatch = (dispatchPayload) => {
    const pid = String(dispatchPayload.patientId || dispatchPatientTarget?._id || dispatchPatientTarget?.id || '').trim();
    if (pid) {
      setDispatchedOverrides(prev => ({ ...prev, [pid]: true }));
    }

    if (socket) {
      socket.emit('dispatch_emergency_ambulance', {
        ...dispatchPayload,
        dispatchedBy: 'District CMO Override'
      });
    }

    setDispatchPatientTarget(null);
  };

  // Action 2: Send Outbreak Containment Broadcast (with Voice Audio)
  const handleSendDirectiveBroadcast = (e) => {
    e.preventDefault();
    if (!targetDirectiveVillage) return;

    const payload = {
      id: `DIR_${Date.now()}`,
      village: targetDirectiveVillage.village,
      protocol: directiveForm.protocol,
      notes: directiveForm.customNotes,
      priority: directiveForm.priority,
      audioNote: directiveAudioBase64,
      issuedBy: 'Dr. Arvind Sharma (District CMO Command)',
      timestamp: new Date().toISOString()
    };

    setActiveDirectivesMap(prev => ({
      ...prev,
      [targetDirectiveVillage.village]: payload
    }));

    if (socket) {
      socket.emit('outbreak_directive_broadcast', payload);
    }

    try {
      const ch = new BroadcastChannel('swasthya_outbreak_channel');
      ch.postMessage({ type: 'OUTBREAK_DIRECTIVE_ISSUED', payload });
      ch.close();
    } catch (err) {}

    deleteDirectiveAudio();
    setTargetDirectiveVillage(null);
  };

  // Executive KPI Calculations
  const criticalCount = patients.filter(p => 
    p.severity === 'CRITICAL_RED' || p.lastTriage?.severity === 'RED'
  ).length;

  const maternalPatients = useMemo(() => {
    return patients.filter(p => Boolean(p.isPregnant) || Boolean(p.gestationalWeeks));
  }, [patients]);

  const maternalHighRiskCount = maternalPatients.length;
  const teleClearedCount = prescriptions.length;

  // Village-wise Outbreak Surveillance Analysis
  const villageOutbreakMetrics = useMemo(() => {
    const villageMap = new Map();

    patients.forEach((patient) => {
      const villageName = (patient.village || 'Field Sub-Center').trim();
      const isRed = patient.severity === 'CRITICAL_RED' || patient.lastTriage?.severity === 'RED';
      const isYellow = patient.severity === 'MODERATE_YELLOW' || patient.lastTriage?.severity === 'YELLOW';
      const notes = (patient.fieldNotes || patient.lastTriage?.notes || '').toLowerCase();

      if (!villageMap.has(villageName)) {
        villageMap.set(villageName, {
          village: villageName,
          totalCitizens: 0,
          redCases: 0,
          yellowCases: 0,
          feverFluClusters: 0,
          respiratoryClusters: 0,
          giDehydrationClusters: 0,
          maternalANC: 0
        });
      }

      const cluster = villageMap.get(villageName);
      cluster.totalCitizens += 1;
      if (isRed) cluster.redCases += 1;
      if (isYellow) cluster.yellowCases += 1;
      if (patient.isPregnant) cluster.maternalANC += 1;

      if (/fever|bukhar|pyrexia|chills|tap/i.test(notes)) cluster.feverFluClusters += 1;
      if (/cough|khansi|breath|asthma|spo2/i.test(notes)) cluster.respiratoryClusters += 1;
      if (/vomit|diarrhea|dast|dehydration|ors/i.test(notes)) cluster.giDehydrationClusters += 1;
    });

    return Array.from(villageMap.values()).map(item => {
      let riskLevel = 'STABLE';
      if (item.redCases >= 2 || (item.redCases + item.yellowCases >= 3)) {
        riskLevel = 'OUTBREAK_HIGH';
      } else if (item.redCases === 1 || item.yellowCases >= 1) {
        riskLevel = 'ELEVATED';
      }
      return { ...item, riskLevel };
    }).sort((a, b) => {
      const weight = { OUTBREAK_HIGH: 3, ELEVATED: 2, STABLE: 1 };
      return weight[b.riskLevel] - weight[a.riskLevel];
    });
  }, [patients]);

  // Maternal Trimester & Pre-eclampsia Analytics
  const maternalAnalytics = useMemo(() => {
    let trim1 = 0;
    let trim2 = 0;
    let trim3 = 0;
    let preEclampsiaAlerts = 0;
    let consultedCount = 0;

    maternalPatients.forEach((p) => {
      const weeks = Number(p.gestationalWeeks) || 12;
      if (weeks <= 12) trim1 += 1;
      else if (weeks <= 27) trim2 += 1;
      else trim3 += 1;

      const bpSys = Number(p.lastTriage?.bpSystolic) || 0;
      const bpDia = Number(p.lastTriage?.bpDiastolic) || 0;
      if (bpSys >= 140 || bpDia >= 90) {
        preEclampsiaAlerts += 1;
      }

      const pid = String(p._id || p.id || '').trim();
      const hasRx = prescriptions.some(rx => String(rx.patientId || '').trim() === pid);
      if (hasRx) consultedCount += 1;
    });

    return { trim1, trim2, trim3, preEclampsiaAlerts, consultedCount };
  }, [maternalPatients, prescriptions]);

  // Unique Citizens Grouping for Tele-OPD Audit Table
  const groupedAuditPrescriptions = useMemo(() => {
    const groupMap = new Map();

    prescriptions.forEach((rx) => {
      const key = String(rx.patientId || rx.patientName || '').trim();
      if (!key) return;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          patientKey: key,
          patientId: rx.patientId,
          patientName: rx.patientName,
          latestRx: rx,
          consultCount: 1,
          allSlips: [rx]
        });
      } else {
        const item = groupMap.get(key);
        item.consultCount += 1;
        item.allSlips.push(rx);

        const currentLatestTime = new Date(item.latestRx.updatedAt || item.latestRx.timestamp || 0).getTime();
        const thisTime = new Date(rx.updatedAt || rx.timestamp || 0).getTime();
        if (thisTime > currentLatestTime) {
          item.latestRx = rx;
        }
      }
    });

    return Array.from(groupMap.values()).map(entry => {
      entry.allSlips.sort((a, b) => new Date(b.updatedAt || b.timestamp || 0) - new Date(a.updatedAt || a.timestamp || 0));
      return entry;
    }).sort((a, b) => {
      const timeA = new Date(a.latestRx.updatedAt || a.latestRx.timestamp || 0).getTime();
      const timeB = new Date(b.latestRx.updatedAt || b.latestRx.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [prescriptions]);

  const handleOpenAuditModal = (entry) => {
    setSelectedAuditEntry(entry);
    setSelectedSlipIndex(0);
  };

  const lowStockCount = inventory.filter(d => (d.stock <= d.minThreshold) || d.status === 'LOW_STOCK').length;
  const activeInspectionSlip = selectedAuditEntry ? selectedAuditEntry.allSlips[selectedSlipIndex] : null;

  // Sidebar Tabs Config
  const navTabs = [
    {
      id: 'OUTBREAK',
      label: 'Disease Outbreak Surveillance',
      badge: `${villageOutbreakMetrics.length}`,
      icon: Flame,
      activeStyle: 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
    },
    {
      id: 'ANC',
      label: 'Maternal ANC Surveillance',
      badge: `${maternalHighRiskCount}`,
      icon: Baby,
      activeStyle: 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
    },
    {
      id: 'TELE_AUDIT',
      label: 'Tele-OPD Clinical Audit Log',
      badge: `${groupedAuditPrescriptions.length}`,
      icon: FileText,
      activeStyle: 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
    },
    {
      id: 'REFERRALS',
      label: '108 FRU Emergency Dispatches',
      badge: `${criticalCount}`,
      icon: Truck,
      activeStyle: 'bg-rose-700 text-white shadow-md shadow-rose-700/30'
    },
    {
      id: 'STAFF',
      label: 'Staff Directory & Postings',
      badge: `${staffList.length}`,
      icon: Users,
      activeStyle: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
    },
    {
      id: 'INVENTORY',
      label: 'Drug Logistics & Central Indent',
      badge: lowStockCount > 0 ? `${lowStockCount} LOW` : `${inventory.length}`,
      badgeAlert: lowStockCount > 0,
      icon: PackageCheck,
      activeStyle: 'bg-slate-900 text-white shadow-md shadow-slate-900/30'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-6">
      
      {/* Bulk Indent Toast */}
      {bulkSanctionNotif && (
        <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg border border-emerald-400 flex items-center justify-between text-xs font-black animate-fadeIn">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4" />
            <span>{bulkSanctionNotif}</span>
          </div>
          <button onClick={() => setBulkSanctionNotif(null)} className="text-white hover:opacity-80 cursor-pointer">✕</button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Chief Medical Officer (CMO) Surveillance & PHC Command
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                District Medical Directorate • Real-Time Outbreak & Tele-OPD Oversight
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Tele-OPD Stream
          </span>
          <button
            onClick={() => setShowAddStaffModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Enroll Staff
          </button>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Registered Citizens</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{patients.length}</h3>
            <p className="text-[11px] text-teal-600 font-semibold mt-0.5">Cluster Population Baseline</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-rose-200 bg-rose-50/30 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Active Critical Triage</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{criticalCount}</h3>
            <p className="text-[11px] text-rose-500 font-semibold mt-0.5">Requiring FRU Escalation</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-pink-200 bg-pink-50/30 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-pink-600 uppercase tracking-wider block">High-Risk Maternal (ANC)</span>
            <h3 className="text-2xl font-black text-pink-700 mt-1">{maternalHighRiskCount}</h3>
            <p className="text-[11px] text-pink-600 font-semibold mt-0.5">{maternalAnalytics.preEclampsiaAlerts} Pre-eclampsia Flagged</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold">
            <Baby className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tele-OPD Consults Cleared</span>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{teleClearedCount}</h3>
            <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">Across {groupedAuditPrescriptions.length} Citizens</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FIXED SIDEBAR + FULL WIDTH MAIN PANEL */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT VERTICAL NAVIGATION PANEL (Fixed 280px width) */}
        <div className="w-full lg:w-72 shrink-0 bg-white rounded-3xl border border-slate-200 p-3 shadow-xs space-y-1.5 lg:sticky lg:top-6">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Navigation
            </span>
            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              6 Modules
            </span>
          </div>

          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3.5 py-3 rounded-2xl text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
                  isActive
                    ? tab.activeStyle
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                    {tab.label}
                  </span>
                </div>

                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : tab.badgeAlert
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* RIGHT EXPANDED CONTENT PANEL (Scrolls naturally when data grows) */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* TAB 1: DISEASE OUTBREAK SURVEILLANCE */}
          {activeTab === 'OUTBREAK' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-600" />
                    Cluster Disease Outbreak & Early-Warning Surveillance
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Algorithmically grouped triage symptoms across rural field sub-centers
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  Auto-refreshed with incoming ASHA triage
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {villageOutbreakMetrics.map((cluster) => {
                  const isOutbreak = cluster.riskLevel === 'OUTBREAK_HIGH';
                  const isElevated = cluster.riskLevel === 'ELEVATED';
                  const issuedDirective = activeDirectivesMap[cluster.village];

                  return (
                    <div
                      key={cluster.village}
                      className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                        isOutbreak
                          ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-300'
                          : isElevated
                          ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-4 h-4 ${isOutbreak ? 'text-rose-600' : isElevated ? 'text-amber-600' : 'text-slate-400'}`} />
                            <h4 className="font-black text-sm text-slate-900">{cluster.village}</h4>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isOutbreak
                              ? 'bg-rose-200 text-rose-900 animate-pulse'
                              : isElevated
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isOutbreak ? '🔴 Outbreak Spike' : isElevated ? '🟡 Elevated Cluster' : '🟢 Baseline Stable'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono">
                          <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[9px] text-slate-400 uppercase block">Citizens</span>
                            <strong className="text-xs text-slate-900">{cluster.totalCitizens}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-rose-200 shadow-2xs">
                            <span className="text-[9px] text-rose-500 uppercase block">Critical</span>
                            <strong className="text-xs text-rose-700">{cluster.redCases}</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-pink-200 shadow-2xs">
                            <span className="text-[9px] text-pink-500 uppercase block">ANC</span>
                            <strong className="text-xs text-pink-700">{cluster.maternalANC}</strong>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1 text-xs text-slate-600">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Symptom Signatures:</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {cluster.feverFluClusters > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                                🌡️ Fever/Flu ({cluster.feverFluClusters})
                              </span>
                            )}
                            {cluster.respiratoryClusters > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-bold">
                                🫁 Resp/Cough ({cluster.respiratoryClusters})
                              </span>
                            )}
                            {cluster.giDehydrationClusters > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] font-bold">
                                💧 Dehydration ({cluster.giDehydrationClusters})
                              </span>
                            )}
                            {cluster.feverFluClusters === 0 && cluster.respiratoryClusters === 0 && cluster.giDehydrationClusters === 0 && (
                              <span className="text-[10px] text-slate-400 italic">No acute epidemic clusters</span>
                            )}
                          </div>
                        </div>

                        {issuedDirective && (
                          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-[10px] text-emerald-950 space-y-1">
                            <div className="flex items-center gap-1 font-black text-emerald-800 uppercase">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>CMO Directive Active in Field</span>
                            </div>
                            <p className="line-clamp-1 italic">"{issuedDirective.notes}"</p>
                            {issuedDirective.audioNote && (
                              <span className="text-[9px] font-bold text-teal-700 flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> Voice Order Attached
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono font-medium">Sector Hub</span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDirectiveVillage(cluster);
                            deleteDirectiveAudio();
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                            isOutbreak 
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30' 
                              : isElevated 
                              ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>Issue ASHA Screening Directive</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MATERNAL ANC SURVEILLANCE */}
          {activeTab === 'ANC' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-pink-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">1st Trimester (≤12w)</span>
                  <p className="text-xl font-black text-pink-600 mt-0.5">{maternalAnalytics.trim1}</p>
                  <span className="text-[10px] text-slate-500 font-medium">Early Prophylaxis</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-pink-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">2nd Trimester (13–27w)</span>
                  <p className="text-xl font-black text-pink-700 mt-0.5">{maternalAnalytics.trim2}</p>
                  <span className="text-[10px] text-slate-500 font-medium">Anemia Screen</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-pink-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">3rd Trimester (≥28w)</span>
                  <p className="text-xl font-black text-pink-900 mt-0.5">{maternalAnalytics.trim3}</p>
                  <span className="text-[10px] text-slate-500 font-medium">Delivery Plan</span>
                </div>

                <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Pre-Eclampsia Risk
                  </span>
                  <p className="text-xl font-black text-rose-700 mt-0.5">{maternalAnalytics.preEclampsiaAlerts}</p>
                  <span className="text-[10px] text-rose-600 font-bold">BP ≥ 140/90 Flagged</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Baby className="w-4 h-4 text-pink-600" />
                      Antenatal Care (ANC) High-Risk Register
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real-time clinical monitoring of pregnant citizens across PHC cluster
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    {maternalAnalytics.consultedCount} of {maternalHighRiskCount} Prescribed by Doctor
                  </span>
                </div>

                {maternalPatients.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No active antenatal cases registered in the cluster.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4">Citizen Name</th>
                          <th className="py-3 px-4">Age / Village</th>
                          <th className="py-3 px-4">Gestational Age</th>
                          <th className="py-3 px-4">Latest BP / Vitals</th>
                          <th className="py-3 px-4">Risk Status</th>
                          <th className="py-3 px-4 text-right">Tele-OPD Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {maternalPatients.map((p) => {
                          const pid = String(p._id || p.id || '').trim();
                          const weeks = Number(p.gestationalWeeks) || 12;
                          const progressPct = Math.min(100, Math.round((weeks / 40) * 100));
                          const bpSys = Number(p.lastTriage?.bpSystolic) || 0;
                          const bpDia = Number(p.lastTriage?.bpDiastolic) || 0;
                          const isPreEclampsia = bpSys >= 140 || bpDia >= 90;
                          const isConsulted = prescriptions.some(rx => String(rx.patientId || '').trim() === pid);

                          return (
                            <tr key={pid} className="hover:bg-slate-50/70 transition-all">
                              <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[10px] font-black">
                                  {p.name?.slice(0, 1)}
                                </span>
                                <span>{p.name}</span>
                              </td>

                              <td className="py-3.5 px-4 text-slate-500">
                                {p.age}y • {p.village || 'Field Hub'}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <span className="font-bold text-slate-800 text-[11px] block">
                                    {weeks} Weeks (Trimester {weeks <= 12 ? '1' : weeks <= 27 ? '2' : '3'})
                                  </span>
                                  <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-pink-500 rounded-full" 
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono font-bold">
                                {bpSys > 0 && bpDia > 0 ? (
                                  <span className={isPreEclampsia ? 'text-rose-600' : 'text-slate-700'}>
                                    {bpSys}/{bpDia} mmHg
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Pending Triage</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {isPreEclampsia ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300 animate-pulse">
                                    ⚠️ Pre-eclampsia Flag
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-bold border border-pink-200">
                                    Routine ANC Care
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                {isConsulted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Prescribed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" /> In Tele-OPD Queue
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TELE-OPD CLINICAL AUDIT LOG */}
          {activeTab === 'TELE_AUDIT' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    Tele-OPD Electronic Prescription (Rx) Compliance Log
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grouped by unique citizens with multiple visits under single consolidated patient profile
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-xl border border-teal-200">
                    {groupedAuditPrescriptions.length} Unique Citizens
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                    {prescriptions.length} Total Encounters Signed
                  </span>
                </div>
              </div>

              {groupedAuditPrescriptions.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No digital prescriptions dispatched yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Latest Encounter</th>
                        <th className="py-3 px-4">Citizen Name</th>
                        <th className="py-3 px-4">Consulting MO</th>
                        <th className="py-3 px-4">Latest Clinical Diagnosis</th>
                        <th className="py-3 px-4">Latest Vitals</th>
                        <th className="py-3 px-4 text-right">Inspect All Slips</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {groupedAuditPrescriptions.map((entry) => {
                        const rx = entry.latestRx;

                        return (
                          <tr key={entry.patientKey} className="hover:bg-slate-50/70 transition-all">
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 font-bold">
                              {formatSafeDate(rx.updatedAt || rx.timestamp)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-slate-900 text-xs">{entry.patientName}</span>
                                <span className="text-[9px] font-extrabold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-md">
                                  {entry.consultCount} {entry.consultCount === 1 ? 'Consult' : 'Consults'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-slate-800 font-bold block">{rx.doctorName || 'Dr. Arvind Sharma (MO)'}</span>
                              <span className="text-[10px] font-mono text-slate-400">{rx.doctorRegNo || 'UP-MCI-84920'}</span>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <span className="font-semibold text-slate-800 block truncate">
                                {rx.diagnosis || 'Clinical Diagnosis on File'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              BP: {rx.vitalsAtConsult?.bp || '120/80'} • SpO2: {rx.vitalsAtConsult?.spo2 || '98'}%
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenAuditModal(entry)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-[11px] font-black transition-all cursor-pointer active:scale-95"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Audit Slips ({entry.consultCount})</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 108 FRU EMERGENCY REFERRALS */}
          {activeTab === 'REFERRALS' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Truck className="w-4 h-4 text-rose-600" />
                    108 First Referral Unit (FRU) Emergency Dispatch Tracker
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hospital emergency transfers with direct Administrative Overrides
                  </p>
                </div>
                <span className="text-xs font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                  {criticalCount} Critical Cases Requiring Attention
                </span>
              </div>

              {criticalCount === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-medium">
                  No active 108 FRU emergency dispatches recorded at this hour.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patients.filter(p => p.severity === 'CRITICAL_RED' || p.lastTriage?.severity === 'RED').map((p) => {
                    const pid = String(p._id || p.id || '').trim();
                    const isOverridden = dispatchedOverrides[pid];

                    return (
                      <div 
                        key={pid} 
                        className="p-5 rounded-3xl border-2 border-rose-200 bg-rose-50/40 flex flex-col justify-between space-y-4 shadow-2xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                              <p className="text-xs text-slate-500">{p.age}y, {p.gender} • Sector: <strong>{p.village || 'Field Sub-Center'}</strong></p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider animate-pulse">
                              Critical Red Alert
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-2xl border border-rose-100 grid grid-cols-3 gap-2 text-center font-mono">
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase">Blood Pressure</span>
                              <strong className="text-xs text-rose-700">
                                {p.lastTriage?.bpSystolic ? `${p.lastTriage.bpSystolic}/${p.lastTriage.bpDiastolic}` : 'Elevated'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase">Oxygen SpO2</span>
                              <strong className="text-xs text-rose-700">
                                {p.lastTriage?.spo2 || 'Critical'}%
                              </strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase">Pulse</span>
                              <strong className="text-xs text-slate-800">
                                {p.lastTriage?.pulse || '72'} bpm
                              </strong>
                            </div>
                          </div>

                          {p.fieldNotes && (
                            <p className="text-xs text-rose-900 italic bg-rose-100/60 p-2 rounded-xl border border-rose-200">
                              "{p.fieldNotes}"
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs">
                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                            Facility: <strong>District Hospital Pratapgarh</strong>
                          </span>
                          
                          {isOverridden ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 108 Dispatched by CMO
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDispatchPatientTarget(p)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                              <Siren className="w-3.5 h-3.5 animate-bounce" />
                              <span>Override & Dispatch 108</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: STAFF DIRECTORY & REASSIGNMENT */}
          {activeTab === 'STAFF' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Healthcare Personnel & Duty Roster
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authorised medical staff deployed across PHC cluster</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    {staffList.filter(s => s.role === 'DOCTOR').length} Medical Officers
                  </span>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                    {staffList.filter(s => s.role === 'ASHA_WORKER').length} ASHA Workers
                  </span>
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
                      <th className="py-3 px-4">Operational Status</th>
                      <th className="py-3 px-4 text-right">CMO Action</th>
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
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          <a href={`tel:${stf.phone}`} className="inline-flex items-center gap-1 hover:text-indigo-600">
                            <PhoneCall className="w-3 h-3 text-slate-400" />
                            <span>{stf.phone}</span>
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-950">{stf.center}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            stf.status.includes('ACTIVE') || stf.status.includes('ON')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            ● {stf.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaffTarget(stf);
                              setReassignForm({ center: stf.center, status: stf.status });
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-black cursor-pointer transition-all active:scale-95"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Reassign</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: DRUG INVENTORY & BULK INDENT */}
          {activeTab === 'INVENTORY' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-slate-800" />
                    Essential Drug Stock & Emergency Supplies
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Depletion thresholds and 1-click replenishment</p>
                </div>
                {lowStockCount > 0 && (
                  <span className="text-xs font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200 flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    {lowStockCount} Drugs Below Minimum Safe Threshold
                  </span>
                )}
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
                      <th className="py-3 px-4 text-right">CMO Bulk Indent</th>
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
                          <td className="py-3.5 px-4 font-black text-slate-900">{drug.stock} {drug.unit || 'units'}</td>
                          <td className="py-3.5 px-4 text-slate-500">{drug.minThreshold} {drug.unit || 'units'}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isLow ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {isLow ? 'CRITICAL LOW' : 'OPTIMAL'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleReplenish(drugId)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black transition-all active:scale-95 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              +200 Units
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleBulkSanction(drug)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-xs"
                            >
                              <Warehouse className="w-3.5 h-3.5" />
                              Sanction +1,000
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

        </div>
      </div>

      {/* ACTION 3 MODAL: STAFF TRANSFER */}
      {editingStaffTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Executive Staff Posting Order
                  </h3>
                  <p className="text-[10px] text-slate-500">{editingStaffTarget.name} ({editingStaffTarget.id})</p>
                </div>
              </div>
              <button onClick={() => setEditingStaffTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reassign Facility / Sub-Center</label>
                <select
                  value={reassignForm.center}
                  onChange={(e) => setReassignForm({ ...reassignForm, center: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PHC Kunda Hub">PHC Kunda Hub (Central)</option>
                  <option value="CHC Babaganj">CHC Babaganj (Emergency)</option>
                  <option value="Kunda Village Sector 1">Kunda Village Sector 1 Sub-Center</option>
                  <option value="Kunda Village Sector 2">Kunda Village Sector 2 Sub-Center</option>
                  <option value="Rampur Mobile Relief Unit">Rampur Mobile Relief Unit</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Duty Status</label>
                <select
                  value={reassignForm.status}
                  onChange={(e) => setReassignForm({ ...reassignForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ON_DUTY">ON DUTY (Active Duty)</option>
                  <option value="FIELD_ACTIVE">FIELD ACTIVE (Outreach Sweep)</option>
                  <option value="OFF_DUTY">OFF DUTY (Rotational Leave)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaffTarget(null)}
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
                >
                  Confirm Posting Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION 2 MODAL: DIRECTIVE ISSUANCE WITH AUDIO */}
      {targetDirectiveVillage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Issue CMO Outbreak Directive
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Target Sector: <strong className="text-rose-700">{targetDirectiveVillage.village}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  deleteDirectiveAudio();
                  setTargetDirectiveVillage(null);
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendDirectiveBroadcast} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Screening Protocol</label>
                <select
                  value={directiveForm.protocol}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, protocol: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="DENGUE_MALARIA_SCREEN">Dengue / Acute Febrile Surveillance (Rapid RDT & Vitals)</option>
                  <option value="DIARRHEA_CONTAINMENT">Acute Diarrhea / Dehydration Containment (ORS + Zinc)</option>
                  <option value="ANC_HYPERTENSION_DRIVE">ANC High-Risk BP & Maternal Screening Drive</option>
                  <option value="RESPIRATORY_SURGE">Respiratory Infection & Pulse-Oximetry Sweep</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectiveForm({ ...directiveForm, priority: 'HIGH' })}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      directiveForm.priority === 'HIGH' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    🚨 Code Red Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectiveForm({ ...directiveForm, priority: 'ELEVATED' })}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      directiveForm.priority === 'ELEVATED' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    ⚠️ Code Amber Sweep
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mandatory Instructions for ASHA Field Unit</label>
                <textarea
                  rows={3}
                  required
                  value={directiveForm.customNotes}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, customNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* VOICE RECORDING */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-rose-600" />
                    CMO Audio Dispatch Directive
                  </span>

                  {!directiveAudioBase64 && (
                    <button
                      type="button"
                      onClick={isDirectiveRecording ? stopDirectiveAudio : startDirectiveAudio}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                        isDirectiveRecording
                          ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {isDirectiveRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
                      <span>
                        {isDirectiveRecording ? `Stop (${directiveAudioSeconds}s)` : 'Record Voice Order'}
                      </span>
                    </button>
                  )}
                </div>

                {directiveAudioBase64 && (
                  <div className="p-2.5 bg-white border border-rose-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={togglePlayDirectiveAudio}
                        className="w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      >
                        {isPlayingDirectiveAudio ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                          <span>Voice Directive Ready</span>
                          <span className="text-[9px] text-rose-600 font-extrabold bg-rose-50 px-1 rounded">Attached</span>
                        </p>
                        <p className="text-[9px] text-slate-500">Will stream to frontline tablets with alert</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={deleteDirectiveAudio}
                      className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg text-xs cursor-pointer transition-all"
                      title="Delete & Re-record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <audio
                      ref={directivePlayerRef}
                      src={directiveAudioBase64}
                      onEnded={() => setIsPlayingDirectiveAudio(false)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[10px] text-rose-800 leading-snug">
                <strong>Administrative Broadcast:</strong> This order will instantly ring and show on the frontline tablets of all ASHAs assigned to <strong>{targetDirectiveVillage.village}</strong>.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    deleteDirectiveAudio();
                    setTargetDirectiveVillage(null);
                  }}
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Broadcast Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION 1 MODAL: CMO 108 FRU OVERRIDE */}
      {dispatchPatientTarget && (
        <AmbulanceDispatchModal
          patient={dispatchPatientTarget}
          onClose={() => setDispatchPatientTarget(null)}
          onConfirmDispatch={handleConfirmAdminDispatch}
        />
      )}

      {/* MODAL: MULTI-SLIP CITIZEN AUDIT INSPECTION */}
      {selectedAuditEntry && activeInspectionSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">
                    Official ABDM E-Prescription Audit Log
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Patient: <strong className="text-white">{selectedAuditEntry.patientName}</strong> • {selectedAuditEntry.consultCount} Consultations Recorded
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAuditEntry(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedAuditEntry.allSlips.length > 1 && (
              <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-teal-600" />
                  Visits ({selectedAuditEntry.allSlips.length}):
                </span>
                {selectedAuditEntry.allSlips.map((slip, idx) => {
                  const isSelected = selectedSlipIndex === idx;
                  const dateStr = formatSafeDate(slip.updatedAt || slip.timestamp).split('•')[0].trim();
                  return (
                    <button
                      key={slip._id || idx}
                      type="button"
                      onClick={() => setSelectedSlipIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      <span>#{selectedAuditEntry.allSlips.length - idx}</span>
                      <span className="text-[10px] opacity-80 font-normal">({dateStr})</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                <div>
                  <h4 className="text-base font-black text-slate-900">{selectedAuditEntry.patientName}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Attending Medical Officer: <strong>{activeInspectionSlip.doctorName || 'Dr. Arvind Sharma (MO)'}</strong>
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">
                  {formatSafeDate(activeInspectionSlip.updatedAt || activeInspectionSlip.timestamp)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clinical Diagnosis</span>
                <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-900">
                  {activeInspectionSlip.diagnosis || 'Clinical Diagnosis on File'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prescribed Medicines</span>
                <p className="p-3 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 whitespace-pre-line leading-relaxed shadow-2xs">
                  {activeInspectionSlip.medicines || 'Medicines issued'}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditEntry(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enroll Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
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
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                <input
                  type="text"
                  required
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                />
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
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
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