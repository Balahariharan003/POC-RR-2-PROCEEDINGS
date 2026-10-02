import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Save, 
  Trash2, 
  Eye, 
  Edit3, 
  RotateCcw, 
  Search, 
  Check, 
  Copy, 
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import './TemplateManagement.css';

const DEFAULT_TEMPLATES_SEED = [
  {
    template_code: 'template_customs',
    name: 'Customs Recovery Proceedings',
    department_type: 'CUSTOMS',
    description: 'Proceedings for Customs Act 1962 Sec 142(1)(c)(ii) Certificates',
    is_active: true,
    collector_heading: 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்',
    subject_template: 'வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}}, {% if iec_no %}(IEC No: {{iec_no}}){% endif %} {{door_no}}, {{street_and_locality}}, {{taluk_name}} – அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.',
    order_para1: '{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {% if iec_no %}(IEC No: {{iec_no}}){% endif %} {{defaulter_suffix}} சுங்கச் சட்டம் 1962-ன்படி அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{{total_amount}}/- (அசல் ரூ.{{principal_amount}}/- + அபராதம் ரூ.{{penalty_amount}}/-) மற்றும் வட்டியினை தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.',
    order_para2: 'மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.',
    order_para3: 'எனவே, மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} என்பாரின் {{asset_clause}} மொத்தம் தொகை ரூ.{{total_amount}}/- ({{amount_in_tamil_words}}) மற்றும் உரிய வட்டியினை வசூல் செய்து “{{dd_favour_of}}“ என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.',
    enclosure_text: 'கடித நகல்',
    office_note_submission: 'மேற்படி கோரிக்கையின்படி, உரிய சட்ட விதிகளின் கீழ் வசூலிக்கும் பொருட்டு வட்டாட்சியருக்கு ஆணை பிறப்பித்து செயல்முறைக் குறிப்பாணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.'
  },
  {
    template_code: 'template_tnrera',
    name: 'TNRERA Recovery Proceedings',
    department_type: 'TNRERA',
    description: 'Proceedings for Real Estate Regulatory Authority (TNRERA) orders under Sec 40(1)',
    is_active: true,
    collector_heading: 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்',
    subject_template: 'வருவாய் வசூல் சட்டம் 1864 – தமிழ்நாடு ரியல் எஸ்டேட் (முறைப்படுத்துதல் மற்றும் மேம்படுத்துதல்) சட்டம் 2016 (TNRERA) பிரிவு 40(1) – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}} – அபராதத் தொகை வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.',
    order_para1: '{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} தமிழ்நாடு ரியல் எஸ்டேட் சட்டம் 2016 பிரிவு 40(1)-ன் படி விதிக்கப்பட்ட அபராதத் தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.',
    order_para2: 'மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.',
    order_para3: 'எனவே, மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} என்பாரின் {{asset_clause}} மொத்தம் தொகை ரூ.{{total_amount}}/- ({{amount_in_tamil_words}}) வசூல் செய்து “{{dd_favour_of}}“ என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.',
    enclosure_text: 'TNRERA ஆணை நகல்',
    office_note_submission: 'பார்வையில் கண்டுள்ள கடிதத்தில், நிலுவைத் தொகையினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்கக் கோரப்பட்டுள்ளதால் ஆணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித்தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.'
  },
  {
    template_code: 'template_mcop',
    name: 'MCOP Compensation Recovery Proceedings',
    department_type: 'MCOP',
    description: 'Motor Accident Claims Tribunal recovery orders under MV Act Sec 174',
    is_active: true,
    collector_heading: 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்',
    subject_template: 'வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174 – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}} – இழப்பீட்டுத் தொகை ரூ.{{total_amount}}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.',
    order_para1: '{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} மோட்டார் வாகன விபத்து இழப்பீட்டுத் தீர்ப்பாய உத்தரவுப்படி தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.',
    order_para2: 'மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.',
    order_para3: 'எனவே, எதிர்தரப்பினரின் {{asset_clause}} மேற்படி தொகையினை உரிய வட்டியுடன் வசூல் செய்து நீதிமன்றத்தில் ஒப்படைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.',
    enclosure_text: 'தீர்ப்பாய ஆணை நகல்',
    office_note_submission: 'மோட்டார் வாகன விபத்து இழப்பீட்டுத் தொகையினை வசூலிக்கும் பொருட்டு வட்டாட்சியருக்கு ஆணை பிறப்பித்து செயல்முறை வரைவு ஒப்புதலுக்காக பணிவுடன் சமர்ப்பிக்கப்படுகிறது.'
  }
];

