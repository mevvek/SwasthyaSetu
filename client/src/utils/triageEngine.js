/**
 * SwasthyaSetu Clinical Rule-Based AI Triage Engine
 * Aligned with National Health Mission (NHM) & WHO Emergency Triage Assessment Protocols
 */

export const evaluateClinicalTriage = (vitals, patientInfo = {}) => {
  const {
    systolicBP = 120,
    diastolicBP = 80,
    pulseRate = 75,
    spO2 = 98,
    temperature = 98.6,
    respiratoryRate = 18,
    symptomsText = ''
  } = vitals;

  const { age = 30, category = 'General' } = patientInfo;
  const lowerSymptoms = symptomsText.toLowerCase();

  const redFlags = [];
  const yellowFlags = [];
  const recommendations = [];

  const sys = Number(systolicBP);
  const dia = Number(diastolicBP);
  const pulse = Number(pulseRate);
  const oxygen = Number(spO2);
  const temp = Number(temperature);

  // 1. Maternal Obstetric Shock Index (Heart Rate / Systolic BP)
  if (category === 'Maternal (High Risk)') {
    const shockIndex = sys > 0 ? pulse / sys : 0;
    if (shockIndex >= 0.9) {
      redFlags.push(`Critical Shock Index (${shockIndex.toFixed(2)}) — High risk of obstetric hemorrhage/collapse`);
      recommendations.push('Immediate IV access, left-lateral tilt, and rush ambulance referral.');
    }
    if (sys >= 150 || dia >= 100) {
      redFlags.push(`Severe Gestational Hypertension (${sys}/${dia} mmHg) — Pre-eclampsia threat`);
      recommendations.push('Administer Loading Dose MgSO4 as per protocol & Doctor tele-consult.');
    }
  }

  // 2. Cardiovascular / Blood Pressure Checks
  if (sys >= 170 || dia >= 110) {
    redFlags.push(`Hypertensive Urgency (${sys}/${dia} mmHg)`);
    recommendations.push('Emergency doctor tele-consultation required within 15 minutes.');
  } else if (sys <= 85 || dia <= 50) {
    redFlags.push(`Severe Hypotension / Hemodynamic Instability (${sys}/${dia} mmHg)`);
    recommendations.push('Elevate lower extremities, initiate oral/IV hydration if conscious.');
  } else if (sys >= 140 || dia >= 90) {
    yellowFlags.push(`Stage 1 / 2 Hypertension (${sys}/${dia} mmHg)`);
    recommendations.push('Salt restriction advice, lifestyle monitoring, and doctor review.');
  }

  // 3. Oxygen Saturation (SpO2)
  if (oxygen < 92) {
    redFlags.push(`Severe Hypoxia (SpO2: ${oxygen}%)`);
    recommendations.push('Immediate supplemental Oxygen (4-6 L/min) and continuous monitoring.');
  } else if (oxygen >= 92 && oxygen <= 94) {
    yellowFlags.push(`Mild Hypoxemia (SpO2: ${oxygen}%)`);
    recommendations.push('Recheck probe placement, keep patient sitting upright, monitor RR.');
  }

  // 4. Pulse / Tachycardia & Bradycardia
  if (pulse >= 135) {
    redFlags.push(`Severe Tachycardia (${pulse} bpm)`);
  } else if (pulse <= 45) {
    redFlags.push(`Severe Bradycardia (${pulse} bpm)`);
  } else if (pulse >= 105 || pulse <= 55) {
    yellowFlags.push(`Abnormal Heart Rate (${pulse} bpm)`);
  }

  // 5. Temperature & Pediatric Checks
  if (temp >= 103) {
    redFlags.push(`Hyperpyrexia Fever (${temp}°F)`);
    recommendations.push('Tepid sponging immediately, antipyretic administration.');
  } else if (temp >= 100.4) {
    yellowFlags.push(`Fever Present (${temp}°F)`);
    recommendations.push('Maintain hydration and monitor for rash/stiff neck.');
  }

  // 6. Symptom NLP Keyword Screening (Multi-lingual keywords)
  const criticalKeywords = ['chest pain', 'seizure', 'daura', 'behosh', 'unconscious', 'khoon', 'bleeding', 'breathless', 'saans'];
  criticalKeywords.forEach(word => {
    if (lowerSymptoms.includes(word)) {
      redFlags.push(`Critical symptom keyword detected: "${word}"`);
    }
  });

  // Final Severity Triage Verdict
  let severity = 'LOW_GREEN';
  let score = 1;

  if (redFlags.length > 0) {
    severity = 'CRITICAL_RED';
    score = 3;
  } else if (yellowFlags.length > 0) {
    severity = 'MODERATE_YELLOW';
    score = 2;
  }

  if (recommendations.length === 0) {
    recommendations.push('Routine ASHA follow-up during next scheduled village round.');
  }

  return {
    severity,
    score,
    redFlags,
    yellowFlags,
    recommendations: [...new Set(recommendations)],
    timestamp: new Date().toISOString()
  };
};