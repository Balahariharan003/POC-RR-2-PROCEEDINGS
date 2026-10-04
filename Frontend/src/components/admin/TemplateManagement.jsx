import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Save,
  FileDown,
  FileUp,
  Plus,
  Trash2,
  Copy,
  Layers,
  Sparkles,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Edit3,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  RotateCcw,
  RotateCw,
  List
} from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import TemplateDocumentEditor from '../workspace/TemplateDocumentEditor.jsx';
import './TemplateManagement.css';

const JINJA_TAGS = [
  { tag: '{{order_para1}}', desc: 'Full Demand Paragraph (LLM Synthesized)' },
  { tag: '{{order_para2}}', desc: 'Full Delegation Paragraph (LLM Synthesized)' },
  { tag: '{{order_para3}}', desc: 'Full Asset / DD Paragraph (LLM Synthesized)' },
  { tag: '{{subject_text}}', desc: 'Full Subject Clause (LLM Synthesized)' },
  { tag: '{{reference_text}}', desc: 'Full பார்வை Reference Block (LLM Synthesized)' },
  { tag: '{{issuing_authority_name}}', desc: 'Requisitioning Office / Court Name' },
  { tag: '{{issuing_officer_role}}', desc: 'Requisitioning Officer Role / Designation' },
  { tag: '{{collectorate_office_name}}', desc: 'Collectorate Office Name (மாவட்ட ஆட்சியர் அலுவலகம்)' },
  { tag: '{{signatory_role}}', desc: 'Signatory Role (மாவட்ட ஆட்சித் தலைவர் / நேர்முக உதவியாளர்)' },
  { tag: '{{collector_name}}', desc: 'District Collector Name Line' },
  { tag: '{{enforcing_officer_role}}', desc: 'Enforcement Officer Role (வருவாய் வட்டாட்சியர்)' },
  { tag: '{{district_name}}', desc: 'District Name (ஈரோடு)' },
  { tag: '{{taluk_name}}', desc: 'Jurisdictional Taluk' },
  { tag: '{{defaulter_name}}', desc: 'Defaulter / Party Name' },
  { tag: '{{door_no}}', desc: 'Door Number' },
  { tag: '{{street_and_locality}}', desc: 'Street / Village' },
  { tag: '{{living_verb}}', desc: 'Living / Operating verb' },
  { tag: '{{defaulter_suffix}}', desc: 'Suffix (என்பவரிடமிருந்து)' },
  { tag: '{{asset_clause}}', desc: 'Asset Clause (அசையும் மற்றும் அசையா சொத்துகளிலிருந்து)' },
  { tag: '{{total_amount}}', desc: 'Total Amount (Formatted)' },
  { tag: '{{statute_cited}}', desc: 'Statute / Act Name' },
  { tag: '{{dues_label}}', desc: 'Dues Label (இழப்பீட்டுத் தொகை)' },
  { tag: '{{dd_favour_of}}', desc: 'DD In Favour Of' },
  { tag: '{{dispatch_address}}', desc: 'Dispatch Address' },
];

