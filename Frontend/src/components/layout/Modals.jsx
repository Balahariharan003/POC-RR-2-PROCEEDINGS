import React from 'react';
import { X, Printer, Download, CheckCircle2, Copy, Send, FileCheck } from 'lucide-react';

/**
 * Official Tamil Proceedings Sheet Preview Modal
 */
export function ProceedingsPreviewModal({ isOpen, onClose, entities, onDownloadDocx }) {
  if (!isOpen || !entities) return null;

  const d = entities.defaulter || {};
  const f = entities.financials || {};
  const j = entities.jurisdiction || {};
  const c = entities.case_details || {};
  const b = entities.beneficiary || {};
  const acts = entities.legal_acts || {};

  const defNameWithFather = d.father_or_husband_name ? `${d.name}, ${d.father_or_husband_name}` : d.name;
  const amtStr = `ரூ. ${Number(f.principal_amount || 0).toLocaleString('en-IN')}/-`;
  const amtWords = f.amount_in_words_tamil || "";

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(16, 44, 87, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        color: '#102C57',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        overflow: 'hidden'
      }}>
        {/* Modal Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          background: '#102C57',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileCheck size={20} color="#DAC0A3" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              செயல்முறை ஆணை மாதிரிப் பார்வை (Draft Proceedings Preview)
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onDownloadDocx && (
              <button 
                onClick={onDownloadDocx}
                className="btn btn-primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.785rem' }}
              >
                <Download size={14} />
                Download DOCX
              </button>
            )}
            <button 
              onClick={() => window.print()}
              className="btn btn-outline"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.785rem', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <Printer size={14} />
              Print
            </button>
            <button 
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '0.4rem', color: '#102C57' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Official Tamil Proceedings Document Sheet */}
        <div style={{
          overflowY: 'auto',
          padding: '2.5rem',
          fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
          lineHeight: '1.8',
          fontSize: '0.92rem',
          color: '#102C57'
        }}>
          {/* Header Title */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#102C57' }}>
              {j.district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
            </h2>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              முன்னிலை: {j.collector_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#102C57' }}>
              {j.collector_designation}
            </div>
          </div>

          {/* Reference & Date Table */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '2px solid #DAC0A3',
            paddingBottom: '0.75rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            fontSize: '0.88rem'
          }}>
            <div>ROC / ந.க. எண்: {entities.proceedings_roc_number || "ந.க.9666/2026/ஈ2"}</div>
            <div>நாள்: {entities.proceedings_date || "05.09.2026"}</div>
          </div>

          {/* Subject (பொருள்) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ margin: 0, textAlign: 'justify' }}>
              <strong>பொருள்:</strong> வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகனச் சட்டம் 1988 – {j.district} மாவட்டம் – {j.taluk} வட்டம் - {defNameWithFather}, கதவு எண்.{d.door_no || ''}, {d.street_area || ''}, {d.village || ''}, {j.district} - {acts.primary_act || 'மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174'} - {c.court_name} - {c.ia_number ? `${c.ia_number} -ன் ` : ''}{c.case_number} -இன் படி இழப்பீட்டுத் தொகை {amtStr} ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது - ஆணை பிறப்பித்தல்.
            </p>
          </div>

          {/* Reference (பார்வை) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ margin: 0 }}>
              <strong>பார்வை:</strong> {c.court_name}, {c.case_number}, உத்தரவு நாள்: {c.court_order_date || ''}.
            </p>
          </div>

          {/* Paragraphs */}
          <div style={{ textAlign: 'justify', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p>
              பார்வையில் காணும் தீர்ப்பாயத்தின் உத்தரவின்படி, {j.district} மாவட்டம், {j.taluk} வட்டம், {d.village || ''}, {d.street_area || ''}, கதவு எண்.{d.door_no || ''} என்ற முகவரியில் வசித்து வரும் {defNameWithFather} என்பவரிடமிருந்து {c.case_number} வழக்கில் இழப்பீட்டுத் தொகை {amtStr} ஐ வசூல் செய்து ஒப்படைக்க கோரப்பட்டுள்ளது.
            </p>

            <p>
              எனவே, மேற்படி {defNameWithFather} என்பவரிடமிருந்து தொகை {amtStr} ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் {acts.recovery_act || 'தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5'}-ன் கீழ் வசூல் செய்ய {j.taluk} வருவாய் வட்டாட்சியருக்கு முழு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.
            </p>

            <p>
              மேற்படி பாக்கிதாரரின் அசையும் மற்றும் அசையா சொத்துக்களை சட்டப்படி ஜப்தி செய்து, ஏலம் விட்டு, {amtStr} ({amtWords}) தொகையினை “{b.name}“ என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து {b.address || ''} என்ற முகவரிக்கு அனுப்பி வைக்குமாறும், அதன் விவரத்தினை இவ்வலுவலகத்திற்கும் நீதிமன்றத்திற்கும் உடனடியாக சமர்ப்பிக்குமாறும் {j.taluk} வருவாய் வட்டாட்சியர் பணிக்கப்படுகிறார்.
            </p>
          </div>

          {/* Signature Section */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#102C57' }}>[டிஜிட்டல் கையொப்பம் / Seal]</span>
              </div>
              <div style={{ fontWeight: 700 }}>மாவட்ட ஆட்சித் தலைவர்</div>
              <div style={{ fontSize: '0.85rem' }}>{j.district} மாவட்டம்</div>
            </div>
          </div>

          {/* Distribution Copy (நகல்) */}
          <div style={{ marginTop: '2rem', borderTop: '1px dashed #DAC0A3', paddingTop: '1rem', fontSize: '0.82rem' }}>
            <strong>பெறுநர் / நகல்:</strong>
            <ol style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', lineHeight: '1.6' }}>
              <li>வருவாய் வட்டாட்சியர், {j.taluk} வட்டம் (தக்க நடவடிக்கைக்காக).</li>
              <li>வருவாய் கோட்டாட்சியர், {j.district} (தகவலுக்காக).</li>
              <li>{b.name}, {b.address || ''} (மனுதாரர் / காப்பீட்டு நிறுவனம்).</li>
              <li>{defNameWithFather}, கதவு எண்.{d.door_no || ''}, {d.street_area || ''}, {d.village || ''}, {d.taluk} வட்டம் - 638 109 (பாக்கிதாரர்).</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DRO Grievance State Portal Dispatch Confirmation Modal
 */
export function DroReceiptModal({ isOpen, onClose, receiptData }) {
  if (!isOpen || !receiptData) return null;

  const copyReceipt = () => {
    navigator.clipboard.writeText(receiptData.receipt);
    alert("Receipt reference copied to clipboard!");
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(16, 44, 87, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(16, 44, 87, 0.3)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(16, 44, 87, 0.15)',
          border: '1px solid rgba(16, 44, 87, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto'
        }}>
          <CheckCircle2 size={36} color="#102C57" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#FEFAF6' }}>
          Dispatched to DRO Grievance Portal
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0' }}>
          Revenue Recovery proceeding has been authenticated and transmitted to the District Revenue Officer queue.
        </p>

        {/* Receipt Box */}
        <div style={{
          background: 'rgba(16, 44, 87, 0.8)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          border: '1px solid var(--border-card)',
          marginBottom: '1.5rem',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Official Transaction Receipt
            </span>
            <button 
              onClick={copyReceipt}
              className="btn btn-ghost" 
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', gap: '0.25rem' }}
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <div style={{
            fontSize: '1rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#DAC0A3',
            marginBottom: '0.75rem'
          }}>
            {receiptData.receipt}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.785rem', color: 'var(--text-muted)' }}>
            <div><strong>Case Ref:</strong> {receiptData.auditEntry?.caseNumber}</div>
            <div><strong>Target Taluk:</strong> {receiptData.auditEntry?.taluk} ({receiptData.auditEntry?.district})</div>
            <div><strong>Amount Awarded:</strong> {receiptData.auditEntry?.amount}</div>
            <div><strong>Timestamp:</strong> {receiptData.auditEntry?.timestamp}</div>
            <div><strong>Section Officer:</strong> {receiptData.auditEntry?.officerName}</div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem' }}
        >
          Return to Workspace
        </button>
      </div>
    </div>
  );
}
