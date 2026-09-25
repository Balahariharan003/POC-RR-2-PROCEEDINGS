import React from 'react';
import { User, ShieldCheck, Lock, Mail, Phone, Building, Briefcase, Key } from 'lucide-react';

export default function OfficialProfile({ currentUser }) {
  const officer = {
    fullNameEn: currentUser?.name || 'S. Ramanathan',
    fullNameTa: 'எஸ். இராமநாதன்',
    officialEmail: currentUser?.email || 'ramanathan@tn.gov.in',
    mobileNumber: '9842011222',
    departmentUnit: 'D Section',
    designation: currentUser?.role === 'admin' ? 'District Collector' : 'Department Officer',
    officerId: 'OFF-USER-001',
    accessRole: currentUser?.role === 'admin' ? 'System Administrator' : 'Department User',
    assignedOffice: 'Erode District Collectorate, Tamil Nadu'
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

        {/* View Only Badge */}
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
      </div>

      {/* Card 1: User Data */}
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
            color: '#687991'
          }}>
            Read Only
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <User size={16} color="#687991" />
              <span>{officer.fullNameEn}</span>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57',
              fontFamily: "'Noto Sans Tamil', sans-serif"
            }}>
              <User size={16} color="#687991" />
              <span>{officer.fullNameTa}</span>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <Mail size={16} color="#687991" />
              <span>{officer.officialEmail}</span>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <Phone size={16} color="#687991" />
              <span>{officer.mobileNumber}</span>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <Building size={16} color="#687991" />
              <span>{officer.departmentUnit}</span>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#102C57'
            }}>
              <Briefcase size={16} color="#687991" />
              <span>{officer.designation}</span>
            </div>
          </div>
        </div>
      </div>

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
