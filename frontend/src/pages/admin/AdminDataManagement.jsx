import React, { useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Download, Upload, Database, Loader2, AlertTriangle, CheckCircle
} from 'lucide-react';

export default function AdminDataManagement() {
  const { token } = useAuth();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/admin/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }
    
    setImporting(true);
    setImportResults(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clear_existing', clearExisting.toString());
      
      const response = await axios.post(`${API}/admin/bulk-import`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setImportResults(response.data.results);
      toast.success('Data imported successfully');
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Management</h1>
          <p className="text-slate-400">Export and import CRM data for backup or migration</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-cyan-400" />
                Export Data
              </CardTitle>
              <CardDescription className="text-slate-400">
                Download all CRM data as a JSON file for backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300">
                This will export all collections including users, warranties, tickets, 
                inventory, production data, and more.
              </p>
              <Button 
                onClick={handleExport} 
                disabled={exporting}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Export
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
                Import Data
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload a JSON export file to restore or migrate data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Select JSON File</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
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
                onClick={handleImport} 
                disabled={importing || !selectedFile}
                className="w-full bg-green-600 hover:bg-green-700"
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
        </div>

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
                {Object.entries(importResults).map(([collection, result]) => (
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

        {/* Instructions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              Migration Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <div>
              <h3 className="font-semibold text-white mb-2">To migrate data to production:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Export data from the source environment using "Download Export"</li>
                <li>Deploy your app to production</li>
                <li>Login to production as admin</li>
                <li>Go to Data Management page</li>
                <li>Upload the exported JSON file</li>
                <li>Choose whether to merge or replace existing data</li>
                <li>Click "Import Data"</li>
              </ol>
            </div>
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Tip:</strong> Use "merge" mode to add new records without 
                affecting existing data. Use "replace" mode for a clean migration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
