import React, { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, X, Check, FileText, Sparkles, Layers } from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import './TemplateManagement.css';

const PLACEHOLDER_TAGS = [
  '{{district_name}}',
  '{{taluk_name}}',
  '{{defaulter_name}}',
  '{{door_no}}',
  '{{street_and_locality}}',
  '{{pincode}}',
  '{{iec_no}}',
  '{{principal_amount}}',
  '{{penalty_amount}}',
  '{{total_amount}}',
  '{{amount_in_tamil_words}}',
  '{{issuing_authority_name}}',
  '{{case_file_no}}',
  '{{order_in_original_no}}',
  '{{order_date}}',
  '{{letter_date}}',
  '{{dd_favour_of}}',
  '{{head_of_account}}',
  '{{dispatch_address}}',
  '{{living_verb}}',
  '{{defaulter_suffix}}',
  '{{asset_clause}}'
];

const emptyTemplate = {
  code: '',
  name: '',
  department: 'CUSTOMS',
  category: 'PROCEEDINGS',
  description: '',
  heading_prefix: 'பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,',
  subject_template: 'வருவாய் வசூல் சட்டம் 1864 – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}} நிலுவைத் தொகை ரூ.{{total_amount}}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.',
  reference_template: '{{issuing_authority_name}}, கடித எண். {{case_file_no}}, நாள்: {{letter_date}}.',
  order_paras: ['{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண்.{{door_no}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.'],
  enclosure_text: 'கடித நகல்',
  signatory_text: 'மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.',
  recipients: [
    { label: 'பெறுநர்', value: 'வருவாய் வட்டாட்சியர், {{taluk_name}}.' },
    { label: 'நகல்', value: 'வருவாய் கோட்டாட்சியர், {{district_name}}.' }
  ],
  submission_paras: []
};

