import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Scan, ArrowDownLeft, ArrowUpRight, Camera, Video, X, Check,
  Loader2, Image as ImageIcon, Trash2, Upload, QrCode, 
  Package, ChevronRight, AlertCircle, CheckCircle2, ChevronDown,
  Clock, Truck, ImageOff
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

// Courier options
const COURIERS = [
  'Delhivery', 'BlueDart', 'DTDC', 'FedEx', 'Ecom Express', 
  'Xpressbees', 'Shadowfax', 'India Post', 'Other'
];

// Beep sound for successful scan (base64 encoded short beep)
const BEEP_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6YjHxwZmVpeoaSlZeLfXFoZWt0gIqRkYyDd29sbHN+iI6QjYZ9dXFvcnqCiY2NioN7dHFxdXuDiYuLiIN8dnNzdXuCh4qKh4J8dnR0dnyChomIhYF7d3V2eoCEh4eGgn56d3Z4fIGFh4aDgHx4d3h7gISGhYOAfHl3eHuAg4WFg4B9enl5e3+ChISDgH17enp7f4KEhIOAfXt6ent/goSEg4B9e3p6e3+ChISDgH17enp7f4KDg4KAfXt6ent/goODgoB9e3p6e36Bg4OCgH17enp7foGDg4KAfXt6enp+gYODgoB9e3p6en6Bg4OCgH17enp6foGCgoGAfXt6enp+gYKCgYB9e3p6en6BgoKBgH17enp6fn+BgoGAfXx6enp+f4GCgYB9fHp6en5/gYGBgH18enp6fn+BgYGAfXx6enp+f4GBgIB9fHp6en5/gYGAgH18enp6fn+AgYCAfXx7enp+f4CAgIB9fHt6en5/gICAgH18e3p6fn+AgIB/fXx7e3t+f4CAgH99fHt7e35/gIB/f318e3t7fn9/gH99fXx7e3t+f39/f319fHt7e35/f399fX18e3t7fn9/f319fHx7e3t+f39/fX18fHt7e35/f399fXx8fHt7fn9/f319fHx8e3t+f39/fX18fHx7e35+f399fXx8fHx7fn5/f319fHx8fHt+fn5/fX18fHx8fH5+fn99fXx8fHx8fn5+f318fHx8fHx+fn5/fXx8fHx8fH5+fn99fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fH5+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX0=";