function getBlockPages(blocks) {
  if (!blocks || blocks.length === 0) return [[]];
  const PAGE_CAPACITY_PT = 680;
  const pages = [];
  let currentPage = [];
  let currentHeight = 0;
  blocks.forEach((block) => {
    let blockHeight = 24;
    if (block.type === 'table') {
      blockHeight = Math.max(60, (block.rows || []).length * 45);
    } else if (block.type === 'paragraph') {
      const txt = block.text || '';
      if (!txt.trim()) blockHeight = 14;
      else if (txt.length <= 60) blockHeight = 24;
      else if (txt.length <= 150) blockHeight = 44;
      else if (txt.length <= 300) blockHeight = 78;
      else blockHeight = Math.ceil(txt.length / 70) * 18 + 14;
    }
    if (currentPage.length > 0 && currentHeight + blockHeight > PAGE_CAPACITY_PT) {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = blockHeight;
    } else {
      currentPage.push(block);
      currentHeight += blockHeight;
    }
  });
  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

export default function TemplateManagement({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingDocx, setUploadingDocx] = useState(false);
  const fileUploadRef = useRef(null);

  // Studio Rail & Canvas States
  const [showLeftRail, setShowLeftRail] = useState(true);
  const [leftRailTab, setLeftRailTab] = useState('templates'); // 'templates' | 'pages'
  const [showInspector, setShowInspector] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedTag, setCopiedTag] = useState('');

  // Real DOCX Layout & Direct Live In-Browser Edits
  const [documentLayout, setDocumentLayout] = useState(null);
  const [documentEdits, setDocumentEdits] = useState({});
  const [blockStyles, setBlockStyles] = useState({});
  const [isEditMode, setIsEditMode] = useState(true);

  // Undo / Redo History Stack
  const [history, setHistory] = useState([{ edits: {}, styles: {} }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef([{ edits: {}, styles: {} }]);
  const historyIndexRef = useRef(0);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const pushHistory = (newEdits, newStyles) => {
    const curIdx = historyIndexRef.current;
    const currentHist = historyRef.current.slice(0, curIdx + 1);
    const newHist = [...currentHist, { edits: { ...newEdits }, styles: { ...newStyles } }];
    historyRef.current = newHist;
    historyIndexRef.current = newHist.length - 1;
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
  };

  const handleUndo = () => {
    const curIdx = historyIndexRef.current;
    if (curIdx > 0) {
      const prevIdx = curIdx - 1;
      const snapshot = historyRef.current[prevIdx];
      if (snapshot) {
        setDocumentEdits(snapshot.edits || {});
        setBlockStyles(snapshot.styles || {});
        historyIndexRef.current = prevIdx;
        setHistoryIndex(prevIdx);
      }
    }
  };

  const handleRedo = () => {
    const curIdx = historyIndexRef.current;
    if (curIdx < historyRef.current.length - 1) {
      const nextIdx = curIdx + 1;
      const snapshot = historyRef.current[nextIdx];
      if (snapshot) {
        setDocumentEdits(snapshot.edits || {});
        setBlockStyles(snapshot.styles || {});
        historyIndexRef.current = nextIdx;
        setHistoryIndex(nextIdx);
      }
    }
  };

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y) with capture phase for reliable execution
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isZ = e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ';
      const isY = e.key === 'y' || e.key === 'Y' || e.code === 'KeyY';

      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // In-App Confirmation Modal State (replaces browser native confirm)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    confirmType: 'danger',
    onConfirm: null,
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  // Form Metadata
  const [formData, setFormData] = useState({
    template_code: '',
    name: '',
    department_type: 'GENERAL_RR',
    category: 'PROCEEDINGS',
    description: '',
    heading_prefix: '',
    subject_template: '',
    reference_template: '',
    order_para1_template: '',
    order_para2_template: '',
    order_para3_template: '',
    enclosure_text: 'கடித நகல்',
    signatory_text: 'மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு.',
    locked_template: '',
    slot_instructions: '',
    file_name: '',
    file_base64: '',
    is_active: true,
  });

  const updateSelectedBlockStyle = (styleKey, styleValue) => {
    const targetId = selectedBlockId || selectedBlock?.id;
    if (!targetId) return;
    const currentBlock = (documentLayout?.blocks || []).find(b => b.id === targetId) || selectedBlock;
    const existingStyle = blockStyles[targetId] || currentBlock?.style || {};
    const updatedStyles = {
      ...blockStyles,
      [targetId]: {
        ...existingStyle,
        [styleKey]: styleValue
      }
    };
    setBlockStyles(updatedStyles);
    pushHistory(documentEdits, updatedStyles);
  };

  // 3-argument version for the editor's resize/drag callbacks: (blockId, key, value)
  const handleUpdateBlockStyle = (blockId, styleKey, styleValue) => {
    const currentBlock = (documentLayout?.blocks || []).find(b => b.id === blockId);
    const existingStyle = blockStyles[blockId] || currentBlock?.style || {};
    const updatedStyles = {
      ...blockStyles,
      [blockId]: {
        ...existingStyle,
        [styleKey]: styleValue
      }
    };
    setBlockStyles(updatedStyles);
    pushHistory(documentEdits, updatedStyles);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTemplates();
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data);
        const currentCode = selectedTemplate?.template_code;
        const match = data.find(t => t.template_code === currentCode) || data[0];
        setSelectedTemplate(match);
        populateForm(match);
        await loadTemplateLayout(match.template_code);
      } else {
        setTemplates([]);
        setSelectedTemplate(null);
        setDocumentLayout(null);
      }
    } catch (err) {
      console.warn('Failed to load templates from DB:', err);
      setStatusMessage({ text: 'Unable to connect to database for templates.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateLayout = async (code) => {
    if (!code) return;
    try {
      const layout = await apiService.getTemplateLayout(code);
      if (layout && layout.blocks) {
        setDocumentLayout(layout);
        setDocumentEdits({});
        setBlockStyles({});
        setHistory([{ edits: {}, styles: {} }]);
        setHistoryIndex(0);
        if (layout.blocks.length > 0) {
          const firstPara = layout.blocks.find(b => b.type === 'paragraph') || layout.blocks[0];
          setSelectedBlock(firstPara);
          setSelectedBlockId(firstPara.id);
        }
      }
    } catch (err) {
      console.warn(`Could not fetch real layout for ${code}:`, err);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const populateForm = (tmpl) => {
    if (!tmpl) return;
    setFormData({
      template_code: tmpl.template_code || '',
      name: tmpl.name || '',
      department_type: tmpl.department_type || 'GENERAL_RR',
      category: tmpl.category || 'PROCEEDINGS',
      description: tmpl.description || '',
      heading_prefix: tmpl.heading_prefix || tmpl.collector_heading || '',
      subject_template: tmpl.subject_template || '',
      reference_template: tmpl.reference_template || '',
      order_para1_template: tmpl.order_para1_template || tmpl.order_para1 || '',
      order_para2_template: tmpl.order_para2_template || tmpl.order_para2 || '',
      order_para3_template: tmpl.order_para3_template || tmpl.order_para3 || '',
      enclosure_text: tmpl.enclosure_text || 'கடித நகல்',
      signatory_text: tmpl.signatory_text || 'மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு.',
      locked_template: tmpl.locked_template || '',
      slot_instructions: tmpl.slot_instructions || '',
      file_name: tmpl.file_name || '',
      file_base64: tmpl.file_base64 || '',
      is_active: tmpl.is_active !== false,
    });
  };

  const handleSelect = async (tmpl) => {
    setSelectedTemplate(tmpl);
    setIsNew(false);
    populateForm(tmpl);
    setStatusMessage({ text: '', type: '' });
    await loadTemplateLayout(tmpl.template_code);
  };

  const handleCreateNew = () => {
    const newCode = `template_custom_${Date.now().toString(36)}`;
    const newTpl = {
      template_code: newCode,
      name: 'Dynamic LLM Revenue Recovery Template',
      department_type: 'GENERAL_RR',
      category: 'PROCEEDINGS',
      description: 'Fully dynamic LLM-driven revenue recovery proceedings template with zero hardcoding',
      heading_prefix: 'ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள், ஈரோடு',
      subject_template: '{{subject_text}}',
      reference_template: '{{reference_text}}',
      order_para1_template: '{{order_para1}}',
      order_para2_template: '{{order_para2}}',
      order_para3_template: '{{order_para3}}',
      enclosure_text: 'கோரிக்கைக் கடித நகல்',
      signatory_text: 'மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு.',
      locked_template: '',
      slot_instructions: 'Dynamically synthesized by LLM Master Prompt Legal & Drafting Engine.',
      file_name: '',
      file_base64: '',
      is_active: true,
    };
    setSelectedTemplate(newTpl);
    setIsNew(true);
    populateForm(newTpl);
    setStatusMessage({ text: 'Fill in details or upload a .docx file to create a new template.', type: 'info' });
  };

  const handleParagraphChange = (blockId, text) => {
    const updatedEdits = {
      ...documentEdits,
      [blockId]: text
    };
    setDocumentEdits(updatedEdits);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pushHistory(updatedEdits, blockStyles);
    }, 300);
  };

  const handleDuplicateBlock = (block) => {
    if (!documentLayout || !block) return;
    const blocks = [...(documentLayout.blocks || [])];
    const index = blocks.findIndex(b => b.id === block.id);
    if (index !== -1) {
      const newBlock = {
        ...block,
        id: `block_${Date.now()}`,
        text: documentEdits[block.id] || block.text
      };
      blocks.splice(index + 1, 0, newBlock);
      setDocumentLayout({ ...documentLayout, blocks });
      setSelectedBlockId(newBlock.id);
      setSelectedBlock(newBlock);
    }
  };

  const handleDeleteBlock = (blockId) => {
    if (!documentLayout || !blockId) return;
    const blocks = (documentLayout.blocks || []).filter(b => b.id !== blockId);
    setDocumentLayout({ ...documentLayout, blocks });
    setSelectedBlockId(null);
    setSelectedBlock(null);
  };

  const requestDeleteBlock = (blockId) => {
    if (!blockId) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Paragraph Block',
      message: 'Are you sure you want to delete this paragraph block from the document? You can undo this action at any time with Ctrl+Z.',
      confirmText: 'Delete Block',
      confirmType: 'danger',
      onConfirm: () => {
        handleDeleteBlock(blockId);
        closeConfirmModal();
      }
    });
  };

  const handleAddNewBlock = () => {
    if (!documentLayout) return;
    const newBlock = {
      id: `block_${Date.now()}`,
      type: 'paragraph',
      text: 'புதிய பத்தி விவரம்...',
      runs: [{ text: 'புதிய பத்தி விவரம்...' }],
      style: { textAlign: 'justify', fontSize: '11pt', fontFamily: 'TAU-Marutham' }
    };
    const blocks = [...(documentLayout.blocks || []), newBlock];
    setDocumentLayout({ ...documentLayout, blocks });
    setSelectedBlockId(newBlock.id);
    setSelectedBlock(newBlock);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      // 1. Recursively update all blocks (paragraphs & table cells) with live edits & styles
      const updateBlockTree = (b) => {
        if (!b) return b;
        const editedText = documentEdits[b.id] !== undefined ? documentEdits[b.id] : b.text;
        const updatedStyle = blockStyles[b.id] ? { ...(b.style || {}), ...blockStyles[b.id] } : b.style;

        let updatedBlock = {
          ...b,
          text: editedText,
          style: updatedStyle
        };
        if (b.type === 'paragraph' && editedText !== undefined) {
          updatedBlock.runs = [{ text: editedText, style: updatedStyle || {} }];
        }
        if (b.type === 'table' && Array.isArray(b.rows)) {
          updatedBlock.rows = b.rows.map(row =>
            Array.isArray(row)
              ? row.map(cell => ({
                ...cell,
                blocks: Array.isArray(cell.blocks) ? cell.blocks.map(updateBlockTree) : cell.blocks
              }))
              : row
          );
        }
        return updatedBlock;
      };

      const updatedBlocks = documentLayout?.blocks ? documentLayout.blocks.map(updateBlockTree) : [];
      const updatedLayout = documentLayout ? {
        ...documentLayout,
        blocks: updatedBlocks
      } : null;

      // 2. Synchronize any edits made on known template block IDs back into standard form fields
      const syncedHeading = documentEdits['p_heading'] !== undefined ? documentEdits['p_heading'] : formData.heading_prefix;
      const syncedSubj = documentEdits['p_subj_val'] !== undefined ? documentEdits['p_subj_val'] : formData.subject_template;
      const syncedRef = documentEdits['p_ref_val'] !== undefined ? documentEdits['p_ref_val'] : formData.reference_template;
      const syncedPara1 = documentEdits['p_order_para1'] !== undefined ? documentEdits['p_order_para1'] : formData.order_para1_template;
      const syncedPara2 = documentEdits['p_order_para2'] !== undefined ? documentEdits['p_order_para2'] : formData.order_para2_template;
      const syncedPara3 = documentEdits['p_order_para3'] !== undefined ? documentEdits['p_order_para3'] : formData.order_para3_template;
      const syncedSignatory = documentEdits['p_signatory'] !== undefined ? documentEdits['p_signatory'] : formData.signatory_text;

      // Extract all plain text for locked template representation
      const extractTexts = (blocks) => {
        let texts = [];
        (blocks || []).forEach(b => {
          if (b.type === 'paragraph' && b.text) texts.push(b.text);
          else if (b.type === 'table' && b.rows) {
            b.rows.forEach(r => (r || []).forEach(c => (c.blocks || []).forEach(cb => {
              if (cb.text) texts.push(cb.text);
            })));
          }
        });
        return texts;
      };

      const allTexts = extractTexts(updatedBlocks);
      const updatedLockedText = allTexts.length > 0 ? allTexts.join('\n\n') : formData.locked_template;

      const payload = {
        template_code: formData.template_code,
        name: formData.name,
        department_type: formData.department_type,
        category: formData.category,
        description: formData.description,
        heading_prefix: syncedHeading,
        subject_template: syncedSubj,
        reference_template: syncedRef,
        order_para1_template: syncedPara1,
        order_para2_template: syncedPara2,
        order_para3_template: syncedPara3,
        enclosure_text: formData.enclosure_text,
        signatory_text: syncedSignatory,
        locked_template: updatedLockedText,
        slot_instructions: formData.slot_instructions,
        template_data: updatedLayout,
        file_name: formData.file_name,
        file_base64: formData.file_base64,
        is_active: formData.is_active,
      };

      if (isNew) {
        const created = await apiService.createTemplate(payload);
        setStatusMessage({ text: `Template '${created.name}' created successfully!`, type: 'success' });
        setIsNew(false);
        setSelectedTemplate(created);
      } else {
        const updated = await apiService.updateTemplate(formData.template_code, payload);
        setStatusMessage({ text: `Template '${updated.name}' saved successfully!`, type: 'success' });
        setSelectedTemplate(updated);
      }

      if (updatedLayout) {
        setDocumentLayout(updatedLayout);
        setDocumentEdits({});
        setBlockStyles({});
        setHistory([{ edits: {}, styles: {} }]);
        setHistoryIndex(0);
        if (selectedBlockId) {
          const updatedSel = updatedBlocks.find(b => b.id === selectedBlockId);
          if (updatedSel) setSelectedBlock(updatedSel);
        }
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      await loadTemplates();
    } catch (err) {
      console.error('Template save error:', err);
      setStatusMessage({ text: `Error saving to database: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedTemplate) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Template',
      message: `Are you sure you want to permanently delete template '${selectedTemplate.name}' from PostgreSQL? This action cannot be reversed.`,
      confirmText: 'Delete Template',
      confirmType: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        setLoading(true);
        try {
          await apiService.deleteTemplate(selectedTemplate.template_code);
          setStatusMessage({ text: 'Template deleted from database.', type: 'success' });
          await loadTemplates();
        } catch (err) {
          console.error('Delete error:', err);
          setStatusMessage({ text: `Failed to delete: ${err.message}`, type: 'error' });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDownloadDocx = async () => {
    if (!selectedTemplate?.template_code) return;
    try {
      await apiService.downloadTemplateDocx(
        selectedTemplate.template_code,
        selectedTemplate.file_name || `${selectedTemplate.template_code}.docx`
      );
      setStatusMessage({ text: 'DOCX file downloaded successfully.', type: 'success' });
    } catch (err) {
      console.error('Download error:', err);
      setStatusMessage({ text: `Download failed: ${err.message}`, type: 'error' });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    const targetCode = selectedTemplate?.template_code || formData.template_code || `template_custom_${Date.now().toString(36)}`;
    if (!file) return;

    setUploadingDocx(true);
    try {
      const updated = await apiService.uploadTemplateDocx(targetCode, file);
      setStatusMessage({ text: `DOCX template "${file.name}" uploaded and parsed in database!`, type: 'success' });
      setIsNew(false);
      setSelectedTemplate(updated);
      populateForm(updated);
      await loadTemplateLayout(updated.template_code);
      await loadTemplates();
    } catch (err) {
      console.error('DOCX upload error:', err);
      setStatusMessage({ text: `Failed to upload DOCX file: ${err.message}`, type: 'error' });
    } finally {
      setUploadingDocx(false);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
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

  return (
    <div className="rr-tmpl-studio-root">
      {/* 1. TOP NAVBAR (Matches User Reference Top Bar) */}
      <header className="rr-tmpl-topbar">
        <div className="rr-tmpl-topbar__left">
          {onBack && (
            <button
              type="button"
              className="rr-tmpl-topbar__btn-back"
              onClick={onBack}
              title="Return to Dashboard"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <button
            type="button"
            className={`rr-tmpl-topbar__btn-toggle ${!showLeftRail ? 'active' : ''}`}
            onClick={() => setShowLeftRail(!showLeftRail)}
            title={showLeftRail ? "Collapse sidebar" : "Expand sidebar"}
          >
            {showLeftRail ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* Editable Template Title with Star */}
          <div className="rr-tmpl-title-wrapper">
            <input
              type="text"
              className="rr-tmpl-title-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Template Name"
            />
          </div>
        </div>

        <div className="rr-tmpl-topbar__right">
          {/* Undo / Redo Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              className="rr-insp-tool-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              style={{ opacity: historyIndex <= 0 ? 0.35 : 1, width: '28px', height: '26px', cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer' }}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              className="rr-insp-tool-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              style={{ opacity: historyIndex >= history.length - 1 ? 0.35 : 1, width: '28px', height: '26px', cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer' }}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={13} />
            </button>
          </div>


          <button
            type="button"
            className="rr-tmpl-btn-ghost"
            onClick={() => setShowInspector(!showInspector)}
            title={showInspector ? "Hide Inspector" : "Show Inspector"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: showInspector ? '#ede9fe' : '#ffffff',
              color: showInspector ? '#0e095fff' : '#475569',
              borderColor: showInspector ? '#c7d2fe' : '#e2e8f0',
              fontWeight: 600
            }}
          >
            <Sliders size={14} />
            <span>Inspector</span>
          </button>

          <button
            type="button"
            className="rr-tmpl-btn-ghost"
            onClick={() => populateForm(selectedTemplate)}
          >
            Discard
          </button>

          <button
            type="button"
            className="rr-tmpl-btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            <Save size={14} />
            <span>{isSaved ? 'Saved!' : 'Save'}</span>
          </button>

          {/* DOCX Upload / Download */}
          <input
            type="file"
            ref={fileUploadRef}
            accept=".docx"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          <button
            type="button"
            className="rr-tmpl-btn-publish"
            onClick={() => fileUploadRef.current?.click()}
            disabled={uploadingDocx}
            title="Upload official DOCX binary template into Database"
          >
            <FileUp size={14} />
            <span>{uploadingDocx ? 'Uploading...' : 'Upload DOCX'}</span>
          </button>

          {selectedTemplate?.file_base64 && (
            <button
              type="button"
              className="rr-tmpl-btn-ghost-icon"
              onClick={handleDownloadDocx}
              title="Download official DOCX file"
            >
              <FileDown size={15} />
            </button>
          )}

          <button
            type="button"
            className="rr-tmpl-btn-ghost-icon"
            onClick={handleDelete}
            title="Delete Template"
          >
            <Trash2 size={15} color="#ef4444" />
          </button>
        </div>
      </header>

      {/* Alert Banner */}
      {statusMessage.text && (
        <div className={`rr-tmpl-alert-banner ${statusMessage.type}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage({ text: '', type: '' })}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. MAIN 3-COLUMN WORKSPACE */}
      <div className="rr-tmpl-workspace">
        {/* --- LEFT NAVIGATION RAIL --- */}
        {showLeftRail && (
          <aside className="rr-tmpl-leftrail">
            <div className="rr-tmpl-rail-header">
              <div className="rr-tmpl-rail-tabs">
                <button
                  type="button"
                  className={`rr-tmpl-rail-tab ${leftRailTab === 'templates' ? 'active' : ''}`}
                  onClick={() => setLeftRailTab('templates')}
                >
                  Templates
                </button>
                <button
                  type="button"
                  className={`rr-tmpl-rail-tab ${leftRailTab === 'pages' ? 'active' : ''}`}
                  onClick={() => setLeftRailTab('pages')}
                >
                  Pages
                </button>
              </div>
              <button
                type="button"
                className="rr-tmpl-rail-close-btn"
                onClick={() => setShowLeftRail(false)}
                title="Collapse sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="rr-tmpl-rail-content">
              {leftRailTab === 'templates' ? (
                <>
                  <div className="rr-tmpl-rail-search">
                    <Search size={14} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="rr-tmpl-cards-list">
                    {filteredTemplates.map((t) => {
                      const isSel = selectedTemplate?.template_code === t.template_code;
                      return (
                        <div
                          key={t.template_code}
                          className={`rr-tmpl-thumbnail-card ${isSel ? 'active' : ''}`}
                          onClick={() => handleSelect(t)}
                        >
                          <div className="rr-tmpl-mini-paper">
                            <div className="rr-mini-line header" />
                            <div className="rr-mini-line short" />
                            <div className="rr-mini-line" />
                            <div className="rr-mini-line" />
                            <div className="rr-mini-line short" />
                          </div>
                          <div className="rr-tmpl-card-details">
                            <div className="rr-tmpl-card-name">{t.name}</div>
                            <div className="rr-tmpl-card-sub">{t.department_type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rr-tmpl-cards-list">
                  {getBlockPages(documentLayout?.blocks || []).map((pg, idx) => (
                    <div
                      key={`page-card-${idx + 1}`}
                      className="rr-tmpl-thumbnail-card"
                      onClick={() => {
                        const el = document.getElementById(`rr-page-${idx + 1}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title={`Jump to Page ${idx + 1}`}
                    >
                      <div className="rr-tmpl-mini-paper">
                        <div className="rr-mini-line header" />
                        <div className="rr-mini-line" />
                        <div className="rr-mini-line short" />
                        <div className="rr-mini-line" />
                        <div className="rr-mini-line short" />
                      </div>
                      <div className="rr-tmpl-card-details">
                        <div className="rr-tmpl-card-name">Page {idx + 1}</div>
                        <div className="rr-tmpl-card-sub">{idx === 0 ? 'Orders & Subject' : 'Signatory & Dispatches'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="rr-tmpl-add-new-btn"
              onClick={handleCreateNew}
            >
              <Plus size={14} />
              <span>Add new</span>
            </button>
          </aside>
        )}

        {/* --- CENTER CANVAS: Real Actual DOCX Multi-Page Layout with Direct Live In-Browser Editing --- */}
        <main className="rr-tmpl-center-canvas">
          {!showLeftRail && (
            <button
              type="button"
              className="rr-tmpl-floating-expand-btn"
              onClick={() => setShowLeftRail(true)}
              title="Show Templates / Pages Sidebar"
            >
              <PanelLeftOpen size={14} />
              <span>Templates</span>
            </button>
          )}
          <div className="rr-tmpl-canvas-viewport">
            {documentLayout ? (
              <TemplateDocumentEditor
                key={documentLayout.filename || selectedTemplate?.template_code}
                layout={documentLayout}
                edits={documentEdits}
                onChange={handleParagraphChange}
                onSelectBlock={(block) => {
                  setSelectedBlock(block);
                  setSelectedBlockId(block?.id || null);
                  if (block) setShowInspector(true);
                }}
                selectedBlockId={selectedBlockId}
                disabled={!isEditMode}
                blockStyles={blockStyles}
                onUpdateBlockStyle={handleUpdateBlockStyle}
                onDuplicateBlock={handleDuplicateBlock}
                onDeleteBlock={requestDeleteBlock}
              />
            ) : (
              <div className="rr-tmpl-loading-canvas">
                <div className="rr-loading-spinner" />
                <p>Loading real DOCX file layout from database...</p>
              </div>
            )}
          </div>
        </main>

        {/* --- RIGHT INSPECTOR PANEL: Interactive Typography, Format & Variable Inspector --- */}
        {showInspector && (() => {
          const activeBlock = (documentLayout?.blocks || []).find(b => b.id === selectedBlockId) || selectedBlock;
          return (
            <aside className="rr-tmpl-inspector">
              <div className="rr-tmpl-inspector__header">
                <div className="rr-tmpl-inspector__title">
                  <Sliders size={16} color="#6366f1" />
                  <span>
                    {activeBlock?.type === 'paragraph' ? 'Paragraph Block' :
                      activeBlock?.type === 'table' ? 'Table Section' : 'Element Inspector'}
                  </span>
                </div>
                <button
                  type="button"
                  className="rr-tmpl-btn-icon"
                  onClick={() => {
                    setShowInspector(false);
                    setSelectedBlock(null);
                    setSelectedBlockId(null);
                  }}
                  title="Close Inspector"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="rr-tmpl-inspector__body">
                {/* Block Actions: Delete & Duplicate for selected block */}
                {activeBlock && (
                  <div className="rr-insp-section">
                    <div className="rr-insp-section__title">Block Actions</div>
                    <div className="rr-insp-btn-group">
                      <button
                        type="button"
                        className="rr-insp-tool-btn"
                        onClick={() => handleDuplicateBlock(activeBlock)}
                        title="Duplicate this block"
                        style={{ flex: 1 }}
                      >
                        <Copy size={12} style={{ marginRight: '4px' }} />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="rr-insp-tool-btn"
                        onClick={() => requestDeleteBlock(activeBlock.id)}
                        title="Delete this block"
                        style={{ flex: 1, color: '#ef4444' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 1: Typography, Text Alignment & Formatting Controls */}
                {activeBlock && (
                  <div className="rr-insp-section">
                    <div className="rr-insp-section__title">Text Alignment</div>
                    <div className="rr-insp-btn-group">
                      <button
                        type="button"
                        className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textAlign || activeBlock.style?.textAlign || 'justify') === 'left' ? 'active' : ''}`}
                        onClick={() => updateSelectedBlockStyle('textAlign', 'left')}
                        title="Align Left"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        type="button"
                        className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textAlign || activeBlock.style?.textAlign || 'justify') === 'center' ? 'active' : ''}`}
                        onClick={() => updateSelectedBlockStyle('textAlign', 'center')}
                        title="Align Center"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        type="button"
                        className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textAlign || activeBlock.style?.textAlign || 'justify') === 'right' ? 'active' : ''}`}
                        onClick={() => updateSelectedBlockStyle('textAlign', 'right')}
                        title="Align Right"
                      >
                        <AlignRight size={14} />
                      </button>
                      <button
                        type="button"
                        className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textAlign || activeBlock.style?.textAlign || 'justify') === 'justify' ? 'active' : ''}`}
                        onClick={() => updateSelectedBlockStyle('textAlign', 'justify')}
                        title="Justify"
                      >
                        <AlignJustify size={14} />
                      </button>
                    </div>

                    <div className="rr-insp-section__title" style={{ marginTop: '8px' }}>Style & Font</div>
                    <div className="rr-insp-row">
                      <div className="rr-insp-btn-group" style={{ flex: 1 }}>
                        <button
                          type="button"
                          className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.fontWeight || activeBlock.style?.fontWeight) === 'bold' ? 'active' : ''}`}
                          onClick={() => updateSelectedBlockStyle('fontWeight', (blockStyles[activeBlock.id]?.fontWeight || activeBlock.style?.fontWeight) === 'bold' ? 'normal' : 'bold')}
                          title="Bold"
                        >
                          <Bold size={13} />
                        </button>
                        <button
                          type="button"
                          className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.fontStyle || activeBlock.style?.fontStyle) === 'italic' ? 'active' : ''}`}
                          onClick={() => updateSelectedBlockStyle('fontStyle', (blockStyles[activeBlock.id]?.fontStyle || activeBlock.style?.fontStyle) === 'italic' ? 'normal' : 'italic')}
                          title="Italic"
                        >
                          <Italic size={13} />
                        </button>
                        <button
                          type="button"
                          className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textDecoration || activeBlock.style?.textDecoration) === 'underline' ? 'active' : ''}`}
                          onClick={() => updateSelectedBlockStyle('textDecoration', (blockStyles[activeBlock.id]?.textDecoration || activeBlock.style?.textDecoration) === 'underline' ? 'none' : 'underline')}
                          title="Underline"
                        >
                          <Underline size={13} />
                        </button>
                      </div>

                      <select
                        className="rr-insp-select"
                        style={{ width: '85px' }}
                        value={blockStyles[activeBlock.id]?.fontSize || activeBlock.style?.fontSize || '11pt'}
                        onChange={(e) => updateSelectedBlockStyle('fontSize', e.target.value)}
                        title="Font Size"
                      >
                        <option value="9pt">9 pt</option>
                        <option value="10pt">10 pt</option>
                        <option value="11pt">11 pt</option>
                        <option value="12pt">12 pt</option>
                        <option value="13pt">13 pt</option>
                        <option value="14pt">14 pt</option>
                        <option value="16pt">16 pt</option>
                        <option value="18pt">18 pt</option>
                      </select>
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <select
                        className="rr-insp-select"
                        value={blockStyles[activeBlock.id]?.fontFamily || activeBlock.style?.fontFamily || 'TAU-Marutham'}
                        onChange={(e) => updateSelectedBlockStyle('fontFamily', e.target.value)}
                        title="Font Family"
                      >
                        <option value="TAU-Marutham">TAU-Marutham (Government Official)</option>
                        <option value="Noto Sans Tamil">Noto Sans Tamil</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="Arial">Arial</option>
                      </select>
                    </div>

                    {/* Box Sizing & Width Controls */}
                    <div className="rr-insp-section__title" style={{ marginTop: '10px' }}>Box Width</div>
                    <div className="rr-insp-btn-group">
                      {['100%', '80%', '60%', '50%'].map(w => (
                        <button
                          key={w}
                          type="button"
                          className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.width || activeBlock.style?.width || '100%') === w ? 'active' : ''}`}
                          onClick={() => updateSelectedBlockStyle('width', w)}
                        >
                          {w}
                        </button>
                      ))}
                    </div>

                    <div className="rr-insp-section__title" style={{ marginTop: '8px' }}>Left Indent (உள்தள்ளல்)</div>
                    <div className="rr-insp-btn-group">
                      {[
                        { label: 'None', val: '0' },
                        { label: '1rem', val: '1rem' },
                        { label: '2rem', val: '2rem' },
                        { label: '3rem', val: '3rem' },
                      ].map(ind => (
                        <button
                          key={ind.val}
                          type="button"
                          className={`rr-insp-tool-btn ${(blockStyles[activeBlock.id]?.textIndent || activeBlock.style?.textIndent || '0') === ind.val ? 'active' : ''}`}
                          onClick={() => updateSelectedBlockStyle('textIndent', ind.val)}
                        >
                          {ind.label}
                        </button>
                      ))}
                    </div>

                    {/* Line Spacing (Line Height) */}
                    <div className="rr-insp-section__title" style={{ marginTop: '10px' }}>
                      <List size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      Line Spacing (வரிக்கு வரி இடைவெளி)
                    </div>
                    <div className="rr-insp-row" style={{ gap: '6px' }}>
                      <select
                        className="rr-insp-select"
                        value={blockStyles[activeBlock.id]?.lineHeight || activeBlock.style?.lineHeight || '1.5'}
                        onChange={(e) => updateSelectedBlockStyle('lineHeight', e.target.value)}
                        title="Line Spacing"
                      >
                        <option value="1">1.0(Tight)</option>
                        <option value="1.15">1.15(Compact)</option>
                        <option value="1.5">1.5(Default)</option>
                        <option value="2">2.0(Double)</option>
                        <option value="2.5">2.5(Wide)</option>
                        <option value="3">3.0(Extra Wide)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Section 2: Selected Block Live Text Editor */}
                {activeBlock && (
                  <div className="rr-insp-section">
                    <div className="rr-insp-section__title">Default value / Content</div>
                    <textarea
                      className="rr-insp-textarea"
                      rows={5}
                      value={documentEdits[activeBlock.id] ?? activeBlock.text}
                      onChange={(e) => handleParagraphChange(activeBlock.id, e.target.value)}
                      placeholder="Directly edit block text..."
                    />
                  </div>
                )}

                {/* Section 3: Click to Insert Jinja2 Template Variable */}
                <div className="rr-insp-section">
                  <div className="rr-insp-section__title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Insert Variable Tag</span>
                    {copiedTag && <span style={{ color: '#16a34a', textTransform: 'none' }}>Copied!</span>}
                  </div>
                  <div className="rr-var-chips">
                    {JINJA_TAGS.map(v => (
                      <button
                        key={v.tag}
                        type="button"
                        className="rr-var-chip"
                        onClick={() => {
                          if (activeBlock) {
                            const curr = documentEdits[activeBlock.id] ?? activeBlock.text;
                            handleParagraphChange(activeBlock.id, `${curr} ${v.tag}`);
                          }
                          copyTag(v.tag);
                        }}
                        title={v.desc}
                      >
                        <code>{v.tag}</code>
                        <span>{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 4: Document Format / Category & Statutory Legal Scope */}
                <div className="rr-insp-section">
                  <div className="rr-insp-section__title">Document Format / Category</div>
                  <select
                    className="rr-insp-select"
                    value={formData.category || 'PROCEEDINGS'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="PROCEEDINGS">செயல்முறைகள் (Official Proceedings / Order)</option>
                    <option value="MEMORANDUM">குறிப்பாணை (Memorandum / Memo)</option>
                    <option value="OFFICE_NOTE">அலுவலகக் குறிப்பு (Office Note)</option>
                    <option value="WARRANT">வாரண்ட் (Recovery Warrant)</option>
                    <option value="DEMAND_NOTICE">கோரிக்கை அறிவிப்பு (Demand Notice)</option>
                    <option value="CUSTOM">தனிப்பயன் படிவம் (Custom Format)</option>
                  </select>
                </div>

                <div className="rr-insp-section">
                  <div className="rr-insp-section__title">Statutory / Legal Scope</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '4px' }}>
                    Auto-identified dynamically by LLM from incoming requisition order
                  </div>
                  <input
                    type="text"
                    className="rr-insp-textarea"
                    style={{ padding: '6px 10px', fontSize: '0.8rem', resize: 'none' }}
                    value={formData.department_type || 'GENERAL_RR'}
                    onChange={(e) => setFormData({ ...formData, department_type: e.target.value })}
                    placeholder="e.g. GENERAL_RR, CUSTOMS_142, TNRERA, MCOP_174"
                  />
                </div>

                {/* Section 5: Slot Instructions for AI Worker */}
                <div className="rr-insp-section">
                  <div className="rr-insp-section__title">Slot Instructions for LLM Worker</div>
                  <textarea
                    className="rr-insp-textarea"
                    rows={4}
                    value={formData.slot_instructions}
                    onChange={(e) => setFormData({ ...formData, slot_instructions: e.target.value })}
                    placeholder="Instructions for LLM slot filling..."
                  />
                </div>
              </div>
            </aside>
          );
        })()}
      </div>

      {/* --- IN-APP CONFIRMATION MODAL (Replaces Browser Dialog) --- */}
      {confirmModal.isOpen && (
        <div className="rr-confirm-backdrop" onClick={closeConfirmModal}>
          <div className="rr-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="rr-confirm-header">
              <div className={`rr-confirm-icon-wrap ${confirmModal.confirmType}`}>
                <AlertCircle size={20} />
              </div>
              <div className="rr-confirm-title">{confirmModal.title}</div>
            </div>
            <div className="rr-confirm-body">
              {confirmModal.message}
            </div>
            <div className="rr-confirm-footer">
              <button
                type="button"
                className="rr-confirm-btn-cancel"
                onClick={closeConfirmModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`rr-confirm-btn-action ${confirmModal.confirmType}`}
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
