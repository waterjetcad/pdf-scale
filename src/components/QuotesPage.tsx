'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Ruler, FileText, Printer, Plus, Trash2, ArrowLeft,
  DollarSign, Hash, Building2, User, Calendar, MapPin,
  Phone, Mail, ClipboardList, Receipt, ImagePlus, X
} from 'lucide-react';

// ── Types ──

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  source: 'takeoff' | 'custom';
};

type CompanyInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

type CustomerInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

type ProjectInfo = {
  name: string;
  address: string;
  quoteNumber: string;
  date: string;
};

// ── Helpers ──

function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.floor(Math.random() * 900 + 100);
  return `Q-${y}${m}${d}-${r}`;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Unit Options ──

const UNIT_OPTIONS = [
  { value: 'ea', label: 'ea' },
  { value: 'ft', label: 'ft' },
  { value: 'ft²', label: 'ft²' },
  { value: 'lin ft', label: 'lin ft' },
  { value: 'sq ft', label: 'sq ft' },
  { value: 'in', label: 'in' },
  { value: 'yd', label: 'yd' },
  { value: 'yd²', label: 'yd²' },
  { value: 'm', label: 'm' },
  { value: 'm²', label: 'm²' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'hr', label: 'hr' },
  { value: 'lot', label: 'lot' },
  { value: 'ls', label: 'ls' },
];

// ── Component ──