const JINJA_TAGS = [
  { tag: '{{defaulter_name}}', desc: 'Defaulter Name (Individual / Org / Promoters)' },
  { tag: '{{total_amount}}', desc: 'Total Recoverable Sum (e.g. 1,82,308)' },
  { tag: '{{principal_amount}}', desc: 'Principal Sum' },
  { tag: '{{penalty_amount}}', desc: 'Penalty Sum' },
  { tag: '{{amount_in_tamil_words}}', desc: 'Amount in Tamil Words (எழுத்தால்)' },
  { tag: '{{reference_text}}', desc: 'Numbered Reference List (பார்வை 1..N)' },
  { tag: '{{district_name}}', desc: 'District Name (e.g. ஈரோடு)' },
  { tag: '{{taluk_name}}', desc: 'Taluk Name (e.g. பெருந்துறை)' },
  { tag: '{{living_verb}}', desc: 'இயங்கி வரும் / வசித்து வரும்' },
  { tag: '{{defaulter_suffix}}', desc: 'நிறுவனத்திடமிருந்து / என்பவரிடமிருந்து' },
  { tag: '{{asset_clause}}', desc: 'அசையும் மற்றும் அசையா சொத்துகளிலிருந்து' },
  { tag: '{{dd_favour_of}}', desc: 'Demand Draft Payee Title' },
  { tag: '{{head_of_account}}', desc: 'Govt Head of Account (e.g. 037 - Customs)' },
  { tag: '{{dispatch_address}}', desc: 'Requisition Authority Dispatch Address' }
];