export default function GateDashboardMobile() {
  const { token, user } = useAuth();
  
  // Flow state
  const [currentStep, setCurrentStep] = useState('select'); // select, scan, media, complete
  const [scanType, setScanType] = useState(null); // inward or outward
  
  // Scan state
  const [trackingId, setTrackingId] = useState('');
  const [courier, setCourier] = useState('');
  const [customCourier, setCustomCourier] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScannedId, setLastScannedId] = useState(''); // Prevent duplicate scans
  const [scannerStatus, setScannerStatus] = useState(''); // Status message
  
  // Gate log state (after initial scan)
  const [gateLog, setGateLog] = useState(null);
  
  // Media state
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Scanner refs
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  
  // Recent scans
  const [recentScans, setRecentScans] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  // Expected queues (incoming/outgoing)
  const [scheduled, setScheduled] = useState({ incoming: [], outgoing: [] });
  const [pendingUploads, setPendingUploads] = useState([]);
  const [activeTab, setActiveTab] = useState('scan'); // scan, expected, pending
  
  // Upload later dialog
  const [uploadLaterOpen, setUploadLaterOpen] = useState(false);
  const [selectedPendingScan, setSelectedPendingScan] = useState(null);
  const uploadLaterFileRef = useRef(null);
  
  // Initialize audio on mount
  useEffect(() => {
    audioRef.current = new Audio(BEEP_SOUND);
    audioRef.current.volume = 0.5;
  }, []);
  
  // Play beep sound
  const playBeep = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, []);
  
  // Load recent scans on mount
  useEffect(() => {
    loadRecentScans();
    loadScheduled();
    loadPendingUploads();
  }, [token]);
  
  const loadRecentScans = async () => {
    try {
      const res = await axios.get(`${API}/gate/logs?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentScans(res.data || []);
    } catch (error) {
      console.error('Failed to load recent scans:', error);
    } finally {
      setLoadingRecent(false);
    }
  };
  
  const loadScheduled = async () => {
    try {
      const res = await axios.get(`${API}/gate/scheduled`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScheduled({
        incoming: res.data.scheduled_incoming || [],
        outgoing: res.data.scheduled_outgoing || []
      });
    } catch (error) {
      console.error('Failed to load scheduled:', error);
    }
  };
  
  const loadPendingUploads = async () => {
    try {
      // Get scans without complete status (pending media uploads)
      const res = await axios.get(`${API}/gate/logs?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pending = (res.data || []).filter(s => s.status !== 'completed');
      setPendingUploads(pending);
    } catch (error) {
      console.error('Failed to load pending uploads:', error);
    }
  };
  
  // Start barcode detection
  const startBarcodeDetection = useCallback((videoElement) => {
    // Check if BarcodeDetector API is available
    if (!('BarcodeDetector' in window)) {
      setScannerStatus('Auto-scan not supported. Enter ID manually.');
      return;
    }
    
    const barcodeDetector = new window.BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'codabar', 'itf']
    });
    
    setScannerStatus('Scanning for barcodes...');
    
    // Scan every 200ms
    scanIntervalRef.current = setInterval(async () => {
      if (!videoElement || videoElement.readyState !== 4) return;
      
      try {
        const barcodes = await barcodeDetector.detect(videoElement);
        
        if (barcodes.length > 0) {
          const scannedValue = barcodes[0].rawValue;
          
          // Check for duplicate
          if (scannedValue && scannedValue !== lastScannedId) {
            setLastScannedId(scannedValue);
            setTrackingId(scannedValue);
            playBeep();
            toast.success(`Scanned: ${scannedValue}`);
            setScannerStatus(`✓ Scanned: ${scannedValue}`);
            
            // Stop scanning after successful scan
            stopScanner();
          }
        }
      } catch (err) {
        // Ignore detection errors, keep scanning
      }
    }, 200);
  }, [lastScannedId, playBeep]);
  
  // Start camera for scanning
  const startScanner = useCallback(async () => {
    setScannerActive(true);
    setLastScannedId(''); // Reset duplicate check
    setScannerStatus('Starting camera...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      streamRef.current = stream;
      
      // Wait for video element to be in DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(() => {
              // Start barcode detection after video is playing
              startBarcodeDetection(videoRef.current);
            }).catch(console.error);
          };
        }
      }, 100);
      
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Unable to access camera. Please enter tracking ID manually.');
      setScannerActive(false);
      setScannerStatus('');
    }
  }, [startBarcodeDetection]);
  
  // Stop camera
  const stopScanner = useCallback(() => {
    // Clear barcode detection interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
    setScannerStatus('');
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Handle initial scan submission
  const handleScan = async () => {
    if (!trackingId.trim()) {
      toast.error('Please enter or scan a tracking ID');
      return;
    }
    
    const courierName = courier === 'Other' ? customCourier : courier;
    
    setScanning(true);
    try {
      const res = await axios.post(`${API}/gate/scan`, {
        scan_type: scanType,
        tracking_id: trackingId.trim(),
        courier: courierName,
        notes: ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setGateLog(res.data);
      toast.success(`${scanType.toUpperCase()} scan recorded!`);
      
      // Move to media step
      setCurrentStep('media');
      loadRecentScans();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };
  
  // Compress image before upload
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };
    
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Compression failed:', error);
      return file;
    }
  };
  
  // Handle media capture/upload
  const handleMediaCapture = async (e, mediaType = 'image') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    const totalFiles = files.length;
    let uploaded = 0;
    
    for (const file of files) {
      try {
        let fileToUpload = file;
        
        // Compress images
        if (mediaType === 'image' && file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
        }
        
        const formData = new FormData();
        formData.append('gate_log_id', gateLog.id);
        formData.append('tracking_id', gateLog.tracking_id);
        formData.append('movement_type', scanType);
        formData.append('media_type', mediaType);
        formData.append('capture_source', 'camera');
        formData.append('file', fileToUpload, file.name);
        
        const res = await axios.post(`${API}/gate/media/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // Add to local media list
        setMedia(prev => [...prev, res.data.media]);
        
        uploaded++;
        setUploadProgress(Math.round((uploaded / totalFiles) * 100));
        
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setUploading(false);
    setUploadProgress(0);
    
    // Clear input
    if (e.target) e.target.value = '';
    
    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} file(s)`);
    }
  };
  
  // Delete media
  const handleDeleteMedia = async (mediaId) => {
    try {
      await axios.delete(`${API}/gate/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      toast.success('Media deleted');
    } catch (error) {
      toast.error('Failed to delete media');
    }
  };
  
  // Complete gate scan
  const handleComplete = async () => {
    const imagesCount = media.filter(m => m.media_type === 'image').length;
    const videosCount = media.filter(m => m.media_type === 'video').length;
    
    // Validate requirements
    if (scanType === 'outward' && imagesCount < 1) {
      toast.error('Outward scan requires at least 1 image');
      return;
    }
    if (scanType === 'inward' && imagesCount < 2) {
      toast.error(`Inward scan requires at least 2 images. You have ${imagesCount}.`);
      return;
    }
    
    try {
      await axios.post(`${API}/gate/${gateLog.id}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Gate scan completed successfully!');
      setCurrentStep('complete');
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete scan');
    }
  };
  
  // Reset and start new scan
  const resetFlow = () => {
    setCurrentStep('select');
    setScanType(null);
    setTrackingId('');
    setCourier('');
    setCustomCourier('');
    setGateLog(null);
    setMedia([]);
    setLastScannedId(''); // Reset duplicate check
    setScannerStatus('');
    setSelectedPendingScan(null);
    stopScanner();
    loadRecentScans();
    loadPendingUploads();
    loadScheduled();
  };
  
  // Calculate media requirements
  const getMediaRequirement = () => {
    const imagesCount = media.filter(m => m.media_type === 'image').length;
    if (scanType === 'outward') {
      return { required: 1, current: imagesCount, met: imagesCount >= 1 };
    }
    return { required: 2, current: imagesCount, met: imagesCount >= 2 };
  };
  
  const mediaReq = gateLog ? getMediaRequirement() : null;
  
  // Quick scan from expected queue
  const handleQuickScan = (item, type) => {
    const trackingId = type === 'inward' ? item.pickup_tracking : (item.return_tracking || item.tracking_id);
    if (trackingId) {
      setScanType(type);
      setTrackingId(trackingId);
      setCourier(type === 'inward' ? item.pickup_courier : (item.return_courier || item.courier) || '');
      setCurrentStep('scan');
    }
  };
  
  // Handle pending upload selection
  const openPendingUpload = (scan) => {
    setSelectedPendingScan(scan);
    setScanType(scan.scan_type);
    setGateLog(scan);
    setMedia([]);
    // Load existing media for this scan
    loadMediaForScan(scan.id);
    setCurrentStep('media');
  };
  
  const loadMediaForScan = async (gateLogId) => {
    try {
      const res = await axios.get(`${API}/gate/media/${gateLogId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedia(res.data.media || []);
    } catch (error) {
      console.error('Failed to load media:', error);
    }
  };
  
  // ============ RENDER STEP: SELECT TYPE ============
  if (currentStep === 'select') {
    return (
      <div className="min-h-screen bg-slate-900 p-4 pb-24">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">Gate Control</h1>
          <p className="text-slate-400 text-sm">Scan, view queues, or upload media</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'scan' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Scan className="w-4 h-4 mx-auto mb-1" />
            Scan
          </button>
          <button
            onClick={() => setActiveTab('expected')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === 'expected' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Truck className="w-4 h-4 mx-auto mb-1" />
            Expected
            {(scheduled.incoming.length + scheduled.outgoing.length) > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center text-white">
                {scheduled.incoming.length + scheduled.outgoing.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === 'pending' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <ImageOff className="w-4 h-4 mx-auto mb-1" />
            Pending
            {pendingUploads.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                {pendingUploads.length}
              </span>
            )}
          </button>
        </div>
        
        {/* Tab Content: SCAN */}
        {activeTab === 'scan' && (
          <>
            {/* Scan Type Selection - Large Touch Buttons */}
            <div className="space-y-4 mb-6">
              <button
                onClick={() => { setScanType('inward'); setCurrentStep('scan'); }}
                className="w-full p-6 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-between active:scale-[0.98] transition-transform"
                data-testid="btn-inward"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                    <ArrowDownLeft className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold">INWARD</p>
                    <p className="text-green-100 text-sm">Receiving package</p>
                  </div>
                </div>
                <ChevronRight className="w-8 h-8 text-white/60" />
              </button>
              
              <button
                onClick={() => { setScanType('outward'); setCurrentStep('scan'); }}
                className="w-full p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between active:scale-[0.98] transition-transform"
                data-testid="btn-outward"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                    <ArrowUpRight className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold">OUTWARD</p>
                    <p className="text-blue-100 text-sm">Dispatching package</p>
                  </div>
                </div>
                <ChevronRight className="w-8 h-8 text-white/60" />
              </button>
            </div>
            
            {/* Recent Scans */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Recent Scans</h2>
              {loadingRecent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : recentScans.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No recent scans</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentScans.map((scan) => (
                    <div 
                      key={scan.id} 
                      className="p-3 rounded-xl bg-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          scan.scan_type === 'inward' ? 'bg-green-600/20' : 'bg-blue-600/20'
                        }`}>
                          {scan.scan_type === 'inward' 
                            ? <ArrowDownLeft className="w-5 h-5 text-green-400" />
                            : <ArrowUpRight className="w-5 h-5 text-blue-400" />
                          }
                        </div>
                        <div>
                          <p className="text-white font-mono text-sm">{scan.tracking_id}</p>
                          <p className="text-slate-400 text-xs">{scan.customer_name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={scan.status === 'completed' ? 'bg-green-600' : 'bg-orange-600'}>
                          {scan.status || 'pending'}
                        </Badge>
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(scan.scanned_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Tab Content: EXPECTED QUEUES */}
        {activeTab === 'expected' && (
          <div className="space-y-4">
            {/* Expected Incoming */}
            <div>
              <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-green-400" />
                Incoming Expected ({scheduled.incoming.length})
              </h3>
              {scheduled.incoming.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-800 text-center text-slate-500">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No expected incoming</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                  {scheduled.incoming.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleQuickScan(item, 'inward')}
                      className="w-full p-3 rounded-xl bg-slate-800 flex items-center justify-between active:bg-slate-700 transition-colors text-left"
                    >
                      <div>
                        <p className="text-white font-medium text-sm">{item.ticket_number}</p>
                        <p className="text-slate-400 text-xs">{item.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-cyan-400 text-xs">{item.pickup_courier}</p>
                        <p className="text-slate-500 text-xs font-mono truncate max-w-[100px]">{item.pickup_tracking}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Expected Outgoing */}
            <div>
              <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
                Ready to Ship ({scheduled.outgoing.length})
              </h3>
              {scheduled.outgoing.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-800 text-center text-slate-500">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No items ready to ship</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                  {scheduled.outgoing.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleQuickScan(item, 'outward')}
                      className="w-full p-3 rounded-xl bg-slate-800 flex items-center justify-between active:bg-slate-700 transition-colors text-left"
                    >
                      <div>
                        <p className="text-white font-medium text-sm">{item.ticket_number || item.dispatch_number}</p>
                        <p className="text-slate-400 text-xs">{item.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-cyan-400 text-xs">{item.return_courier || item.courier}</p>
                        <p className="text-slate-500 text-xs font-mono truncate max-w-[100px]">{item.return_tracking || item.tracking_id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Tab Content: PENDING UPLOADS */}
        {activeTab === 'pending' && (
          <div>
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <ImageOff className="w-5 h-5 text-orange-400" />
              Pending Image Uploads ({pendingUploads.length})
            </h3>
            <p className="text-slate-400 text-xs mb-3">Scans without required images. Tap to add photos.</p>
            
            {pendingUploads.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-800 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-70" />
                <p className="text-sm text-green-400">All scans have images!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingUploads.map((scan) => (
                  <button 
                    key={scan.id} 
                    onClick={() => openPendingUpload(scan)}
                    className="w-full p-4 rounded-xl bg-slate-800 border border-orange-600/30 flex items-center justify-between active:bg-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        scan.scan_type === 'inward' ? 'bg-green-600/20' : 'bg-blue-600/20'
                      }`}>
                        {scan.scan_type === 'inward' 
                          ? <ArrowDownLeft className="w-5 h-5 text-green-400" />
                          : <ArrowUpRight className="w-5 h-5 text-blue-400" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm">{scan.tracking_id}</p>
                        <p className="text-slate-400 text-xs">
                          {new Date(scan.scanned_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-orange-600 mb-1">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        {scan.images_count || 0}/{scan.scan_type === 'inward' ? 2 : 1}
                      </Badge>
                      <p className="text-orange-400 text-xs">Add Photos</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // ============ RENDER STEP: SCAN ============
  if (currentStep === 'scan') {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={resetFlow}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {scanType === 'inward' ? 'INWARD' : 'OUTWARD'} Scan
            </h1>
            <p className="text-slate-400 text-sm">Scan barcode or enter tracking ID</p>
          </div>
        </div>
        
        {/* Scanner Container */}
        <Card className="bg-slate-800 border-slate-700 mb-4 overflow-hidden">
          <CardContent className="p-0">
            {/* Camera View */}
            {scannerActive ? (
              <div className="relative">
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-64 object-cover bg-black"
                />
                {/* Scan guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-24 border-2 border-cyan-400 rounded-lg animate-pulse">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900/80 px-2 py-1 rounded text-cyan-400 text-xs">
                      Align barcode here
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-slate-900">
                  {/* Scanner status */}
                  <div className={`text-center text-sm mb-2 ${
                    scannerStatus.includes('✓') ? 'text-green-400' : 'text-cyan-400'
                  }`}>
                    {scannerStatus || 'Point camera at barcode - auto-detects'}
                  </div>
                  <Button
                    onClick={stopScanner}
                    variant="outline"
                    className="w-full border-red-600 text-red-400 hover:bg-red-600/20"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Close Scanner
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <Button
                  onClick={startScanner}
                  className={`w-full h-14 text-lg ${
                    scanType === 'inward' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  data-testid="btn-start-scanner"
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Scan Barcode
                </Button>
                <p className="text-slate-500 text-xs mt-2">
                  Auto-detects barcodes with beep sound
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Manual Entry */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Tracking ID *</label>
              <Input
                placeholder="Enter tracking ID..."
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white h-14 text-lg"
                data-testid="input-tracking"
                autoComplete="off"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Courier</label>
              {/* Native select for better mobile support */}
              <div className="relative">
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full h-14 px-4 pr-10 rounded-lg bg-slate-900 border border-slate-700 text-white text-lg appearance-none cursor-pointer"
                  style={{ WebkitAppearance: 'none' }}
                >
                  <option value="">Select courier</option>
                  {COURIERS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {courier === 'Other' && (
              <Input
                placeholder="Enter courier name..."
                value={customCourier}
                onChange={(e) => setCustomCourier(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white h-14 text-lg"
              />
            )}
          </CardContent>
        </Card>
        
        {/* Submit Button */}
        <Button
          onClick={handleScan}
          disabled={scanning || !trackingId.trim() || (courier === 'Other' && !customCourier)}
          className={`w-full h-16 text-xl ${
            scanType === 'inward' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          data-testid="btn-submit-scan"
        >
          {scanning ? (
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
          ) : (
            <Scan className="w-6 h-6 mr-2" />
          )}
          Record {scanType === 'inward' ? 'Inward' : 'Outward'} Scan
        </Button>
      </div>
    );
  }
  
  // ============ RENDER STEP: MEDIA CAPTURE ============
  if (currentStep === 'media') {
    return (
      <div className="min-h-screen bg-slate-900 p-4 pb-40">
        {/* Header with back button for pending uploads */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            {selectedPendingScan && (
              <button 
                onClick={resetFlow}
                className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">
                {selectedPendingScan ? 'Add Photos' : 'Capture Media'}
              </h1>
              <Badge className={scanType === 'inward' ? 'bg-green-600' : 'bg-blue-600'}>
                {scanType?.toUpperCase()}
              </Badge>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Tracking: <span className="text-white font-mono">{gateLog?.tracking_id}</span>
          </p>
        </div>
        
        {/* Media Requirement Banner */}
        <div className={`p-4 rounded-xl mb-4 ${
          mediaReq?.met ? 'bg-green-900/30 border border-green-700' : 'bg-orange-900/30 border border-orange-700'
        }`}>
          <div className="flex items-center gap-3">
            {mediaReq?.met ? (
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-orange-400" />
            )}
            <div>
              <p className={mediaReq?.met ? 'text-green-300' : 'text-orange-300'}>
                <strong>{mediaReq?.current}/{mediaReq?.required}</strong> images uploaded
                {!mediaReq?.met && ` (Need ${mediaReq?.required - mediaReq?.current} more)`}
              </p>
              <p className="text-sm text-slate-400">
                {scanType === 'inward' ? 'Inward requires 2+ images' : 'Outward requires 1+ image'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Capture Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Camera Capture */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-6 rounded-xl bg-slate-800 border border-slate-700 text-center active:scale-[0.98] transition-transform"
          >
            <Camera className="w-10 h-10 mx-auto mb-2 text-cyan-400" />
            <p className="text-white font-medium">Take Photo</p>
            <p className="text-slate-400 text-xs">Camera capture</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => handleMediaCapture(e, 'image')}
            className="hidden"
          />
          
          {/* Gallery Upload */}
          <label className="p-6 rounded-xl bg-slate-800 border border-slate-700 text-center cursor-pointer active:scale-[0.98] transition-transform">
            <Upload className="w-10 h-10 mx-auto mb-2 text-purple-400" />
            <p className="text-white font-medium">Gallery</p>
            <p className="text-slate-400 text-xs">Upload images</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleMediaCapture(e, 'image')}
              className="hidden"
            />
          </label>
        </div>
        
        {/* Video Capture (Optional) */}
        <div className="mb-4">
          <p className="text-slate-400 text-sm mb-2">Optional: Record Video</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
              className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center active:scale-[0.98]"
            >
              <Video className="w-8 h-8 mx-auto mb-1 text-red-400" />
              <p className="text-white text-sm">Record Video</p>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(e) => handleMediaCapture(e, 'video')}
              className="hidden"
            />
            
            <label className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center cursor-pointer active:scale-[0.98]">
              <Video className="w-8 h-8 mx-auto mb-1 text-orange-400" />
              <p className="text-white text-sm">Upload Video</p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleMediaCapture(e, 'video')}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* Upload Progress */}
        {uploading && (
          <div className="mb-4 p-4 rounded-xl bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-white">Uploading... {uploadProgress}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Media Grid */}
        {media.length > 0 && (
          <div className="mb-4">
            <h3 className="text-white font-medium mb-2">
              Captured Media ({media.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800">
                  {m.media_type === 'image' ? (
                    <img
                      src={`${API}/gate/media/download/${m.id}`}
                      alt={m.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-700">
                      <Video className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteMedia(m.id)}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-600 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                  <Badge className="absolute bottom-1 left-1 bg-slate-900/80 text-xs">
                    {m.media_type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Fixed Bottom Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 space-y-2">
          {/* Skip button - only show if coming from fresh scan, not pending upload */}
          {!selectedPendingScan && (
            <Button
              onClick={() => {
                toast.info('Scan saved. Add photos later from "Pending" tab.');
                resetFlow();
              }}
              variant="outline"
              className="w-full h-12 text-base border-slate-600 text-slate-300"
            >
              <Clock className="w-5 h-5 mr-2" />
              Skip - Upload Photos Later
            </Button>
          )}
          
          <Button
            onClick={handleComplete}
            disabled={!mediaReq?.met || uploading}
            className={`w-full h-14 text-lg ${
              mediaReq?.met 
                ? (scanType === 'inward' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700')
                : 'bg-slate-700'
            }`}
            data-testid="btn-complete"
          >
            <Check className="w-6 h-6 mr-2" />
            Complete {scanType === 'inward' ? 'Inward' : 'Outward'} Scan
          </Button>
        </div>
      </div>
    );
  }
  
  // ============ RENDER STEP: COMPLETE ============
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
            scanType === 'inward' ? 'bg-green-600' : 'bg-blue-600'
          }`}>
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            {scanType === 'inward' ? 'Inward' : 'Outward'} Complete!
          </h1>
          
          <p className="text-slate-400 mb-2">Tracking ID:</p>
          <p className="text-xl font-mono text-white mb-6">{gateLog?.tracking_id}</p>
          
          <div className="flex gap-2 justify-center mb-8">
            <Badge className="bg-slate-700">
              <ImageIcon className="w-3 h-3 mr-1" />
              {media.filter(m => m.media_type === 'image').length} images
            </Badge>
            {media.filter(m => m.media_type === 'video').length > 0 && (
              <Badge className="bg-slate-700">
                <Video className="w-3 h-3 mr-1" />
                {media.filter(m => m.media_type === 'video').length} videos
              </Badge>
            )}
          </div>
          
          <Button
            onClick={resetFlow}
            className="w-full h-14 text-lg bg-cyan-600 hover:bg-cyan-700"
            data-testid="btn-new-scan"
          >
            Start New Scan
          </Button>
        </div>
      </div>
    );
  }
  
  return null;
}
