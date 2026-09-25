import React, { useState, useEffect } from 'react';
import { User, ShieldCheck, Lock, Mail, Phone, Building, Briefcase, Key, Pencil, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { readUsers } from '../../services/adminStore.js';
import { saveOfficerAccount } from '../../services/accountStore.js';
import { recordActivity } from '../../services/activityStore.js';

function deriveProfileDetails(currentUser) {
  let savedRecord = null;
  try {
    const users = readUsers();
    savedRecord = users.find(
      u =>
        (currentUser?.id && u.id === currentUser.id) ||
        (currentUser?.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.username && u.username?.toLowerCase() === currentUser.username.toLowerCase()) ||
        (currentUser?.role === 'admin' && u.role === 'admin')
    );
  } catch {
    savedRecord = null;
  }

  const isAdmin = currentUser?.role === 'admin';
  return {
    id: savedRecord?.id || currentUser?.id || (isAdmin ? 'admin-local' : 'user-local'),
    fullNameEn: savedRecord?.name || currentUser?.name || (isAdmin ? 'Local Administrator' : 'S. Ramanathan'),
    fullNameTa: savedRecord?.nameTamil || currentUser?.nameTamil || 'எஸ். இராமநாதன்',
    officialEmail: savedRecord?.email || savedRecord?.username || currentUser?.email || currentUser?.username || (isAdmin ? 'admin@rr.local' : 'ramanathan@tn.gov.in'),
    mobileNumber: savedRecord?.mobileNumber || currentUser?.mobileNumber || '9842011222',
    departmentUnit: savedRecord?.section || currentUser?.section || currentUser?.taluk || 'D Section',
    designation: savedRecord?.designation || currentUser?.designation || (isAdmin ? 'District Collector' : 'Department Officer'),
    officerId: savedRecord?.officerId || currentUser?.officerId || (isAdmin ? 'OFF-ADMIN-001' : 'OFF-USER-001'),
    accessRole: isAdmin ? 'System Administrator' : 'Department User',
    assignedOffice: savedRecord?.office || currentUser?.office || 'Erode District Collectorate, Tamil Nadu'
  };
}

export default function OfficialProfile({ currentUser, onUserUpdated }) {
  const isAdmin = currentUser?.role === 'admin';
  const [officer, setOfficer] = useState(() => deriveProfileDetails(currentUser));
  const [formData, setFormData] = useState(() => deriveProfileDetails(currentUser));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const next = deriveProfileDetails(currentUser);
    setOfficer(next);
    if (!isEditing) {
      setFormData(next);
    }
  }, [currentUser, isEditing]);

  const isDirty =
    formData.fullNameEn.trim() !== officer.fullNameEn.trim() ||
    formData.fullNameTa.trim() !== officer.fullNameTa.trim() ||
    formData.officialEmail.trim().toLowerCase() !== officer.officialEmail.trim().toLowerCase() ||
    formData.mobileNumber.trim() !== officer.mobileNumber.trim() ||
    formData.departmentUnit.trim() !== officer.departmentUnit.trim() ||
    formData.designation.trim() !== officer.designation.trim();

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleStartEdit = () => {
    if (!isAdmin) return;
    setFormData(officer);
    setError('');
    setSuccessMessage('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData(officer);
    setError('');
    setIsEditing(false);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!isAdmin || isSaving || !isDirty) return;
    setError('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      const updatedUser = await saveOfficerAccount({
        id: officer.id,
        role: 'admin',
        officerId: officer.officerId,
        name: formData.fullNameEn,
        nameTamil: formData.fullNameTa,
        identifier: formData.officialEmail,
        mobileNumber: formData.mobileNumber,
        section: formData.departmentUnit,
        designation: formData.designation
      });
      recordActivity('Admin profile updated', { reference: updatedUser.name }, currentUser);
      const nextOfficer = {
        ...officer,
        id: updatedUser.id,
        fullNameEn: updatedUser.name,
        fullNameTa: updatedUser.nameTamil || '',
        officialEmail: updatedUser.email || updatedUser.username,
        mobileNumber: updatedUser.mobileNumber,
        departmentUnit: updatedUser.section,
        designation: updatedUser.designation || formData.designation
      };
      setOfficer(nextOfficer);
      setFormData(nextOfficer);
      setIsEditing(false);
      setSuccessMessage('Profile details updated successfully.');
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          ...updatedUser,
          role: 'admin'
        });
      }
    } catch (err) {
      setError(err?.message || 'Unable to save profile details. Please verify your inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputBoxStyle = (editable) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: editable ? '#FFFFFF' : '#FEFAF6',
    border: editable ? '1.5px solid #102C57' : '1px solid #EADBC8',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#102C57',
    transition: 'all 0.15s ease'
  });

  const rawInputStyle = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#102C57',
    fontFamily: 'inherit',
    padding: 0
  };

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      width: '100%',
      padding: '0.5rem 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Page Title & Subtitle Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#FEFAF6',
            border: '1px solid #EADBC8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#102C57',
            flexShrink: 0
          }}>
            <User size={22} color="#102C57" />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#102C57',
              margin: 0,
              letterSpacing: '-0.01em',
              fontFamily: "'Georgia', 'Noto Sans Tamil', serif"
            }}>
              Official Profile
            </h1>
            <p style={{
              fontSize: '0.9rem',
              color: '#687991',
              margin: '4px 0 0 0'
            }}>
              Official credentials, contact information, and departmental assignment.
            </p>
          </div>
        </div>

        {/* Action Button for Admin OR View Only Badge for Regular User */}
        {isAdmin ? (
          !isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#102C57',
                border: '1px solid #102C57',
                borderRadius: '20px',
                padding: '7px 18px',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: '#FEFAF6',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(16, 44, 87, 0.14)'
              }}
            >
              <Pencil size={13} color="#FEFAF6" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #102C57',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '0.825rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <Pencil size={13} color="#102C57" />
              <span>Editing Profile</span>
            </div>
          )
        ) : (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DAC0A3',
            borderRadius: '20px',
            padding: '6px 16px',
            fontSize: '0.825rem',
            fontWeight: 700,
            color: '#102C57',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <Lock size={13} color="#102C57" />
            <span>View Only</span>
          </div>
        )}
      </div>

      {successMessage && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #102C57',
            borderRadius: '10px',
            padding: '0.75rem 1.1rem',
            color: '#102C57',
            fontSize: '0.875rem',
            fontWeight: 700
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#102C57" />
            {successMessage}
          </span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setSuccessMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#102C57', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FFF5F5',
            border: '1px solid #FEB2B2',
            borderRadius: '10px',
            padding: '0.75rem 1.1rem',
            color: '#9B1C1C',
            fontSize: '0.875rem',
            fontWeight: 700
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Card 1: User Data */}
      <form
        onSubmit={handleSaveProfile}
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EADBC8',
          borderRadius: '14px',
          padding: '1.75rem',
          boxShadow: '0 2px 10px rgba(16, 44, 87, 0.04)'
        }}
      >
        {/* Card Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #F3E9DD'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 800, color: '#102C57' }}>
            <User size={18} color="#102C57" />
            <span>User Data</span>
          </div>
          <span style={{
            backgroundColor: '#FEFAF6',
            border: '1px solid #EADBC8',
            borderRadius: '12px',
            padding: '3px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isAdmin && isEditing ? '#102C57' : '#687991'
          }}>
            {isAdmin ? (isEditing ? 'Editing Mode' : 'Admin Editable') : 'Read Only'}
          </span>
        </div>

        {/* Form Fields Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem 1.5rem'
        }}>
          {/* Field 1: Full Name (English) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              FULL NAME (ENGLISH) *
            </label>
            <div style={inputBoxStyle(isAdmin && isEditing)}>
              <User size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="text"
                  required
                  aria-label="Full Name (English)"
                  value={formData.fullNameEn}
                  onChange={e => handleFieldChange('fullNameEn', e.target.value)}
                  style={rawInputStyle}
                />
              ) : (
                <span>{officer.fullNameEn}</span>
              )}
            </div>
          </div>

          {/* Field 2: Full Name (Tamil) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              FULL NAME (TAMIL - OPTIONAL)
            </label>
            <div style={{ ...inputBoxStyle(isAdmin && isEditing), fontFamily: "'Noto Sans Tamil', sans-serif" }}>
              <User size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="text"
                  lang="ta"
                  aria-label="Full Name (Tamil)"
                  value={formData.fullNameTa}
                  onChange={e => handleFieldChange('fullNameTa', e.target.value)}
                  style={{ ...rawInputStyle, fontFamily: "'Noto Sans Tamil', sans-serif" }}
                />
              ) : (
                <span>{officer.fullNameTa}</span>
              )}
            </div>
          </div>

          {/* Field 3: Official Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              OFFICIAL EMAIL *
            </label>
            <div style={inputBoxStyle(isAdmin && isEditing)}>
              <Mail size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="text"
                  required
                  aria-label="Official Email"
                  value={formData.officialEmail}
                  onChange={e => handleFieldChange('officialEmail', e.target.value)}
                  style={rawInputStyle}
                />
              ) : (
                <span>{officer.officialEmail}</span>
              )}
            </div>
          </div>

          {/* Field 4: Official Mobile / Phone Number */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              OFFICIAL MOBILE / PHONE NUMBER
            </label>
            <div style={inputBoxStyle(isAdmin && isEditing)}>
              <Phone size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="tel"
                  required
                  aria-label="Official Mobile / Phone Number"
                  value={formData.mobileNumber}
                  onChange={e => handleFieldChange('mobileNumber', e.target.value)}
                  style={rawInputStyle}
                />
              ) : (
                <span>{officer.mobileNumber}</span>
              )}
            </div>
          </div>

          {/* Field 5: Department / Unit */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              DEPARTMENT / UNIT
            </label>
            <div style={inputBoxStyle(isAdmin && isEditing)}>
              <Building size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="text"
                  required
                  aria-label="Department / Unit"
                  value={formData.departmentUnit}
                  onChange={e => handleFieldChange('departmentUnit', e.target.value)}
                  style={rawInputStyle}
                />
              ) : (
                <span>{officer.departmentUnit}</span>
              )}
            </div>
          </div>

          {/* Field 6: Designation */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              DESIGNATION
            </label>
            <div style={inputBoxStyle(isAdmin && isEditing)}>
              <Briefcase size={16} color="#687991" />
              {isAdmin && isEditing ? (
                <input
                  type="text"
                  aria-label="Designation"
                  value={formData.designation}
                  onChange={e => handleFieldChange('designation', e.target.value)}
                  style={rawInputStyle}
                />
              ) : (
                <span>{officer.designation}</span>
              )}
            </div>
          </div>
        </div>

        {/* Save / Cancel Actions for Admin */}
        {isAdmin && isEditing && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '1.5rem',
            paddingTop: '1.1rem',
            borderTop: '1px solid #F3E9DD'
          }}>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCancelEdit}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #DAC0A3',
                backgroundColor: '#FFFFFF',
                color: '#102C57',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              style={{
                padding: '0.6rem 1.35rem',
                borderRadius: '8px',
                border: '1px solid #102C57',
                backgroundColor: isSaving || !isDirty ? '#687991' : '#102C57',
                color: '#FEFAF6',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: isSaving || !isDirty ? 'not-allowed' : 'pointer'
              }}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </form>

      {/* Card 2: System & Administrative Assignment */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EADBC8',
        borderRadius: '14px',
        padding: '1.75rem',
        boxShadow: '0 2px 10px rgba(16, 44, 87, 0.04)'
      }}>
        {/* Card Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #F3E9DD'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 800, color: '#102C57' }}>
            <ShieldCheck size={18} color="#102C57" />
            <span>System &amp; Administrative Assignment</span>
          </div>
          <span style={{
            backgroundColor: '#FEFAF6',
            border: '1px solid #EADBC8',
            borderRadius: '12px',
            padding: '3px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#687991',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Lock size={12} color="#687991" />
            <span>System Restricted</span>
          </span>
        </div>

        {/* Form Fields Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem 1.5rem'
        }}>
          {/* Field 1: Officer ID */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              OFFICER ID
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={16} color="#687991" />
                <span>{officer.officerId}</span>
              </div>
              <Lock size={14} color="#94A3B8" />
            </div>
          </div>

          {/* Field 2: Access Role */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              ACCESS ROLE
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={16} color="#687991" />
                <span>{officer.accessRole}</span>
              </div>
              <Lock size={14} color="#94A3B8" />
            </div>
          </div>

          {/* Field 3: Assigned Department / Office (Full Width) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#687991',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              ASSIGNED DEPARTMENT / OFFICE
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={16} color="#687991" />
                <span>{officer.assignedOffice}</span>
              </div>
              <Lock size={14} color="#94A3B8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