function TemplateEditorDialog({ template, setTemplate, error, onSave, onClose }) {
  const [activeField, setActiveField] = useState('subject_template');

  const insertTag = (tag) => {
    if (activeField === 'order_paras') {
      const current = Array.isArray(template.order_paras) ? template.order_paras.join('\n\n') : (template.order_paras || '');
      setTemplate({ ...template, order_paras: (current + ' ' + tag).split('\n\n') });
    } else {
      setTemplate({ ...template, [activeField]: (template[activeField] || '') + ' ' + tag });
    }
  };

  const handleParasChange = (e) => {
    const lines = e.target.value.split('\n\n').filter(p => p.trim());
    setTemplate({ ...template, order_paras: lines });
  };

  return (
    <div className="rr-modal-backdrop" onClick={onClose}>
      <div className="rr-template-dialog" onClick={e => e.stopPropagation()}>
        <div className="rr-admin-toolbar">
          <h2>{template.id ? 'Edit Proceedings Template' : 'Add New Proceedings Template'}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={onSave}>
          {error && <div className="rr-admin-alert" role="alert">{error}</div>}

          <div className="rr-admin-form">
            <label>Template Name (Tamil / English)
              <input required maxLength={200} value={template.name || ''} onChange={e => setTemplate({ ...template, name: e.target.value })} placeholder="e.g. சுங்கத்துறை நிலுவை - செயல்முறைகள்" />
            </label>

            <label>Unique Code identifier
              <input required maxLength={64} value={template.code || ''} onChange={e => setTemplate({ ...template, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g. customs_proceedings" disabled={Boolean(template.id)} />
            </label>

            <label>Department
              <select value={template.department || 'CUSTOMS'} onChange={e => setTemplate({ ...template, department: e.target.value })}>
                <option value="CUSTOMS">Customs (சுங்கத்துறை - Sec 142)</option>
                <option value="MCOP">MCOP (மோட்டார் வாகன விபத்து - Sec 174)</option>
                <option value="TNRERA">TNRERA (ரியல் எஸ்டேட் - Sec 40)</option>
                <option value="WARRANT">Court Warrant (நீதிமன்ற வாரண்ட்)</option>
                <option value="GENERAL">General Revenue (பொது வருவாய்)</option>
              </select>
            </label>

            <label>Document Category
              <select value={template.category || 'PROCEEDINGS'} onChange={e => setTemplate({ ...template, category: e.target.value })}>
                <option value="PROCEEDINGS">செயல்முறைகள் (Collector Proceedings Order)</option>
                <option value="MEMORANDUM">குறிப்பாணை (District Collectorate Memo)</option>
                <option value="OFFICE_NOTE">அலுவலகக் குறிப்பு (Office Note File Submission)</option>
                <option value="CUSTOM">தனிப்பயன் (Custom Government Template)</option>
              </select>
            </label>

            <label>Description
              <input value={template.description || ''} onChange={e => setTemplate({ ...template, description: e.target.value })} placeholder="Brief summary of governing sections and procedures" />
            </label>

            <label>Header / Prefix
              <input value={template.heading_prefix || ''} onChange={e => setTemplate({ ...template, heading_prefix: e.target.value })} placeholder="e.g. பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.," />
            </label>

            <div>
              <label>Template Placeholder Helper (Click to insert into active field):</label>
              <div className="rr-tag-helper">
                {PLACEHOLDER_TAGS.map(tag => (
                  <span key={tag} className="rr-tag-chip" onClick={() => insertTag(tag)}>{tag}</span>
                ))}
              </div>
            </div>

            <label>Subject Template (பொருள்:)
              <textarea
                required
                rows={3}
                value={template.subject_template || ''}
                onFocus={() => setActiveField('subject_template')}
                onChange={e => setTemplate({ ...template, subject_template: e.target.value })}
              />
            </label>

            <label>Reference Template (பார்வை:)
              <textarea
                required
                rows={2}
                value={template.reference_template || ''}
                onFocus={() => setActiveField('reference_template')}
                onChange={e => setTemplate({ ...template, reference_template: e.target.value })}
              />
            </label>

            <label>Order Body Paragraphs (உத்தரவு - Separate paragraphs with double enter):
              <textarea
                required
                rows={6}
                value={Array.isArray(template.order_paras) ? template.order_paras.join('\n\n') : (template.order_paras || '')}
                onFocus={() => setActiveField('order_paras')}
                onChange={handleParasChange}
              />
            </label>

            <label>Enclosure Text (இணைப்பு:)
              <input value={template.enclosure_text || 'கடித நகல்'} onChange={e => setTemplate({ ...template, enclosure_text: e.target.value })} />
            </label>

            <label>Signatory Text
              <textarea rows={2} value={template.signatory_text || ''} onChange={e => setTemplate({ ...template, signatory_text: e.target.value })} />
            </label>
          </div>

          <div className="rr-admin-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{template.id ? 'Save Template Changes' : 'Create Template'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplatePreviewDialog({ template, onClose }) {
  const [renderedContent, setRenderedContent] = useState('Rendering preview in TAU-Marutham font...');

  useEffect(() => {
    const sampleContext = {
      district_name: 'ஈரோடு',
      taluk_name: 'ஈரோடு',
      defaulter_name: 'M/s. Prisma Garments',
      iec_no: '3205015860',
      door_no: '46',
      street_and_locality: 'உழவன் நகர், 6-வது உழவர் வீதி, பெருமாள் கவுண்டர் தோட்டம்',
      pincode: '638009',
      principal_amount: '1,73,308',
      penalty_amount: '9,000',
      total_amount: '1,82,308/-',
      amount_in_tamil_words: 'ரூபாய் ஒரு இலட்சத்து எண்பத்திரண்டாயிரத்து முன்னூற்றி எட்டு மட்டும்',
      issuing_authority_name: 'சுங்கத்துறை உதவி ஆணையர், வருவாய் வசூலிப்பு பிரிவு, சென்னை',
      case_file_no: '516/2024-ARC',
      order_in_original_no: 'Order in Original No. 105790/2024',
      order_date: '28.03.2024',
      letter_date: '24.12.2025',
      dd_favour_of: 'The Commissioner of Customs, Export commissionerate (Chennai IV)',
      head_of_account: 'Head of Account: 037 - Customs',
      dispatch_address: 'The Assistant Commissioner of Customs (ARC), Custom House, 60, Rajaji Salai, Chennai-600001',
      living_verb: 'இயங்கி வரும்',
      defaulter_suffix: 'நிறுவனத்திடமிருந்து',
      asset_clause: 'அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து'
    };

    apiService.renderTemplate(template.id || template.code, sampleContext)
      .then(res => setRenderedContent(res.content || res.rendered_content))
      .catch(() => setRenderedContent('Error rendering template preview.'));
  }, [template]);

  return (
    <div className="rr-modal-backdrop" onClick={onClose}>
      <div className="rr-template-dialog" onClick={e => e.stopPropagation()}>
        <div className="rr-admin-toolbar">
          <h2><FileText size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Template Preview: {template.name}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: '1rem', color: '#687991', fontSize: '0.85rem' }}>
          Rendered using <strong>TAU-Marutham</strong> font according to Tamil Nadu District Collectorate Proceedings standard.
        </div>

        <div className="rr-preview-box">
          {renderedContent}
        </div>

        <div className="rr-admin-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}

export default function TemplateManagement({ currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const list = await apiService.getTemplates();
      setTemplates(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingTemplate.id) {
        await apiService.updateTemplate(editingTemplate.id, editingTemplate, currentUser?.role || 'admin');
        setMessage('Template updated successfully in PostgreSQL database.');
      } else {
        await apiService.createTemplate(editingTemplate, currentUser?.role || 'admin');
        setMessage('New template created successfully in PostgreSQL database.');
      }
      setEditingTemplate(null);
      loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Are you sure you want to delete template "${t.name}"?`)) return;
    try {
      await apiService.deleteTemplate(t.id, currentUser?.role || 'admin');
      setMessage('Template deleted successfully.');
      loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  };

  const visibleTemplates = templates.filter(t => {
    const matchSearch = `${t.name} ${t.code} ${t.description}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || t.department === deptFilter;
    const matchCat = catFilter === 'all' || t.category === catFilter;
    return matchSearch && matchDept && matchCat;
  });

  return (
    <section className="rr-admin rr-template-management">
      <header className="rr-admin-heading">
        <div>
          <h1>Proceedings Template Management</h1>
          <p>Create, customize, and edit dynamic Tamil Nadu Revenue Recovery proceedings templates stored in PostgreSQL.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingTemplate({ ...emptyTemplate })}>
          <Plus size={16} /> Add Template
        </button>
      </header>

      {error && <div className="rr-admin-alert" role="alert">{error}</div>}
      {message && <div className="rr-admin-notice" role="status">{message}</div>}

      <div className="rr-admin-filters">
        <input
          placeholder="Search templates by name, act or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="all">All Departments</option>
          <option value="CUSTOMS">Customs (சுங்கத்துறை)</option>
          <option value="MCOP">MCOP (மோட்டார் விபத்து)</option>
          <option value="TNRERA">TNRERA (ரியல் எஸ்டேட்)</option>
          <option value="WARRANT">Court Warrant (வாரண்ட்)</option>
          <option value="GENERAL">General Revenue (பொது)</option>
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="PROCEEDINGS">செயல்முறைகள் (Proceedings)</option>
          <option value="MEMORANDUM">குறிப்பாணை (Memorandum)</option>
          <option value="OFFICE_NOTE">அலுவலகக் குறிப்பு (Office Note)</option>
          <option value="CUSTOM">Custom Templates</option>
        </select>
      </div>

      <div className="rr-template-grid">
        {visibleTemplates.map(t => (
          <article key={t.id} className="rr-template-card">
            <div className="rr-template-card-header">
              <div>
                <div className="rr-template-badges" style={{ marginBottom: '0.4rem' }}>
                  <span className="rr-badge badge-dept">{t.department}</span>
                  <span className="rr-badge badge-cat">{t.category}</span>
                  {t.is_system && <span className="rr-badge badge-system">System Official</span>}
                </div>
                <h3>{t.name}</h3>
              </div>
            </div>

            <p className="rr-template-desc">{t.description || 'Tamil Nadu District Collectorate Standard Proceeding Template'}</p>

            <div className="rr-template-meta">
              <span><strong>Code:</strong> <code>{t.code}</code></span>
              <span><strong>Font:</strong> <code>TAU-Marutham</code></span>
            </div>

            <div className="rr-template-actions">
              <button className="btn btn-outline" style={{ padding: '0.35rem 0.65rem' }} onClick={() => setPreviewTemplate(t)}>
                <Eye size={14} /> Preview
              </button>
              <button className="btn btn-outline" style={{ padding: '0.35rem 0.65rem' }} onClick={() => setEditingTemplate(t)}>
                <Edit2 size={14} /> Edit
              </button>
              {!t.is_system && (
                <button className="btn btn-ghost" style={{ padding: '0.35rem 0.65rem', color: '#f87171' }} onClick={() => handleDelete(t)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {editingTemplate && (
        <TemplateEditorDialog
          template={editingTemplate}
          setTemplate={setEditingTemplate}
          error={error}
          onSave={handleSave}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </section>
  );
}
