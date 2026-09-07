import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  Download, 
  Send, 
  AlertTriangle,
  Building,
  User,
  Scale,
  Coins,
  MapPin,
  FileCheck
} from 'lucide-react';

export default function FullDetailsForm({
  entities,
  validationInsights,
  onChange,
  onRecalculate,
  onPreviewOrder,
  onDownloadDocx,
  onDispatchDro,
  isRecalculating,
  highlightedField
}) {
  const [activeTab, setActiveTab] = useState('all');

  if (!entities) return null;

  const groundingScore = validationInsights?.grounding_score ?? 0.96;
  const hallucinationScore = validationInsights?.hallucination_score ?? 0.04;
  const isHighRisk = hallucinationScore > 0.20;

  const handleFieldChange = (section, field, value) => {
    const updated = {
      ...entities,
      [section]: {
        ...entities[section],
        [field]: value
      }
    };
    onChange(updated);
  };

  const isFieldFocused = (fieldKey) => highlightedField === fieldKey;

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }}>
      {/* Header & Grounding Score Bar */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-card)',
        background: 'rgba(15, 23, 42, 0.75)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: 'var(--text-main)' }}>
              Section Officer Entity Inspection
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
              Verify auto-extracted entities against tribunal decree before state dispatch.
            </p>
          </div>

          {/* Grounding & Hallucination Score Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: isHighRisk ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: isHighRisk ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isHighRisk ? '#fb7185' : '#34d399'
            }}>
              {isHighRisk ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
              <span>Grounding: {Math.round(groundingScore * 100)}%</span>
              <span style={{ opacity: 0.6 }}>|</span>
              <span>Risk: {hallucinationScore}</span>
            </div>
          </div>
        </div>

        {/* Mandatory Review Warning If Hallucination > 0.20 */}
        {isHighRisk && (
          <div style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontSize: '0.785rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginTop: '0.5rem'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong>Mandatory Officer Review Required Before Dispatch:</strong> Hallucination risk score ({hallucinationScore}) breaches safety limit (&gt;0.20). Ensure parties and amounts are thoroughly validated.
            </div>
          </div>
        )}
      </div>

      {/* Form Body Fields (Scrollable) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {/* Section 1: Court & Case Information */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#38bdf8' }}>
            <Scale size={16} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>1. Court & Case Reference</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Issuing Court / Tribunal</label>
              <input
                type="text"
                className="form-input"
                value={entities.case_details?.court_name || ''}
                onChange={(e) => handleFieldChange('case_details', 'court_name', e.target.value)}
                style={{ borderColor: isFieldFocused('case_details.court_name') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Case Number (MCOP / EP)</label>
              <input
                type="text"
                className="form-input"
                value={entities.case_details?.case_number || ''}
                onChange={(e) => handleFieldChange('case_details', 'case_number', e.target.value)}
                style={{ borderColor: isFieldFocused('case_details.case_number') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">I.A. Number</label>
              <input
                type="text"
                className="form-input"
                value={entities.case_details?.ia_number || ''}
                onChange={(e) => handleFieldChange('case_details', 'ia_number', e.target.value)}
                style={{ borderColor: isFieldFocused('case_details.ia_number') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Order Date</label>
              <input
                type="text"
                className="form-input"
                value={entities.case_details?.court_order_date || ''}
                onChange={(e) => handleFieldChange('case_details', 'court_order_date', e.target.value)}
                style={{ borderColor: isFieldFocused('case_details.court_order_date') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Proceedings ROC Number</label>
              <input
                type="text"
                className="form-input"
                value={entities.proceedings_roc_number || ''}
                onChange={(e) => onChange({ ...entities, proceedings_roc_number: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Defaulter Information */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#10b981' }}>
            <User size={16} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>2. Defaulter / Respondent Particulars</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Defaulter Name</label>
              <input
                type="text"
                className="form-input"
                value={entities.defaulter?.name || ''}
                onChange={(e) => handleFieldChange('defaulter', 'name', e.target.value)}
                style={{ borderColor: isFieldFocused('defaulter.name') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Father / Husband Name</label>
              <input
                type="text"
                className="form-input"
                value={entities.defaulter?.father_or_husband_name || ''}
                onChange={(e) => handleFieldChange('defaulter', 'father_or_husband_name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Door No & Street</label>
              <input
                type="text"
                className="form-input"
                value={`${entities.defaulter?.door_no || ''}, ${entities.defaulter?.street_area || ''}`}
                onChange={(e) => handleFieldChange('defaulter', 'street_area', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Village / Locality</label>
              <input
                type="text"
                className="form-input"
                value={entities.defaulter?.village || ''}
                onChange={(e) => handleFieldChange('defaulter', 'village', e.target.value)}
                style={{ borderColor: isFieldFocused('defaulter.village') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Taluk</label>
              <input
                type="text"
                className="form-input"
                value={entities.defaulter?.taluk || ''}
                onChange={(e) => handleFieldChange('defaulter', 'taluk', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Pincode</label>
              <input
                type="text"
                className="form-input"
                value={entities.defaulter?.pincode || ''}
                onChange={(e) => handleFieldChange('defaulter', 'pincode', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Beneficiary Details */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#a855f7' }}>
            <Building size={16} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>3. Beneficiary & Remittance Mode</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Beneficiary / Insurer Name</label>
              <input
                type="text"
                className="form-input"
                value={entities.beneficiary?.name || ''}
                onChange={(e) => handleFieldChange('beneficiary', 'name', e.target.value)}
                style={{ borderColor: isFieldFocused('beneficiary.name') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Beneficiary Office Address</label>
              <input
                type="text"
                className="form-input"
                value={entities.beneficiary?.address || ''}
                onChange={(e) => handleFieldChange('beneficiary', 'address', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Financials & Math Validation */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#f59e0b' }}>
            <Coins size={16} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>4. Financial Award & Math Validation</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Principal Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={entities.financials?.principal_amount || 0}
                onChange={(e) => handleFieldChange('financials', 'principal_amount', parseFloat(e.target.value) || 0)}
                style={{ 
                  borderColor: isFieldFocused('financials.principal_amount') ? '#0284c7' : undefined,
                  fontWeight: 700,
                  color: '#38bdf8'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Interest Rate (% p.a.)</label>
              <input
                type="number"
                className="form-input"
                value={entities.financials?.interest_rate || 7.5}
                onChange={(e) => handleFieldChange('financials', 'interest_rate', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Amount in Words (தமிழ்)</label>
              <input
                type="text"
                className="form-input"
                value={entities.financials?.amount_in_words_tamil || ''}
                onChange={(e) => handleFieldChange('financials', 'amount_in_words_tamil', e.target.value)}
                style={{ fontFamily: 'var(--font-tamil)' }}
              />
            </div>
          </div>
        </div>

        {/* Section 5: Jurisdiction Routing */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#06b6d4' }}>
            <MapPin size={16} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>5. Revenue Jurisdiction Routing</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Revenue District</label>
              <input
                type="text"
                className="form-input"
                value={entities.jurisdiction?.district || ''}
                onChange={(e) => handleFieldChange('jurisdiction', 'district', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Taluk</label>
              <input
                type="text"
                className="form-input"
                value={entities.jurisdiction?.taluk || ''}
                onChange={(e) => handleFieldChange('jurisdiction', 'taluk', e.target.value)}
                style={{ borderColor: isFieldFocused('jurisdiction.taluk') ? '#0284c7' : undefined }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Directed Tahsildar Designation</label>
              <input
                type="text"
                className="form-input"
                value={entities.jurisdiction?.tahsildar_title || ''}
                onChange={(e) => handleFieldChange('jurisdiction', 'tahsildar_title', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div style={{
        padding: '0.85rem 1.25rem',
        borderTop: '1px solid var(--border-card)',
        background: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onRecalculate}
            disabled={isRecalculating}
            className="btn btn-outline"
            style={{ fontSize: '0.785rem', padding: '0.5rem 0.85rem' }}
          >
            <RefreshCw size={14} className={isRecalculating ? "spinner" : ""} />
            <span>Update & Re-calculate</span>
          </button>

          <button
            onClick={onPreviewOrder}
            className="btn btn-outline"
            style={{ fontSize: '0.785rem', padding: '0.5rem 0.85rem' }}
          >
            <Eye size={14} />
            <span>Preview Order Sheet</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onDownloadDocx}
            className="btn btn-outline"
            style={{ fontSize: '0.785rem', padding: '0.5rem 0.85rem' }}
          >
            <Download size={14} />
            <span>Download DOCX</span>
          </button>

          <button
            onClick={onDispatchDro}
            className="btn btn-success"
            style={{ fontSize: '0.785rem', padding: '0.5rem 1.15rem' }}
          >
            <Send size={14} />
            <span>Dispatch to DRO Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
