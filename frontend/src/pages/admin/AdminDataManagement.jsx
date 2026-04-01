import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Download, Upload, Database, Loader2, AlertTriangle, CheckCircle,
  FileSpreadsheet, Users, Package, ShoppingCart, Shield, Boxes,
  RefreshCw, FileDown, FileUp, Info
} from 'lucide-react';

const DATA_SOURCE_ICONS = {
  customers: Users,
  dealers: Users,
  orders: ShoppingCart,
  warranties: Shield,
  master_skus: Package,
  inventory: Boxes
};

const DATA_SOURCE_COLORS = {
  customers: "bg-blue-500",
  dealers: "bg-orange-500",
  orders: "bg-green-500",
  warranties: "bg-purple-500",
  master_skus: "bg-cyan-500",
  inventory: "bg-pink-500"
};

export default function AdminDataManagement() {
  const { token } = useAuth();
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

  const getSourceInfo = (key) => dataSources.find(s => s.key === key);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Management</h1>
          <p className="text-slate-400">Export and import CRM data in Excel format</p>
        </div>

        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="excel" className="data-[state=active]:bg-slate-700">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel Import/Export
            </TabsTrigger>
            <TabsTrigger value="backup" className="data-[state=active]:bg-slate-700">
              <Database className="w-4 h-4 mr-2" />
              Full Database Backup
            </TabsTrigger>
          </TabsList>

          {/* Excel Import/Export Tab */}
          <TabsContent value="excel" className="space-y-6 mt-6">
            {/* Data Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingSources ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                dataSources.map(source => {
                  const Icon = DATA_SOURCE_ICONS[source.key] || Database;
                  const colorClass = DATA_SOURCE_COLORS[source.key] || "bg-slate-500";
                  
                  return (
                    <Card key={source.key} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-white text-lg">{source.name}</CardTitle>
                              <p className="text-sm text-slate-400">{source.record_count} records</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-cyan-600 text-cyan-400 hover:bg-cyan-900/30"
                            onClick={() => handleExportExcel(source.key)}
                            disabled={exporting[source.key]}
                            data-testid={`export-${source.key}-btn`}
                          >
                            {exporting[source.key] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <FileDown className="w-4 h-4 mr-1" />
                                Export
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => handleDownloadTemplate(source.key)}
                            disabled={exporting[`template_${source.key}`]}
                            data-testid={`template-${source.key}-btn`}
                          >
                            {exporting[`template_${source.key}`] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <FileSpreadsheet className="w-4 h-4 mr-1" />
                                Template
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="text-xs text-slate-500">
                          Fields: {source.fields.slice(0, 4).join(', ')}
                          {source.fields.length > 4 && ` +${source.fields.length - 4} more`}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Import Section */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-green-400" />
                  Import Excel Data
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Upload an Excel file to import or update data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-300">Data Source</Label>
                    <Select value={selectedSource} onValueChange={setSelectedSource}>
                      <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select data type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {dataSources.map(source => (
                          <SelectItem key={source.key} value={source.key} className="text-white">
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-300">Import Mode</Label>
                    <Select value={importMode} onValueChange={setImportMode}>
                      <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="merge" className="text-white">
                          Merge (Add new, update existing)
                        </SelectItem>
                        <SelectItem value="replace" className="text-white">
                          Replace (Clear all, then import)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-300">Excel File</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="mt-1 bg-slate-700 border-slate-600 text-white"
                      data-testid="excel-file-input"
                    />
                  </div>
                </div>

                {importMode === 'replace' && (
                  <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">
                      Warning: Replace mode will DELETE ALL existing {selectedSource?.replace('_', ' ')} data before importing.
                      Make sure you have a backup!
                    </p>
                  </div>
                )}

                {selectedSource && (
                  <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="font-medium mb-1">Required fields for {selectedSource.replace('_', ' ')}:</p>
                        <p>{getSourceInfo(selectedSource)?.required_fields?.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleImportExcel} 
                  disabled={importing || !selectedFile || !selectedSource}
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                  data-testid="import-excel-btn"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Import Results */}
            {importResults && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Import Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-900/30 border border-green-700 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-400">{importResults.imported}</p>
                      <p className="text-sm text-green-300">New Records</p>
                    </div>
                    <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-400">{importResults.updated}</p>
                      <p className="text-sm text-blue-300">Updated</p>
                    </div>
                    <div className="bg-slate-700 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-slate-300">{importResults.skipped}</p>
                      <p className="text-sm text-slate-400">Skipped</p>
                    </div>
                    <div className="bg-cyan-900/30 border border-cyan-700 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-cyan-400">{importResults.total_processed}</p>
                      <p className="text-sm text-cyan-300">Total Processed</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      Mode: {importResults.mode}
                    </Badge>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      Source: {importResults.data_source}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  How to Use Excel Import/Export
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-white mb-2">To Export Data:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Click "Export" on any data source card above</li>
                      <li>An Excel file will download with all current data</li>
                      <li>File includes a "Field_Info" sheet with field descriptions</li>
                    </ol>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">To Import Data:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Download a template or export existing data first</li>
                      <li>Add/modify data in Excel (keep column headers)</li>
                      <li>Leave "id" empty for new records (auto-generated)</li>
                      <li>Fill all required fields (shown in blue box)</li>
                      <li>Select data source and import mode</li>
                      <li>Upload and click "Import Data"</li>
                    </ol>
                  </div>
                </div>
                <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-300">
                    <strong>Tip:</strong> Use "Merge" mode to safely add new records without affecting existing data.
                    Use "Replace" mode only when you want to completely refresh the data.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Full Database Backup Tab */}
          <TabsContent value="backup" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Card */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-cyan-400" />
                    Export Full Database
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Download ALL CRM data as a JSON file for complete backup
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-300">
                    This will export all collections including users, warranties, tickets, 
                    inventory, production data, dealers, orders, and more.
                  </p>
                  <Button 
                    onClick={handleLegacyExport} 
                    disabled={legacyExporting}
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                    data-testid="full-export-btn"
                  >
                    {legacyExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Full Backup (JSON)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Import Card */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-400" />
                    Restore from Backup
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Upload a JSON backup file to restore or migrate data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Select JSON File</Label>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={(e) => setLegacyFile(e.target.files[0])}
                      className="mt-1 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="clearExisting" 
                      checked={clearExisting}
                      onCheckedChange={setClearExisting}
                      className="border-slate-500"
                    />
                    <Label htmlFor="clearExisting" className="text-slate-300 text-sm">
                      Replace existing data (clear all before import)
                    </Label>
                  </div>
                  
                  {clearExisting && (
                    <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300">
                        Warning: This will delete ALL existing data before importing. 
                        Make sure you have a backup!
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleLegacyImport} 
                    disabled={legacyImporting || !legacyFile}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {legacyImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Restore Backup
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Legacy Import Results */}
            {legacyResults && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Restore Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(legacyResults).map(([collection, result]) => (
                      <div key={collection} className="bg-slate-700/50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-white">{collection}</p>
                        <p className="text-xs text-slate-400">
                          Imported: {result.imported}
                          {result.skipped > 0 && `, Skipped: ${result.skipped}`}
                        </p>
                        <p className="text-xs text-cyan-400">{result.mode}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