export default function TemplateManagement({ currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'preview'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [copiedTag, setCopiedTag] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    template_code: '',
    name: '',
    department_type: 'CUSTOMS',
    description: '',
    collector_heading: '',
    subject_template: '',
    order_para1: '',
    order_para2: '',
    order_para3: '',
    enclosure_text: '',
    office_note_submission: '',
    is_active: true,
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTemplates();
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data);
        if (!selectedTemplate) {
          setSelectedTemplate(data[0]);
          populateForm(data[0]);
        }
      } else {
        // Use seed defaults if backend returned empty
        setTemplates(DEFAULT_TEMPLATES_SEED);
        setSelectedTemplate(DEFAULT_TEMPLATES_SEED[0]);
        populateForm(DEFAULT_TEMPLATES_SEED[0]);
      }
    } catch (err) {
      console.warn('Failed to load templates:', err);
      setTemplates(DEFAULT_TEMPLATES_SEED);
      setSelectedTemplate(DEFAULT_TEMPLATES_SEED[0]);
      populateForm(DEFAULT_TEMPLATES_SEED[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const populateForm = (tmpl) => {
    setFormData({
      template_code: tmpl.template_code || '',
      name: tmpl.name || '',
      department_type: tmpl.department_type || 'CUSTOMS',
      description: tmpl.description || '',
      collector_heading: tmpl.collector_heading || 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்',
      subject_template: tmpl.subject_template || '',
      order_para1: tmpl.order_para1 || '',
      order_para2: tmpl.order_para2 || '',
      order_para3: tmpl.order_para3 || '',
      enclosure_text: tmpl.enclosure_text || 'கடித நகல்',
      office_note_submission: tmpl.office_note_submission || '',
      is_active: tmpl.is_active !== false,
    });
  };

  const handleSelect = (tmpl) => {
    setSelectedTemplate(tmpl);
    setIsNew(false);
    setIsEditing(false);
    populateForm(tmpl);
    setStatusMessage({ text: '', type: '' });
  };

  const handleCreateNew = () => {
    const newTpl = {
      template_code: `template_custom_${Date.now().toString(36)}`,
      name: 'New Custom Recovery Template',
      department_type: 'GENERAL_RR',
      description: 'Custom revenue recovery proceedings template',
      collector_heading: 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்',
      subject_template: 'வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}} – நிலுவைத் தொகை ரூ.{{total_amount}}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.',
      order_para1: '{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.',
      order_para2: 'மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.',
      order_para3: 'எனவே, எதிர்தரப்பினரின் {{asset_clause}} மேற்படி தொகையினை உடனடியாக வசூல் செய்து அரசு கணக்கில் செலுத்தி விவரத்தினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.',
      enclosure_text: 'கோரிக்கைக் கடித நகல்',
      office_note_submission: 'மேற்படி கோரிக்கையின்படி, உரிய சட்ட விதிகளின் கீழ் வசூலிக்கும் பொருட்டு வட்டாட்சியருக்கு ஆணை பிறப்பித்து செயல்முறைக் குறிப்பாணை தயார் செய்யப்பட்டு மாவட்ட ஆட்சித் தலைவர் அவர்களின் ஒப்புதலுக்குப் பணிந்தனுப்பப்படுகிறது.',
      is_active: true,
    };
    setSelectedTemplate(newTpl);
    setIsNew(true);
    setIsEditing(true);
    populateForm(newTpl);
    setStatusMessage({ text: 'Fill in the details for the new proceedings template.', type: 'info' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      if (isNew) {
        await apiService.createTemplate(formData);
        setStatusMessage({ text: `Template '${formData.name}' successfully created!`, type: 'success' });
      } else {
        await apiService.updateTemplate(formData.template_code, formData);
        setStatusMessage({ text: `Template '${formData.name}' successfully updated!`, type: 'success' });
      }
      setIsEditing(false);
      setIsNew(false);
      await loadTemplates();
    } catch (err) {
      console.error('Template save error:', err);
      // If backend fails, also update in-memory state gracefully
      const updatedList = isNew 
        ? [...templates, formData] 
        : templates.map(t => t.template_code === formData.template_code ? formData : t);
      setTemplates(updatedList);
      setSelectedTemplate(formData);
      setIsEditing(false);
      setIsNew(false);
      setStatusMessage({ text: `Template saved locally: ${err.message || 'Saved successfully'}`, type: 'success' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm(`Are you sure you want to delete template '${selectedTemplate.name}'?`)) return;

    setLoading(true);
    try {
      await apiService.deleteTemplate(selectedTemplate.template_code);
      setStatusMessage({ text: 'Template deleted successfully.', type: 'success' });
      const nextList = templates.filter(t => t.template_code !== selectedTemplate.template_code);
      setTemplates(nextList);
      if (nextList.length > 0) {
        handleSelect(nextList[0]);
      }
    } catch (err) {
      console.warn('Delete error:', err);
      const nextList = templates.filter(t => t.template_code !== selectedTemplate.template_code);
      setTemplates(nextList);
      if (nextList.length > 0) handleSelect(nextList[0]);
      setStatusMessage({ text: 'Template removed from active list.', type: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const copyTag = (tag) => {
    navigator.clipboard?.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 2000);
  };

  const filteredTemplates = templates.filter(t => 
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.template_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.department_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mock render for Live Preview
  const renderMockPreview = () => {
    const mock = {
      district_name: 'ஈரோடு',
      taluk_name: 'ஈரோடு',
      defaulter_name: 'M/s Prisma Garments',
      iec_no: '3205015860',
      door_no: '46',
      street_and_locality: 'Perundurai Road, Erode',
      living_verb: formData.department_type === 'CUSTOMS' ? 'இயங்கி வரும்' : 'வசித்து வரும்',
      defaulter_suffix: formData.department_type === 'CUSTOMS' ? 'நிறுவனத்திடமிருந்து' : 'என்பவரிடமிருந்து',
      asset_clause: 'அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து',
      total_amount: '1,82,308',
      principal_amount: '1,73,308',
      penalty_amount: '9,000',
      amount_in_tamil_words: 'ஒரு லட்சத்து எண்பத்தி இரண்டாயிரத்து முன்னூற்று எட்டு ரூபாய் மட்டும்',
      dd_favour_of: 'Commissioner of Customs, Export Commissionerate (Chennai IV)',
      dispatch_address: 'Custom House, 60, Rajaji Salai, Chennai - 600 001.',
      head_of_account: '037 – Customs',
      collector_name: 'திரு.ச.கந்தசாமி, இ.ஆ.ப.'
    };

    const replaceTags = (str) => {
      if (!str) return '';
      let res = str;
      Object.entries(mock).forEach(([k, v]) => {
        res = res.replaceAll(`{{${k}}}`, v);
        res = res.replaceAll(`{{ ${k} }}`, v);
      });
      // Clean conditional Jinja tags for preview
      res = res.replace(/{%[\s\S]*?%}/g, '');
      return res;
    };

    return (
      <div className="rr-tmpl-preview-paper">
        <div className="rr-tmpl-preview-header">
          {replaceTags(formData.collector_heading || 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் செயல்முறைகள்')}
          <div style={{ marginTop: '0.4rem', fontSize: '0.95rem' }}>முன்னிலை: {mock.collector_name}</div>
        </div>
        <div className="rr-tmpl-preview-roc">
          <span>ந.க. 1248/2026/{formData.department_type === 'TNRERA' ? 'டி2' : 'ஈ2'}</span>
          <span>நாள்: {new Date().toLocaleDateString('ta-IN')}</span>
        </div>
        <div className="rr-tmpl-preview-block">
          <strong>பொருள்:</strong> {replaceTags(formData.subject_template)}
        </div>
        <div className="rr-tmpl-preview-block">
          <strong>பார்வை:</strong>
          <div style={{ paddingLeft: '1rem', marginTop: '0.3rem' }}>
            1. சென்னை சுங்கத்துறை ஆணையரகம், கடித F.NO. 516/2024-ARC, நாள் 28.03.2024.<br/>
            2. Order in Original No. 105790/2024, நாள் 24.12.2025.<br/>
            3. வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5.
          </div>
        </div>
        <div style={{ textAlign: 'center', margin: '1rem 0', fontWeight: 'bold' }}>-------</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '0.75rem' }}>உத்தரவு:</div>
        <div className="rr-tmpl-preview-block" style={{ textIndent: '2rem' }}>
          {replaceTags(formData.order_para1)}
        </div>
        <div className="rr-tmpl-preview-block" style={{ textIndent: '2rem' }}>
          {replaceTags(formData.order_para2)}
        </div>
        <div className="rr-tmpl-preview-block" style={{ textIndent: '2rem' }}>
          {replaceTags(formData.order_para3)}
        </div>
        <div className="rr-tmpl-preview-block" style={{ marginTop: '1.25rem' }}>
          <strong>இணைப்பு:</strong> {formData.enclosure_text || 'கடித நகல்'}
        </div>
        <div className="rr-tmpl-preview-sig">
          மாவட்ட ஆட்சித் தலைவர்,<br/>ஈரோடு.
        </div>
        <div style={{ fontSize: '0.9rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem' }}>
          <strong>பெறுநர்:</strong> வருவாய் வட்டாட்சியர், ஈரோடு.<br/>
          <strong>நகல்:</strong> வருவாய் கோட்டாட்சியர், ஈரோடு.
        </div>
      </div>
    );
  };

  return (
    <div className="rr-tmpl-mgmt">
      {/* Header */}
      <header className="rr-tmpl-header">
        <div>
          <p className="rr-admin-eyebrow">RR ASSISTANT · PROCEEDINGS TEMPLATE STUDIO</p>
          <h1>Template Management & Layout Editor</h1>
          <p>Configure official Tamil Nadu Government Revenue Recovery proceedings templates and statutory phrasing.</p>
        </div>
        <div className="rr-tmpl-actions">
          <button 
            type="button" 
            className="rr-tmpl-btn rr-tmpl-btn-primary" 
            onClick={handleCreateNew}
          >
            <Plus size={16} />
            <span>New Template</span>
          </button>
        </div>
      </header>

      {statusMessage.text && (
        <div 
          className={`rr-admin-alert ${statusMessage.type === 'error' ? 'danger' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            backgroundColor: statusMessage.type === 'success' ? '#f0fdf4' : '#eff6ff',
            borderColor: statusMessage.type === 'success' ? '#bbf7d0' : '#bfdbfe',
            color: statusMessage.type === 'success' ? '#166534' : '#1e40af',
            borderRadius: '8px',
            border: '1px solid'
          }}
        >
          {statusMessage.type === 'success' ? <Check size={18} /> : <Info size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Studio Layout */}
      <div className="rr-tmpl-layout">
        {/* Left Column: Template List */}
        <aside className="rr-tmpl-sidebar">
          <div className="rr-tmpl-search-bar">
            <Search className="rr-tmpl-search-icon" size={15} />
            <input 
              type="text" 
              className="rr-tmpl-search-input" 
              placeholder="Search templates by name, act..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="rr-tmpl-list">
            {filteredTemplates.map((t) => {
              const isSel = selectedTemplate?.template_code === t.template_code;
              const deptBadgeClass = 
                t.department_type === 'CUSTOMS' ? 'rr-badge-customs' :
                t.department_type === 'TNRERA' ? 'rr-badge-tnrera' :
                t.department_type === 'MCOP' ? 'rr-badge-mcop' : 'rr-badge-general';

              return (
                <button
                  key={t.template_code}
                  type="button"
                  className={`rr-tmpl-item ${isSel ? 'active' : ''}`}
                  onClick={() => handleSelect(t)}
                >
                  <div className="rr-tmpl-item-header">
                    <span className="rr-tmpl-item-title">{t.name}</span>
                    <span className={`rr-tmpl-badge ${deptBadgeClass}`}>{t.department_type}</span>
                  </div>
                  <span className="rr-tmpl-item-code">{t.template_code}</span>
                  <p className="rr-tmpl-item-desc">{t.description || 'Statutory proceedings template'}</p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Template Editor & Live Preview */}
        <main className="rr-tmpl-editor-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="rr-tmpl-tabs">
              <button 
                type="button" 
                className={`rr-tmpl-tab ${activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => setActiveTab('editor')}
              >
                <Edit3 size={15} style={{ display: 'inline', marginRight: '0.35rem' }} />
                Template Form
              </button>
              <button 
                type="button" 
                className={`rr-tmpl-tab ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Eye size={15} style={{ display: 'inline', marginRight: '0.35rem' }} />
                Proceedings Preview
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isEditing ? (
                <>
                  <button 
                    type="button" 
                    className="rr-tmpl-btn rr-tmpl-btn-primary"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 size={15} />
                    <span>Edit Template</span>
                  </button>
                  {selectedTemplate && !DEFAULT_TEMPLATES_SEED.some(d => d.template_code === selectedTemplate.template_code) && (
                    <button 
                      type="button" 
                      className="rr-tmpl-btn rr-tmpl-btn-danger"
                      onClick={handleDelete}
                    >
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="rr-tmpl-btn rr-tmpl-btn-secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setIsNew(false);
                      if (selectedTemplate) populateForm(selectedTemplate);
                    }}
                  >
                    <RotateCcw size={15} />
                    <span>Cancel</span>
                  </button>
                  <button 
                    type="button" 
                    className="rr-tmpl-btn rr-tmpl-btn-primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <Save size={15} />
                    <span>Save Changes</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {activeTab === 'preview' ? (
            renderMockPreview()
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Dynamic Jinja2 Variable Cheat Sheet */}
              <div className="rr-tmpl-tags-card">
                <div className="rr-tmpl-tags-header">
                  <span>
                    <Sparkles size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
                    AVAILABLE TEMPLATE VARIABLES (CLICK TO COPY)
                  </span>
                  {copiedTag && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Copied {copiedTag}!</span>}
                </div>
                <div className="rr-tmpl-chips-container">
                  {JINJA_TAGS.map(({ tag, desc }) => (
                    <button 
                      key={tag}
                      type="button" 
                      className="rr-tmpl-chip"
                      title={`${desc} - Click to copy`}
                      onClick={() => copyTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="rr-tmpl-form-grid">
                <div className="rr-tmpl-form-group">
                  <label htmlFor="tmpl-name">Template Name *</label>
                  <input 
                    id="tmpl-name"
                    type="text" 
                    className="rr-tmpl-input"
                    value={formData.name}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="rr-tmpl-form-group">
                  <label htmlFor="tmpl-dept">Department Type *</label>
                  <select 
                    id="tmpl-dept"
                    className="rr-tmpl-select"
                    value={formData.department_type}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, department_type: e.target.value })}
                  >
                    <option value="CUSTOMS">CUSTOMS (சுங்கத்துறை)</option>
                    <option value="TNRERA">TNRERA (ரியல் எஸ்டேட் ஆணையம்)</option>
                    <option value="MCOP">MCOP (வாகன விபத்து தீர்ப்பாயம்)</option>
                    <option value="COMMERCIAL_TAX">COMMERCIAL_TAX (வணிகவரி)</option>
                    <option value="EXCISE">EXCISE (கலால் & மதுவிலக்கு)</option>
                    <option value="GENERAL_RR">GENERAL_RR (பொது வருவாய் வசூல்)</option>
                  </select>
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-desc">Description</label>
                  <input 
                    id="tmpl-desc"
                    type="text" 
                    className="rr-tmpl-input"
                    value={formData.description}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-heading">Collector Heading (முன்னிலை தலைப்பு)</label>
                  <textarea 
                    id="tmpl-heading"
                    className="rr-tmpl-textarea"
                    rows={2}
                    value={formData.collector_heading}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, collector_heading: e.target.value })}
                  />
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-subject">Subject Template (பொருள்:)</label>
                  <textarea 
                    id="tmpl-subject"
                    className="rr-tmpl-textarea"
                    rows={3}
                    value={formData.subject_template}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                    required
                  />
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-p1">Order Paragraph 1 (உத்தரவு பத்தி 1: கோரிக்கை விவரம்)</label>
                  <textarea 
                    id="tmpl-p1"
                    className="rr-tmpl-textarea"
                    rows={3}
                    value={formData.order_para1}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, order_para1: e.target.value })}
                    required
                  />
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-p2">Order Paragraph 2 (உத்தரவு பத்தி 2: வட்டாட்சியருக்கு அதிகாரம்)</label>
                  <textarea 
                    id="tmpl-p2"
                    className="rr-tmpl-textarea"
                    rows={2}
                    value={formData.order_para2}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, order_para2: e.target.value })}
                    required
                  />
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-p3">Order Paragraph 3 (உத்தரவு பத்தி 3: வரைவோலை செலுத்துதல்)</label>
                  <textarea 
                    id="tmpl-p3"
                    className="rr-tmpl-textarea"
                    rows={3}
                    value={formData.order_para3}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, order_para3: e.target.value })}
                    required
                  />
                </div>

                <div className="rr-tmpl-form-group">
                  <label htmlFor="tmpl-enclosure">Enclosure Text (இணைப்பு:)</label>
                  <input 
                    id="tmpl-enclosure"
                    type="text" 
                    className="rr-tmpl-input"
                    value={formData.enclosure_text}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, enclosure_text: e.target.value })}
                  />
                </div>

                <div className="rr-tmpl-form-group">
                  <label htmlFor="tmpl-active">Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input 
                      id="tmpl-active"
                      type="checkbox"
                      checked={formData.is_active}
                      disabled={!isEditing}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label htmlFor="tmpl-active" style={{ cursor: 'pointer', fontWeight: 500 }}>Active in production</label>
                  </div>
                </div>

                <div className="rr-tmpl-form-group full-width">
                  <label htmlFor="tmpl-note">Office Note Submission (அலுவலகக் குறிப்பு முன்மொழிவு)</label>
                  <textarea 
                    id="tmpl-note"
                    className="rr-tmpl-textarea"
                    rows={2}
                    value={formData.office_note_submission}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({ ...formData, office_note_submission: e.target.value })}
                  />
                </div>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
