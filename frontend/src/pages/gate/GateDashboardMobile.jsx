import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Scan, ArrowDownLeft, ArrowUpRight, Camera, Video, X, Check,
  Loader2, Image as ImageIcon, Trash2, Upload, QrCode, 
  Package, ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import imageCompression from 'browser-image-compression';

// Courier options
const COURIERS = [
  'Delhivery', 'BlueDart', 'DTDC', 'FedEx', 'Ecom Express', 
  'Xpressbees', 'Shadowfax', 'India Post', 'Other'
];

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
  
  // Gate log state (after initial scan)
  const [gateLog, setGateLog] = useState(null);
  
  // Media state
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Scanner ref
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  
  // Scanner loading state
  const [scannerLoading, setScannerLoading] = useState(false);
  
  // Recent scans
  const [recentScans, setRecentScans] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  // Load recent scans on mount
  useEffect(() => {
    loadRecentScans();
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
  
  // Start barcode scanner
  const startScanner = useCallback(async () => {
    // Show scanner UI and loading state first
    setScannerActive(true);
    setScannerLoading(true);
    
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const scannerElement = document.getElementById("barcode-scanner");
    if (!scannerElement) {
      toast.error('Scanner element not ready');
      setScannerActive(false);
      setScannerLoading(false);
      return;
    }
    
    // First, request camera permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
    } catch (permErr) {
      console.error('Camera permission denied:', permErr);
      toast.error('Camera permission denied. Please allow camera access in your browser settings.');
      setScannerActive(false);
      setScannerLoading(false);
      return;
    }
    
    try {
      // Clean up any existing scanner instance
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop();
          }
          html5QrcodeRef.current.clear();
        } catch (e) {
          console.log('Cleanup error (ignored):', e);
        }
      }
      
      const html5Qrcode = new Html5Qrcode("barcode-scanner");
      html5QrcodeRef.current = html5Qrcode;
      
      // Get available cameras
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        console.log('Available cameras:', cameras);
      } catch (camErr) {
        console.log('Could not enumerate cameras, using default');
      }
      
      // Determine camera config
      let cameraConfig = { facingMode: "environment" };
      
      if (cameras && cameras.length > 0) {
        // Prefer back camera (environment) on mobile
        const backCamera = cameras.find(cam => 
          cam.label.toLowerCase().includes('back') || 
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        
        if (backCamera) {
          cameraConfig = backCamera.id;
        } else {
          // Use last camera (usually back camera on mobile)
          cameraConfig = cameras[cameras.length - 1].id;
        }
      }
      
      await html5Qrcode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.777778,
          disableFlip: false
        },
        (decodedText) => {
          // Success - barcode decoded
          setTrackingId(decodedText);
          stopScanner();
          toast.success(`Scanned: ${decodedText}`);
        },
        (errorMessage) => {
          // Scan error - ignore, keep scanning
        }
      );
      
      setScannerLoading(false);
      console.log('Scanner started successfully');
    } catch (err) {
      console.error('Failed to start scanner:', err);
      toast.error(`Camera error: ${err.message || 'Unable to start camera'}`);
      setScannerActive(false);
      setScannerLoading(false);
    }
  }, []);
  
  // Stop barcode scanner
  const stopScanner = useCallback(() => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      html5QrcodeRef.current.stop().then(() => {
        html5QrcodeRef.current.clear();
        setScannerActive(false);
      }).catch(console.error);
    }
  }, []);
  
  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);
  
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
    stopScanner();
    loadRecentScans();
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
  
  // ============ RENDER STEP: SELECT TYPE ============
  if (currentStep === 'select') {
    return (
      <div className="min-h-screen bg-slate-900 p-4 pb-24">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Gate Control</h1>
          <p className="text-slate-400 text-sm">Select scan type to begin</p>
        </div>
        
        {/* Scan Type Selection - Large Touch Buttons */}
        <div className="space-y-4 mb-8">
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
            {/* Camera Scanner - always render the container */}
            <div 
              id="barcode-scanner" 
              ref={scannerRef}
              style={{ 
                width: '100%', 
                minHeight: scannerActive ? '280px' : '0px',
                display: scannerActive ? 'block' : 'none',
                position: 'relative'
              }}
              className="bg-black"
            >
              {/* Loading overlay */}
              {scannerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-2" />
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>
            
            {!scannerActive && (
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
                  Open Camera Scanner
                </Button>
              </div>
            )}
            
            {scannerActive && (
              <div className="p-3 bg-slate-900">
                <p className="text-center text-slate-400 text-sm mb-2">Point camera at barcode</p>
                <Button
                  onClick={stopScanner}
                  variant="outline"
                  className="w-full border-red-600 text-red-400 hover:bg-red-600/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Scanner
                </Button>
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
                placeholder="Enter tracking ID manually..."
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white h-14 text-lg"
                data-testid="input-tracking"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Courier</label>
              <Select value={courier} onValueChange={setCourier}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-12">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {COURIERS.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {courier === 'Other' && (
              <Input
                placeholder="Enter courier name..."
                value={customCourier}
                onChange={(e) => setCustomCourier(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white h-12"
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
      <div className="min-h-screen bg-slate-900 p-4 pb-32">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-white">Capture Media</h1>
            <Badge className={scanType === 'inward' ? 'bg-green-600' : 'bg-blue-600'}>
              {scanType?.toUpperCase()}
            </Badge>
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
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