export function QuotesPage() {
  // ----- State -----
  const [company, setCompany] = useState<CompanyInfo>({
    name: '', address: '', phone: '', email: '',
  });

  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '', address: '', phone: '', email: '',
  });

  const [project, setProject] = useState<ProjectInfo>({
    name: '', address: '', quoteNumber: generateQuoteNumber(), date: today(),
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState(
    'This quote is valid for 30 days from the date of issue.\nPayment terms: Net 30.\nAll prices are in USD.'
  );
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ----- Load takeoff data from localStorage -----
  useEffect(() => {
    try {
      const raw = localStorage.getItem('easyarch_quote_data');
      if (raw) {
        const data = JSON.parse(raw);
        const items: LineItem[] = [];
        const unit: string = data.measurementUnit || 'ft';

        if (data.measurements) {
          // Aggregate all linear and area measurements into single line items
          let totalLinear = 0;
          let linearCount = 0;
          let totalArea = 0;
          let areaCount = 0;

          Object.entries(data.measurements).forEach(([, pageMeasurements]) => {
            (pageMeasurements as Array<{ id: string; type: string; value: number }>).forEach((m) => {
              if (m.type === 'area') {
                totalArea += m.value;
                areaCount++;
              } else {
                totalLinear += m.value;
                linearCount++;
              }
            });
          });

          if (linearCount > 0) {
            items.push({
              id: `takeoff-linear-total`,
              description: `Total Linear Footage (${linearCount} measurement${linearCount !== 1 ? 's' : ''})`,
              quantity: parseFloat(totalLinear.toFixed(2)),
              unit: unit,
              unitPrice: 0,
              total: 0,
              source: 'takeoff',
            });
          }

          if (areaCount > 0) {
            items.push({
              id: `takeoff-area-total`,
              description: `Total Area (${areaCount} measurement${areaCount !== 1 ? 's' : ''})`,
              quantity: parseFloat(totalArea.toFixed(2)),
              unit: `${unit}²`,
              unitPrice: 0,
              total: 0,
              source: 'takeoff',
            });
          }
        }

        setLineItems(items);
        if (data.fileName) setPdfFileName(data.fileName);
      }
    } catch {
      // silently ignore parse errors
    }
    setLoaded(true);
  }, []);

  // ----- Derived values -----
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  // ----- Handlers -----

  const updateLineItem = useCallback((id: string, updates: Partial<LineItem>) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  }, []);

  const deleteLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const addCustomItem = useCallback(() => {
    setLineItems(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        description: '',
        quantity: 1,
        unit: 'ea',
        unitPrice: 0,
        total: 0,
        source: 'custom',
      },
    ]);
  }, []);

  const handlePrint = () => window.print();

  // ----- Logo handlers -----
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoFile(file);
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(true);
  };

  const handleLogoDragLeave = () => setLogoDragOver(false);

  // ----- Format currency -----
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ----- Render -----

  if (!loaded) {
    return (
      <div className="quote-loading">
        <div className="quote-loading-spinner" />
        <span>Loading quote data…</span>
      </div>
    );
  }

  return (
    <div className="quote-page">
      {/* ===== Top Bar (hidden when printing) ===== */}
      <div className="quote-topbar no-print">
        <div className="quote-topbar-left">
          <Link href="/workspace" className="quote-back-btn">
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </Link>
          {pdfFileName && (
            <span className="quote-source-badge">
              <FileText className="w-3.5 h-3.5" />
              {pdfFileName}
            </span>
          )}
        </div>
        <div className="quote-topbar-right">
          <button className="quote-print-btn" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Hidden logo file input */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleLogoFile(file);
        }}
      />

      {/* ===== Printable Area ===== */}
      <div className="quote-content" ref={printRef}>
        {/* Header */}
        <div className="quote-header">
          <div className="quote-header-brand">
            {/* Logo Area */}
            {logoUrl ? (
              <div className="quote-logo-container">
                <img src={logoUrl} alt="Company Logo" className="quote-logo-img" />
                <button
                  className="quote-logo-remove no-print"
                  onClick={() => setLogoUrl(null)}
                  title="Remove logo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className={`quote-logo-dropzone no-print ${logoDragOver ? 'quote-logo-dropzone-active' : ''}`}
                onClick={() => logoInputRef.current?.click()}
                onDrop={handleLogoDrop}
                onDragOver={handleLogoDragOver}
                onDragLeave={handleLogoDragLeave}
              >
                <ImagePlus className="w-5 h-5" />
                <span>Drop logo here<br />or click to upload</span>
              </div>
            )}
            <div>
              <h1 className="quote-title">Quote</h1>
              <p className="quote-subtitle">Professional Estimate</p>
            </div>
          </div>
          <div className="quote-header-meta">
            <div className="quote-meta-row">
              <Hash className="w-3.5 h-3.5" />
              <span className="quote-meta-label">Quote #</span>
              <input
                className="quote-meta-input"
                value={project.quoteNumber}
                onChange={e => setProject(p => ({ ...p, quoteNumber: e.target.value }))}
              />
            </div>
            <div className="quote-meta-row">
              <Calendar className="w-3.5 h-3.5" />
              <span className="quote-meta-label">Date</span>
              <input
                className="quote-meta-input"
                type="date"
                value={project.date}
                onChange={e => setProject(p => ({ ...p, date: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Company + Customer Info */}
        <div className="quote-info-grid">
          {/* Company */}
          <div className="quote-info-card">
            <div className="quote-info-card-header">
              <Building2 className="w-4 h-4" />
              <span>From (Your Company)</span>
            </div>
            <div className="quote-info-fields">
              <div className="quote-field">
                <label>Company Name</label>
                <input
                  placeholder="Your Company Name"
                  value={company.name}
                  onChange={e => setCompany(c => ({ ...c, name: e.target.value }))}
                />
              </div>
              <div className="quote-field">
                <label><MapPin className="w-3 h-3" /> Address</label>
                <input
                  placeholder="123 Main St, City, State ZIP"
                  value={company.address}
                  onChange={e => setCompany(c => ({ ...c, address: e.target.value }))}
                />
              </div>
              <div className="quote-field-row">
                <div className="quote-field">
                  <label><Phone className="w-3 h-3" /> Phone</label>
                  <input
                    placeholder="(555) 123-4567"
                    value={company.phone}
                    onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))}
                  />
                </div>
                <div className="quote-field">
                  <label><Mail className="w-3 h-3" /> Email</label>
                  <input
                    placeholder="info@company.com"
                    value={company.email}
                    onChange={e => setCompany(c => ({ ...c, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="quote-info-card">
            <div className="quote-info-card-header">
              <User className="w-4 h-4" />
              <span>To (Customer)</span>
            </div>
            <div className="quote-info-fields">
              <div className="quote-field">
                <label>Customer Name</label>
                <input
                  placeholder="Customer / Company Name"
                  value={customer.name}
                  onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                />
              </div>
              <div className="quote-field">
                <label><MapPin className="w-3 h-3" /> Address</label>
                <input
                  placeholder="456 Oak Ave, City, State ZIP"
                  value={customer.address}
                  onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))}
                />
              </div>
              <div className="quote-field-row">
                <div className="quote-field">
                  <label><Phone className="w-3 h-3" /> Phone</label>
                  <input
                    placeholder="(555) 987-6543"
                    value={customer.phone}
                    onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                  />
                </div>
                <div className="quote-field">
                  <label><Mail className="w-3 h-3" /> Email</label>
                  <input
                    placeholder="client@email.com"
                    value={customer.email}
                    onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="quote-project-bar">
          <div className="quote-field" style={{ flex: 1 }}>
            <label><ClipboardList className="w-3 h-3" /> Project Name</label>
            <input
              placeholder="Project name or description"
              value={project.name}
              onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="quote-field" style={{ flex: 1 }}>
            <label><MapPin className="w-3 h-3" /> Project Address</label>
            <input
              placeholder="Job site address"
              value={project.address}
              onChange={e => setProject(p => ({ ...p, address: e.target.value }))}
            />
          </div>
        </div>

        {/* ===== Line Items Table ===== */}
        <div className="quote-table-section">
          <div className="quote-table-header-bar">
            <h2>
              <Ruler className="w-4 h-4" />
              Line Items
            </h2>
            <button className="quote-add-item-btn no-print" onClick={addCustomItem}>
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="quote-table-wrapper">
            <table className="quote-table">
              <thead>
                <tr>
                  <th className="quote-th-num">#</th>
                  <th className="quote-th-desc">Description</th>
                  <th className="quote-th-qty">Qty</th>
                  <th className="quote-th-unit">Unit</th>
                  <th className="quote-th-price">Unit Price</th>
                  <th className="quote-th-total">Total</th>
                  <th className="quote-th-actions no-print"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="quote-table-empty">
                      <div className="quote-table-empty-content">
                        <ClipboardList className="w-5 h-5" />
                        <span>No line items yet. Take measurements in the workspace or add custom items.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className={item.source === 'takeoff' ? 'quote-row-takeoff' : 'quote-row-custom'}>
                    <td className="quote-td-num">{idx + 1}</td>
                    <td>
                      <input
                        className="quote-cell-input quote-cell-desc"
                        value={item.description}
                        onChange={e => updateLineItem(item.id, { description: e.target.value })}
                        placeholder="Item description"
                      />
                    </td>
                    <td>
                      <input
                        className="quote-cell-input quote-cell-qty"
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={e => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <select
                        className="quote-cell-select quote-cell-unit"
                        value={UNIT_OPTIONS.some(o => o.value === item.unit) ? item.unit : '__custom__'}
                        onChange={e => {
                          if (e.target.value !== '__custom__') {
                            updateLineItem(item.id, { unit: e.target.value });
                          }
                        }}
                      >
                        {UNIT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {!UNIT_OPTIONS.some(o => o.value === item.unit) && (
                          <option value="__custom__">{item.unit}</option>
                        )}
                      </select>
                    </td>
                    <td>
                      <div className="quote-cell-price-wrap">
                        <DollarSign className="w-3.5 h-3.5" />
                        <input
                          className="quote-cell-input quote-cell-price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice || ''}
                          onChange={e => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="quote-td-total">
                      {fmt(item.quantity * item.unitPrice)}
                    </td>
                    <td className="no-print">
                      <button
                        className="quote-row-delete"
                        onClick={() => deleteLineItem(item.id)}
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== Totals ===== */}
        <div className="quote-totals-section">
          <div className="quote-notes-area">
            <label className="quote-notes-label">
              <FileText className="w-3.5 h-3.5" />
              Notes &amp; Terms
            </label>
            <textarea
              className="quote-notes-textarea"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="quote-totals-card">
            <div className="quote-total-row">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="quote-total-row quote-tax-row">
              <span className="quote-tax-label">
                Tax
                <input
                  className="quote-tax-input no-print-hide"
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRate || ''}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <span className="quote-tax-pct">%</span>
              </span>
              <span>{fmt(taxAmount)}</span>
            </div>
            <div className="quote-total-row quote-grand-total">
              <span>Total</span>
              <span>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Signature area */}
        <div className="quote-signature-section">
          <div className="quote-signature-block">
            <div className="quote-signature-line" />
            <span>Authorized Signature</span>
          </div>
          <div className="quote-signature-block">
            <div className="quote-signature-line" />
            <span>Date</span>
          </div>
          <div className="quote-signature-block">
            <div className="quote-signature-line" />
            <span>Customer Acceptance</span>
          </div>
        </div>

        {/* Footer */}
        <div className="quote-footer">
          <p>Generated with <strong>Easy Architech</strong> — Professional Blueprint Measurement Tools</p>
        </div>
      </div>
    </div>
  );
}
