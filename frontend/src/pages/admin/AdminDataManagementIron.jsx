import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Download, Upload, Database, Loader2, AlertTriangle, CheckCircle,
  FileSpreadsheet, Users, Package, ShoppingCart, Shield, Boxes,
  FileDown, FileUp, Info, Hash
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const DATA_SOURCE_ICONS = {
  customers: Users,
  parties: Users,
  dealers: Users,
  orders: ShoppingCart,
  warranties: Shield,
  master_skus: Package,
  inventory: Boxes
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const labelCap = { fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron500, display: 'block', marginBottom: 5 };

const TABS = [
  { key: 'excel', label: 'Excel Import/Export', icon: FileSpreadsheet },
  { key: 'serials', label: 'Serial Numbers', icon: Hash },
  { key: 'backup', label: 'Full Database Backup', icon: Database },
];

export default function AdminDataManagement() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('excel');
  const [dataSources, setDataSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedSource, setSelectedSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState({});
  const [importMode, setImportMode] = useState('merge');
  const [importResults, setImportResults] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Legacy JSON import/export states
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyExporting, setLegacyExporting] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [legacyFile, setLegacyFile] = useState(null);
  const [legacyResults, setLegacyResults] = useState(null);

  // Serial Numbers import/export states
  const [serialFile, setSerialFile] = useState(null);
  const [serialImporting, setSerialImporting] = useState(false);
  const [serialExporting, setSerialExporting] = useState(false);
  const [serialImportMode, setSerialImportMode] = useState('merge');
  const [serialImportResults, setSerialImportResults] = useState(null);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      const response = await axios.get(`${API}/admin/excel/sources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDataSources(response.data);
      if (response.data.length > 0) {
        setSelectedSource(response.data[0].key);
      }
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
      toast.error('Failed to load data sources');
    } finally {
      setLoadingSources(false);
    }
  };

  const handleExportExcel = async (sourceKey) => {
    setExporting(prev => ({ ...prev, [sourceKey]: true }));
    try {
      const response = await axios.get(`${API}/admin/excel/export/${sourceKey}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${sourceKey}_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${sourceKey.replace('_', ' ')} data exported successfully`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(prev => ({ ...prev, [sourceKey]: false }));
    }
  };

  const handleDownloadTemplate = async (sourceKey) => {
    setExporting(prev => ({ ...prev, [`template_${sourceKey}`]: true }));
    try {
      const response = await axios.get(`${API}/admin/excel/template/${sourceKey}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${sourceKey}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Template downloaded');
    } catch (error) {
      console.error('Template download failed:', error);
      toast.error('Failed to download template');
    } finally {
      setExporting(prev => ({ ...prev, [`template_${sourceKey}`]: false }));
    }
  };

  const handleImportExcel = async () => {
    if (!selectedFile || !selectedSource) {
      toast.error('Please select a file and data source');
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', importMode);

      const response = await axios.post(`${API}/admin/excel/import/${selectedSource}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResults(response.data);
      toast.success('Data imported successfully');
      fetchDataSources(); // Refresh counts
      setSelectedFile(null);
    } catch (error) {
      console.error('Import failed:', error);
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Failed to import data. Check file format.');
      }
    } finally {
      setImporting(false);
    }
  };

  // Legacy JSON handlers
  const handleLegacyExport = async () => {
    setLegacyExporting(true);
    try {
      const response = await axios.get(`${API}/admin/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Full database exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setLegacyExporting(false);
    }
  };

  const handleLegacyImport = async () => {
    if (!legacyFile) {
      toast.error('Please select a file to import');
      return;
    }

    setLegacyImporting(true);
    setLegacyResults(null);

    try {
      const formData = new FormData();
      formData.append('file', legacyFile);
      formData.append('clear_existing', clearExisting.toString());

      const response = await axios.post(`${API}/admin/bulk-import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setLegacyResults(response.data.results);
      toast.success('Data imported successfully');
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to import data');
    } finally {
      setLegacyImporting(false);
    }
  };

  const handleSerialExport = async () => {
    setSerialExporting(true);
    try {
      const response = await axios.get(`${API}/admin/serial-numbers/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `serial_numbers_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Serial numbers exported successfully');
    } catch (error) {
      toast.error('Failed to export serial numbers');
    } finally {
      setSerialExporting(false);
    }
  };

  const handleSerialTemplate = async () => {
    try {
      const response = await axios.get(`${API}/admin/serial-numbers/template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'serial_numbers_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleSerialImport = async () => {
    if (!serialFile) {
      toast.error('Please select a file');
      return;
    }
    setSerialImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', serialFile);
      formData.append('mode', serialImportMode);
      const response = await axios.post(`${API}/admin/serial-numbers/import`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setSerialImportResults(response.data.results);
      toast.success(response.data.message);
      setSerialFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
    } finally {
      setSerialImporting(false);
    }
  };

  const getSourceInfo = (key) => dataSources.find(s => s.key === key);

  const sectionTitle = (Icon, text, tone) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Icon size={16} color={tone || T.orange} strokeWidth={2} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{text}</div>
    </div>
  );

  return (
    <IronShell title="Data Management" subtitle="EXPORT · IMPORT · BACKUP" onRefresh={fetchDataSources}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = activeTab === tb.key;
          return (
            <button key={tb.key} onClick={() => setActiveTab(tb.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
              <Icon size={14} strokeWidth={2} />{tb.label}
            </button>
          );
        })}
      </div>

      {/* ===================== EXCEL TAB ===================== */}
      {activeTab === 'excel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Data Sources Grid */}
          {loadingSources ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 180 }}>
              <Loader2 className="animate-spin" size={28} color={T.iron400} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {dataSources.map(source => {
                const Icon = DATA_SOURCE_ICONS[source.key] || Database;
                return (
                  <IronCard key={source.key} pad={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                        <Icon size={19} color={T.orange} strokeWidth={1.9} />
                      </div>
                      <div>
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{source.name}</div>
                        <div style={{ ...mono, fontSize: 12, color: T.iron500 }}>{source.record_count} records</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <button
                        style={{ ...btnOutline, flex: 1, padding: '7px 10px' }}
                        onClick={() => handleExportExcel(source.key)}
                        disabled={exporting[source.key]}
                        data-testid={`export-${source.key}-btn`}
                      >
                        {exporting[source.key] ? <Loader2 className="animate-spin" size={14} /> : (<><FileDown size={14} />Export</>)}
                      </button>
                      <button
                        style={{ ...btnOutline, flex: 1, padding: '7px 10px' }}
                        onClick={() => handleDownloadTemplate(source.key)}
                        disabled={exporting[`template_${source.key}`]}
                        data-testid={`template-${source.key}-btn`}
                      >
                        {exporting[`template_${source.key}`] ? <Loader2 className="animate-spin" size={14} /> : (<><FileSpreadsheet size={14} />Template</>)}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: T.iron400 }}>
                      Fields: {source.fields.slice(0, 4).join(', ')}
                      {source.fields.length > 4 && ` +${source.fields.length - 4} more`}
                    </div>
                  </IronCard>
                );
              })}
            </div>
          )}

          {/* Import Section */}
          <IronCard pad={14}>
            {sectionTitle(FileUp, 'Import Excel Data', T.green)}
            <div style={{ fontSize: 12, color: T.iron500, marginBottom: 14 }}>Upload an Excel file to import or update data</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={labelCap}>Data Source</label>
                <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                  {dataSources.length === 0 && <option value="">Select data type</option>}
                  {dataSources.map(source => (
                    <option key={source.key} value={source.key}>{source.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelCap}>Import Mode</label>
                <select value={importMode} onChange={(e) => setImportMode(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                  <option value="merge">Merge (Add new, update existing)</option>
                  <option value="replace">Replace (Clear all, then import)</option>
                </select>
              </div>

              <div>
                <label style={labelCap}>Excel File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ ...inputStyle, width: '100%' }}
                  data-testid="excel-file-input"
                />
              </div>
            </div>

            {importMode === 'replace' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: '#FDEEE6', border: `1px solid ${T.iron200}`, borderColor: '#F6D8BA', borderRadius: 8, marginTop: 14 }}>
                <AlertTriangle size={18} color={T.orangeDeep} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: T.orangeDeep, margin: 0 }}>
                  Warning: Replace mode will DELETE ALL existing {selectedSource?.replace('_', ' ')} data before importing.
                  Make sure you have a backup!
                </p>
              </div>
            )}

            {selectedSource && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: T.blueTint, border: `1px solid #CBE0F0`, borderRadius: 8, marginTop: 14 }}>
                <Info size={16} color={T.blue} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: T.blue }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>Required fields for {selectedSource.replace('_', ' ')}:</div>
                  <div>{getSourceInfo(selectedSource)?.required_fields?.join(', ')}</div>
                </div>
              </div>
            )}

            <button
              onClick={handleImportExcel}
              disabled={importing || !selectedFile || !selectedSource}
              style={{ ...btnPrimary, background: T.green, marginTop: 14, opacity: (importing || !selectedFile || !selectedSource) ? 0.6 : 1 }}
              data-testid="import-excel-btn"
            >
              {importing ? (<><Loader2 className="animate-spin" size={14} />Importing...</>) : (<><Upload size={14} />Import Data</>)}
            </button>
          </IronCard>

          {/* Import Results */}
          {importResults && (
            <IronCard pad={14}>
              {sectionTitle(CheckCircle, 'Import Results', T.green)}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
                {[
                  { v: importResults.imported, l: 'New Records', tone: T.green },
                  { v: importResults.updated, l: 'Updated', tone: T.blue },
                  { v: importResults.skipped, l: 'Skipped', tone: T.iron500 },
                  { v: importResults.total_processed, l: 'Total Processed', tone: T.orange },
                ].map((c) => (
                  <div key={c.l} style={{ border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: c.tone }}>{c.v}</div>
                    <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{c.l}</Caps>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <span style={{ ...inputStyle, padding: '3px 10px', fontSize: 11, color: T.iron700 }}>Mode: {importResults.mode}</span>
                <span style={{ ...inputStyle, padding: '3px 10px', fontSize: 11, color: T.iron700 }}>Source: {importResults.data_source}</span>
              </div>
            </IronCard>
          )}

          {/* Instructions */}
          <IronCard pad={14}>
            {sectionTitle(Info, 'How to Use Excel Import/Export', T.blue)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 12 }}>
              <div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, marginBottom: 6 }}>To Export Data:</div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: T.iron700, lineHeight: 1.7 }}>
                  <li>Click "Export" on any data source card above</li>
                  <li>An Excel file will download with all current data</li>
                  <li>File includes a "Field_Info" sheet with field descriptions</li>
                </ol>
              </div>
              <div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, marginBottom: 6 }}>To Import Data:</div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: T.iron700, lineHeight: 1.7 }}>
                  <li>Download a template or export existing data first</li>
                  <li>Add/modify data in Excel (keep column headers)</li>
                  <li>Leave "id" empty for new records (auto-generated)</li>
                  <li>Fill all required fields (shown in blue box)</li>
                  <li>Select data source and import mode</li>
                  <li>Upload and click "Import Data"</li>
                </ol>
              </div>
            </div>
            <div style={{ padding: 12, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8, marginTop: 14 }}>
              <p style={{ fontSize: 12.5, color: T.voltageText, margin: 0 }}>
                <strong>Tip:</strong> Use "Merge" mode to safely add new records without affecting existing data.
                Use "Replace" mode only when you want to completely refresh the data.
              </p>
            </div>
          </IronCard>
        </div>
      )}

      {/* ===================== SERIAL NUMBERS TAB ===================== */}
      {activeTab === 'serials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Export Card */}
            <IronCard pad={14}>
              {sectionTitle(Download, 'Export Serial Numbers', T.blue)}
              <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>Download all serial numbers with customer and dispatch data</div>
              <p style={{ fontSize: 12.5, color: T.iron700, marginTop: 0 }}>
                Export includes: Serial Number, SKU, Status, Customer Name, Phone, Order ID, Tracking ID, Dispatch Date
              </p>
              <button
                style={{ ...btnPrimary, width: '100%', marginBottom: 10 }}
                onClick={handleSerialExport}
                disabled={serialExporting}
              >
                {serialExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                Export All Serial Numbers
              </button>
              <button style={{ ...btnOutline, width: '100%' }} onClick={handleSerialTemplate}>
                <FileDown size={14} />Download Import Template
              </button>
            </IronCard>

            {/* Import Card */}
            <IronCard pad={14}>
              {sectionTitle(Upload, 'Import Serial Numbers', T.green)}
              <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>Upload Excel file with serial numbers and customer data</div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelCap}>Import Mode</label>
                <select value={serialImportMode} onChange={(e) => setSerialImportMode(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                  <option value="merge">Merge (Add new + Update existing)</option>
                  <option value="update_only">Update Only (Skip new records)</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelCap}>Select Excel File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSerialFile(e.target.files?.[0] || null)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <button
                style={{ ...btnPrimary, background: T.green, width: '100%', opacity: (serialImporting || !serialFile) ? 0.6 : 1 }}
                onClick={handleSerialImport}
                disabled={serialImporting || !serialFile}
              >
                {serialImporting ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                Import Serial Numbers
              </button>

              {serialImportResults && (
                <div style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, marginTop: 12, fontSize: 12.5 }}>
                  <p style={{ margin: '2px 0', color: T.iron700 }}>Total Rows: {serialImportResults.total_rows}</p>
                  <p style={{ margin: '2px 0', color: T.green }}>Imported: {serialImportResults.imported}</p>
                  <p style={{ margin: '2px 0', color: T.blue }}>Updated: {serialImportResults.updated}</p>
                  <p style={{ margin: '2px 0', color: T.voltageText }}>Skipped: {serialImportResults.skipped}</p>
                  {serialImportResults.errors?.length > 0 && (
                    <div style={{ marginTop: 8, padding: 8, background: '#FDEEE6', borderRadius: 6, border: `1px solid #F6D8BA` }}>
                      <p style={{ margin: 0, color: T.orangeDeep, fontWeight: 700 }}>Errors:</p>
                      {serialImportResults.errors.map((err, i) => (
                        <p key={i} style={{ margin: '2px 0', color: T.orangeDeep, fontSize: 11.5 }}>{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </IronCard>
          </div>

          <IronCard pad={14}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Info size={18} color={T.blue} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: T.iron700 }}>
                <div style={{ fontWeight: 700, color: T.iron900, marginBottom: 4 }}>Supported Column Names:</div>
                <div>Serial Number, SKU Code, Model, Status, Customer Name, Name, Phone, Order ID, Order ID/Invoice No, Tracking ID, Dispatch Date, Notes</div>
                <div style={{ marginTop: 8, color: T.iron400 }}>The system will auto-detect columns and match SKU codes to existing Master SKUs.</div>
              </div>
            </div>
          </IronCard>
        </div>
      )}

      {/* ===================== BACKUP TAB ===================== */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Export Card */}
            <IronCard pad={14}>
              {sectionTitle(Download, 'Export Full Database', T.blue)}
              <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>Download ALL CRM data as a JSON file for complete backup</div>
              <p style={{ fontSize: 12.5, color: T.iron700, marginTop: 0 }}>
                This will export all collections including users, warranties, tickets,
                inventory, production data, dealers, orders, and more.
              </p>
              <button
                onClick={handleLegacyExport}
                disabled={legacyExporting}
                style={{ ...btnPrimary, width: '100%', opacity: legacyExporting ? 0.6 : 1 }}
                data-testid="full-export-btn"
              >
                {legacyExporting ? (<><Loader2 className="animate-spin" size={14} />Exporting...</>) : (<><Download size={14} />Download Full Backup (JSON)</>)}
              </button>
            </IronCard>

            {/* Import Card */}
            <IronCard pad={14}>
              {sectionTitle(Upload, 'Restore from Backup', T.green)}
              <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>Upload a JSON backup file to restore or migrate data</div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelCap}>Select JSON File</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setLegacyFile(e.target.files[0])}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  id="clearExisting"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: T.orange, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12.5, color: T.iron700 }}>Replace existing data (clear all before import)</span>
              </label>

              {clearExisting && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8, marginBottom: 12 }}>
                  <AlertTriangle size={18} color={T.orangeDeep} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: T.orangeDeep, margin: 0 }}>
                    Warning: This will delete ALL existing data before importing.
                    Make sure you have a backup!
                  </p>
                </div>
              )}

              <button
                onClick={handleLegacyImport}
                disabled={legacyImporting || !legacyFile}
                style={{ ...btnPrimary, background: T.green, width: '100%', opacity: (legacyImporting || !legacyFile) ? 0.6 : 1 }}
              >
                {legacyImporting ? (<><Loader2 className="animate-spin" size={14} />Restoring...</>) : (<><Upload size={14} />Restore Backup</>)}
              </button>
            </IronCard>
          </div>

          {/* Legacy Import Results */}
          {legacyResults && (
            <IronCard pad={14}>
              {sectionTitle(CheckCircle, 'Restore Results', T.green)}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
                {Object.entries(legacyResults).map(([collection, result]) => (
                  <div key={collection} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 12, borderRadius: 8 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{collection}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>
                      Imported: {result.imported}
                      {result.skipped > 0 && `, Skipped: ${result.skipped}`}
                    </div>
                    <div style={{ fontSize: 11, color: T.orange, marginTop: 2 }}>{result.mode}</div>
                  </div>
                ))}
              </div>
            </IronCard>
          )}
        </div>
      )}
    </IronShell>
  );
}
