import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Scan, ArrowDownLeft, ArrowUpRight, Camera, Video, X, Check,
  Loader2, Image as ImageIcon, Trash2, Upload, QrCode,
  Package, ChevronRight, AlertCircle, CheckCircle2, ChevronDown,
  Clock, Truck, ImageOff
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { T, Fonts } from '@/components/iron/IronKit';

// Courier options
const COURIERS = [
  'Delhivery', 'BlueDart', 'DTDC', 'FedEx', 'Ecom Express',
  'Xpressbees', 'Shadowfax', 'India Post', 'Other'
];

// Beep sound for successful scan (base64 encoded short beep)
const BEEP_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6YjHxwZmVpeoaSlZeLfXFoZWt0gIqRkYyDd29sbHN+iI6QjYZ9dXFvcnqCiY2NioN7dHFxdXuDiYuLiIN8dnNzdXuCh4qKh4J8dnR0dnyChomIhYF7d3V2eoCEh4eGgn56d3Z4fIGFh4aDgHx4d3h7gISGhYOAfHl3eHuAg4WFg4B9enl5e3+ChISDgH17enp7f4KEhIOAfXt6ent/goSEg4B9e3p6e3+ChISDgH17enp7f4KDg4KAfXt6ent/goODgoB9e3p6e3+ChISDgH17enp7f4KDg4KAfXt6ent/goODgoB9e3p6e36Bg4OCgH17enp7foGDg4KAfXt6ent+gYODgoB9e3p6en6Bg4OCgH17enp6foGCgoGAfXt6enp+gYKCgYB9e3p6en6BgoKBgH17enp6fn+BgoGAfXx6enp+f4GCgYB9fHp6en5/gYGBgH18enp6fn+BgYGAfXx6enp+f4GBgIB9fHp6en5/gYGAgH18enp6fn+AgYCAfXx7enp+f4CAgIB9fHt6en5/gICAgH18e3p6fn+AgIB/fXx7e3t+f4CAgH99fHt7e35/gIB/f318e3t7fn9/gH99fXx7e3t+f39/f319fHt7e35/f399fX18e3t7fn9/f319fHx7e3t+f39/fX18fHt7e35/f399fXx8fHt7fn9/f319fHx8e3t+f39/fX18fHx7e35/f399fXx8fHx7fn5/f319fHx8fHt+fn5/fX18fHx8fH5+fn99fXx8fHx8fn5+f318fHx8fHx+fn5/fXx8fHx8fH5+fn99fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fH5+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX18fHx8fHx+fn59fXx8fHx8fH5+fn19fHx8fHx8fn5+fX0=";

// ---- Iron Console palette (dark kiosk) ----
const BG = '#0F0F0F';
const PANEL = '#1E1E1E';
const PANEL2 = '#161616';
const BORDER = T.iron700;
const TEXT = T.white;
const SUB = T.iron400;
const MUTED = T.iron500;

const monoFont = { fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };
const headFont = { fontFamily: T.headline };

// Tone colours mirroring original semantics (inward=green, outward=blue, orange=primary/scan)
const tone = (t) => t === 'inward' ? T.green : T.blue;

export default function GateDashboardMobile() {
  const { token, user } = useAuth();

  // Flow state
  const [currentStep, setCurrentStep] = useState('select'); // select, scan, media, complete
  const [scanType, setScanType] = useState(null); // inward or outward

  // Scan state
  const [trackingId, setTrackingId] = useState('');
  const [orderInfo, setOrderInfo] = useState(null);  // resolved order after scanning tracking (outward)
  const [serial, setSerial] = useState('');          // unit serial scanned at the gate (outward step 2)
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
  const trackingRef = useRef(null);   // hardware scanner types into this + Enter → submit

  // Recent scans
  const [recentScans, setRecentScans] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Amazon Return-OTP batches — OTP unlocks once every listed parcel is scanned inward
  const [returnBatches, setReturnBatches] = useState([]);

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

  // Load recent scans on mount + keep the return-OTP list fresh (unlocks within 30s of the last scan)
  useEffect(() => {
    loadRecentScans();
    loadScheduled();
    loadPendingUploads();
    loadReturnBatches();
    const iv = setInterval(loadReturnBatches, 30000);
    return () => clearInterval(iv);
  }, [token]);

  const loadReturnBatches = async () => {
    try {
      const res = await axios.get(`${API}/gate/return-batches?days=7`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturnBatches(res.data.batches || []);
    } catch (error) {
      console.error('Failed to load return OTP batches:', error);
    }
  };

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

  // Hardware-scanner ergonomics: whenever the scan step is showing (and the camera isn't), keep the
  // tracking field focused so a scan lands straight in it — no clicking between parcels.
  useEffect(() => {
    if (currentStep === 'scan' && !scannerActive) {
      const t = setTimeout(() => trackingRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [currentStep, scannerActive]);

  // Handle initial scan submission
  const handleScan = async () => {
    if (!trackingId.trim()) {
      toast.error('Please enter or scan a tracking ID');
      return;
    }

    const courierName = courier === 'Other' ? customCourier : courier;

    // OUTWARD: scan tracking FIRST → pull up the order → then scan the unit serial (step 2).
    if (scanType === 'outward') {
      setScanning(true);
      try {
        const { data } = await axios.post(`${API}/gate/lookup-tracking`,
          { tracking_id: trackingId.trim() }, { headers: { Authorization: `Bearer ${token}` } });
        setOrderInfo(data);
        setCourier(courierName);
        setSerial('');
        setCurrentStep('serial');
        if (data && !data.found) toast.warning('Tracking not found in CRM — you can still record & scan a serial.');
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Tracking lookup failed');
      } finally {
        setScanning(false);
      }
      return;
    }

    // INWARD: record directly (no serial).
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

  // OUTWARD step 2: unit serial scanned → record the outward gate scan + bind the serial to the order.
  const submitOutwardSerial = async () => {
    if (!serial.trim()) {
      toast.error('Scan the unit serial number');
      return;
    }
    const courierName = courier === 'Other' ? customCourier : courier;
    setScanning(true);
    try {
      const res = await axios.post(`${API}/gate/scan`, {
        scan_type: 'outward',
        tracking_id: trackingId.trim(),
        courier: courierName,
        serial: serial.trim(),
        notes: ''
      }, { headers: { Authorization: `Bearer ${token}` } });
      setGateLog(res.data);
      toast.success('Outward scan recorded — serial bound to the order');
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
    setOrderInfo(null);
    setSerial('');
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

  // Rapid consecutive scanning: keep the same scan type (inward/outward), clear the per-parcel state,
  // and jump straight back to the scan step (the tracking field auto-focuses for the next scan).
  const scanNextSameType = () => {
    setTrackingId(''); setOrderInfo(null); setSerial(''); setGateLog(null); setMedia([]);
    setLastScannedId(''); setScannerStatus(''); setSelectedPendingScan(null);
    stopScanner();
    setCurrentStep('scan');
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

  // Quick scan from expected queue
  const handleQuickScan = (item, type) => {
    const tid = type === 'inward' ? item.pickup_tracking : (item.return_tracking || item.tracking_id);
    if (tid) {
      setScanType(type);
      setTrackingId(tid);
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

  // ---- shared style primitives ----
  const screen = { minHeight: '100vh', background: BG, color: TEXT, fontFamily: T.body, WebkitTapHighlightColor: 'transparent' };
  const panelStyle = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14 };
  const iconBtn = { width: 44, height: 44, borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' };
  const pill = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', background: bg, color, ...headFont });

  // ============ RENDER STEP: SELECT TYPE ============
  if (currentStep === 'select') {
    const expectedCount = scheduled.incoming.length + scheduled.outgoing.length;
    return (
      <div style={{ ...screen, padding: 16, paddingBottom: 96 }}>
        <Fonts />
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ ...headFont, fontSize: 26, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '.01em' }}>Gate Control</h1>
          <p style={{ color: SUB, fontSize: 13, marginTop: 4 }}>Scan, view queues, or upload media</p>
          <div style={{ width: 44, height: 3, background: T.orange, borderRadius: 2, margin: '10px auto 0' }} />
        </div>

        {/* Amazon Return-OTP — OTP stays locked until every listed parcel is scanned inward */}
        {returnBatches.length > 0 && (
          <div style={{ marginBottom: 16, borderRadius: 14, border: `1px solid ${T.orange}55`, background: PANEL2, padding: 14 }}>
            <div style={{ ...headFont, fontSize: 13, fontWeight: 800, color: T.orange, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              ↩️ Amazon Returns — OTP Gate
              <span style={{ fontSize: 11, fontWeight: 500, color: SUB, textTransform: 'none', letterSpacing: 0 }}>scan every parcel to unlock</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {returnBatches.map((b) => {
                const done = !b.otp_locked;
                const expired = b.status === 'expired';
                const bc = done ? T.green : expired ? T.rose : BORDER;
                return (
                  <div key={b.id} style={{ borderRadius: 12, border: `1px solid ${bc}`, background: done ? `${T.green}18` : expired ? `${T.rose}18` : PANEL2, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: PANEL, color: T.iron200, ...monoFont }}>{b.scanned_count}/{b.total} scanned</span>
                      {done ? (
                        <span style={{ ...monoFont, fontWeight: 800, color: '#5FD68A', fontSize: 24, letterSpacing: '.15em' }}>🔓 {b.otp}</span>
                      ) : (
                        <span style={{ ...monoFont, color: MUTED, fontSize: 24, letterSpacing: '.15em' }}>🔒 ••••••</span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: SUB }}>
                      {(b.firm || (b.firm_names || ['?'])[0])} · {b.email_date}
                      {b.valid_through ? ` · valid ${b.valid_through}` : ''}{expired ? ' · EXPIRED' : ''}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(b.items || []).map((it, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                          <span style={{ color: it.scanned ? '#5FD68A' : MUTED }}>{it.scanned ? '✅' : '⬜'}</span>
                          <span style={{ ...monoFont, color: SUB }}>{it.tracking_id}</span>
                          <span style={{ color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.product}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
          {[
            { key: 'scan', label: 'Scan', Icon: Scan, badge: 0, badgeColor: T.orange },
            { key: 'expected', label: 'Expected', Icon: Truck, badge: expectedCount, badgeColor: T.orange },
            { key: 'pending', label: 'Pending', Icon: ImageOff, badge: pendingUploads.length, badgeColor: T.rose },
          ].map(({ key, label, Icon, badge, badgeColor }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flex: 1, minWidth: 90, padding: '12px 10px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  ...headFont, cursor: 'pointer', position: 'relative',
                  background: active ? T.orange : PANEL,
                  color: active ? '#0F0F0F' : SUB,
                  border: `1px solid ${active ? T.orange : BORDER}`,
                }}
              >
                <Icon style={{ width: 18, height: 18, margin: '0 auto 4px', display: 'block' }} />
                {label}
                {badge > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: badgeColor, borderRadius: 999, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, fontWeight: 800 }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content: SCAN */}
        {activeTab === 'scan' && (
          <>
            {/* Scan Type Selection - Large Touch Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <button
                onClick={() => { setScanType('inward'); setCurrentStep('scan'); }}
                style={{ width: '100%', padding: 22, borderRadius: 18, background: T.green, color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer' }}
                data-testid="btn-inward"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowDownLeft style={{ width: 30, height: 30 }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ ...headFont, fontSize: 22, fontWeight: 800, margin: 0 }}>INWARD</p>
                    <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, margin: 0 }}>Receiving package</p>
                  </div>
                </div>
                <ChevronRight style={{ width: 30, height: 30, color: 'rgba(255,255,255,.6)' }} />
              </button>

              <button
                onClick={() => { setScanType('outward'); setCurrentStep('scan'); }}
                style={{ width: '100%', padding: 22, borderRadius: 18, background: T.blue, color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer' }}
                data-testid="btn-outward"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowUpRight style={{ width: 30, height: 30 }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ ...headFont, fontSize: 22, fontWeight: 800, margin: 0 }}>OUTWARD</p>
                    <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, margin: 0 }}>Dispatching package</p>
                  </div>
                </div>
                <ChevronRight style={{ width: 30, height: 30, color: 'rgba(255,255,255,.6)' }} />
              </button>
            </div>

            {/* Recent Scans */}
            <div>
              <h2 style={{ ...headFont, fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 12 }}>Recent Scans</h2>
              {loadingRecent ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <Loader2 className="animate-spin" style={{ width: 24, height: 24, color: SUB }} />
                </div>
              ) : recentScans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
                  <Package style={{ width: 48, height: 48, margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No recent scans</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentScans.map((scan) => (
                    <div key={scan.id} style={{ ...panelStyle, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone(scan.scan_type)}22` }}>
                          {scan.scan_type === 'inward'
                            ? <ArrowDownLeft style={{ width: 20, height: 20, color: '#5FD68A' }} />
                            : <ArrowUpRight style={{ width: 20, height: 20, color: '#5BA8DE' }} />}
                        </div>
                        <div>
                          <p style={{ ...monoFont, color: TEXT, fontSize: 14, margin: 0 }}>{scan.tracking_id}</p>
                          <p style={{ color: SUB, fontSize: 12, margin: 0 }}>{scan.customer_name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={pill(scan.status === 'completed' ? T.green : T.orange, TEXT)}>{scan.status || 'pending'}</span>
                        <p style={{ color: MUTED, fontSize: 11, marginTop: 4, marginBottom: 0 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Expected Incoming */}
            <div>
              <h3 style={{ ...headFont, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowDownLeft style={{ width: 20, height: 20, color: '#5FD68A' }} />
                Incoming Expected ({scheduled.incoming.length})
              </h3>
              {scheduled.incoming.length === 0 ? (
                <div style={{ ...panelStyle, padding: 16, textAlign: 'center', color: MUTED }}>
                  <Package style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No expected incoming</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '35vh', overflowY: 'auto' }}>
                  {scheduled.incoming.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickScan(item, 'inward')}
                      style={{ ...panelStyle, width: '100%', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', color: TEXT }}
                    >
                      <div>
                        <p style={{ color: TEXT, fontWeight: 600, fontSize: 14, margin: 0 }}>{item.ticket_number}</p>
                        <p style={{ color: SUB, fontSize: 12, margin: 0 }}>{item.customer_name}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: T.orange, fontSize: 12, margin: 0 }}>{item.pickup_courier}</p>
                        <p style={{ ...monoFont, color: MUTED, fontSize: 12, margin: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pickup_tracking}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expected Outgoing */}
            <div>
              <h3 style={{ ...headFont, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowUpRight style={{ width: 20, height: 20, color: '#5BA8DE' }} />
                Ready to Ship ({scheduled.outgoing.length})
              </h3>
              {scheduled.outgoing.length === 0 ? (
                <div style={{ ...panelStyle, padding: 16, textAlign: 'center', color: MUTED }}>
                  <Truck style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No items ready to ship</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '35vh', overflowY: 'auto' }}>
                  {scheduled.outgoing.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickScan(item, 'outward')}
                      style={{ ...panelStyle, width: '100%', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', color: TEXT }}
                    >
                      <div>
                        <p style={{ color: TEXT, fontWeight: 600, fontSize: 14, margin: 0 }}>{item.ticket_number || item.dispatch_number}</p>
                        <p style={{ color: SUB, fontSize: 12, margin: 0 }}>{item.customer_name}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: T.orange, fontSize: 12, margin: 0 }}>{item.return_courier || item.courier}</p>
                        <p style={{ ...monoFont, color: MUTED, fontSize: 12, margin: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.return_tracking || item.tracking_id}</p>
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
            <h3 style={{ ...headFont, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ImageOff style={{ width: 20, height: 20, color: T.orange }} />
              Pending Image Uploads ({pendingUploads.length})
            </h3>
            <p style={{ color: SUB, fontSize: 12, marginBottom: 12 }}>Scans without required images. Tap to add photos.</p>

            {pendingUploads.length === 0 ? (
              <div style={{ ...panelStyle, padding: 24, textAlign: 'center', color: MUTED }}>
                <CheckCircle2 style={{ width: 48, height: 48, margin: '0 auto 8px', color: T.green, opacity: 0.8 }} />
                <p style={{ fontSize: 13, color: '#5FD68A', margin: 0 }}>All scans have images!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingUploads.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => openPendingUpload(scan)}
                    style={{ ...panelStyle, width: '100%', padding: 16, border: `1px solid ${T.orange}55`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', color: TEXT }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone(scan.scan_type)}22` }}>
                        {scan.scan_type === 'inward'
                          ? <ArrowDownLeft style={{ width: 20, height: 20, color: '#5FD68A' }} />
                          : <ArrowUpRight style={{ width: 20, height: 20, color: '#5BA8DE' }} />}
                      </div>
                      <div>
                        <p style={{ ...monoFont, color: TEXT, fontSize: 14, margin: 0 }}>{scan.tracking_id}</p>
                        <p style={{ color: SUB, fontSize: 12, margin: 0 }}>{new Date(scan.scanned_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ ...pill(T.orange, TEXT), marginBottom: 4 }}>
                        <ImageIcon style={{ width: 12, height: 12 }} />
                        {scan.images_count || 0}/{scan.scan_type === 'inward' ? 2 : 1}
                      </span>
                      <p style={{ color: T.orange, fontSize: 12, margin: '4px 0 0' }}>Add Photos</p>
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
    const accent = tone(scanType);
    return (
      <div style={{ ...screen, padding: 16 }}>
        <Fonts />
        {/* Header with back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={resetFlow} style={iconBtn}>
            <X style={{ width: 20, height: 20 }} />
          </button>
          <div>
            <h1 style={{ ...headFont, fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>
              {scanType === 'inward' ? 'INWARD' : 'OUTWARD'} Scan
            </h1>
            <p style={{ color: SUB, fontSize: 13, margin: 0 }}>Scan barcode or enter tracking ID</p>
          </div>
        </div>

        {/* Scanner Container */}
        <div style={{ ...panelStyle, marginBottom: 16, overflow: 'hidden' }}>
          {scannerActive ? (
            <div style={{ position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: 256, objectFit: 'cover', background: '#000', display: 'block' }}
              />
              {/* Scan guide overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="animate-pulse" style={{ position: 'relative', width: 256, height: 96, border: `2px solid ${T.orange}`, borderRadius: 10 }}>
                  <div style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,15,15,.85)', padding: '4px 8px', borderRadius: 6, color: T.orange, fontSize: 12, whiteSpace: 'nowrap' }}>
                    Align barcode here
                  </div>
                </div>
              </div>
              <div style={{ padding: 12, background: PANEL2 }}>
                {/* Scanner status */}
                <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 8, color: scannerStatus.includes('✓') ? '#5FD68A' : T.orange }}>
                  {scannerStatus || 'Point camera at barcode - auto-detects'}
                </div>
                <button
                  onClick={stopScanner}
                  style={{ width: '100%', height: 48, borderRadius: 12, border: `1px solid ${T.rose}`, background: 'transparent', color: '#E8865A', fontSize: 15, fontWeight: 700, ...headFont, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <X style={{ width: 18, height: 18 }} />
                  Close Scanner
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <QrCode style={{ width: 64, height: 64, margin: '0 auto 16px', color: MUTED }} />
              <button
                onClick={startScanner}
                style={{ width: '100%', height: 56, borderRadius: 12, fontSize: 18, fontWeight: 800, ...headFont, color: TEXT, background: accent, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
                data-testid="btn-start-scanner"
              >
                <Camera style={{ width: 24, height: 24 }} />
                Scan Barcode
              </button>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
                Auto-detects barcodes with beep sound
              </p>
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div style={{ ...panelStyle, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: SUB, marginBottom: 4, display: 'block' }}>Tracking ID *</label>
            <input
              placeholder="Scan or enter tracking ID..."
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && trackingId.trim() && !scanning) handleScan(); }}
              autoFocus
              ref={trackingRef}
              style={{ width: '100%', height: 56, padding: '0 16px', borderRadius: 10, background: PANEL2, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, ...monoFont, outline: 'none' }}
              data-testid="input-tracking"
              autoComplete="off"
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: SUB, marginBottom: 4, display: 'block' }}>Courier</label>
            {/* Native select for better mobile support */}
            <div style={{ position: 'relative' }}>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                style={{ width: '100%', height: 56, padding: '0 40px 0 16px', borderRadius: 10, background: PANEL2, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', outline: 'none' }}
              >
                <option value="">Select courier</option>
                {COURIERS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: SUB, pointerEvents: 'none' }} />
            </div>
          </div>

          {courier === 'Other' && (
            <input
              placeholder="Enter courier name..."
              value={customCourier}
              onChange={(e) => setCustomCourier(e.target.value)}
              style={{ width: '100%', height: 56, padding: '0 16px', borderRadius: 10, background: PANEL2, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, outline: 'none' }}
            />
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleScan}
          disabled={scanning || !trackingId.trim() || (courier === 'Other' && !customCourier)}
          style={{
            width: '100%', height: 64, borderRadius: 14, fontSize: 20, fontWeight: 800, ...headFont, color: TEXT, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: accent,
            opacity: (scanning || !trackingId.trim() || (courier === 'Other' && !customCourier)) ? 0.5 : 1,
            cursor: (scanning || !trackingId.trim() || (courier === 'Other' && !customCourier)) ? 'not-allowed' : 'pointer',
          }}
          data-testid="btn-submit-scan"
        >
          {scanning ? (
            <Loader2 className="animate-spin" style={{ width: 24, height: 24 }} />
          ) : (
            <Scan style={{ width: 24, height: 24 }} />
          )}
          {scanType === 'inward' ? 'Record Inward Scan' : 'Continue → scan serial'}
        </button>
      </div>
    );
  }

  // ============ RENDER STEP: SERIAL (outward step 2) ============
  if (currentStep === 'serial') {
    const oi = orderInfo || {};
    const accent = T.blue;
    return (
      <div style={{ ...screen, padding: 16, paddingBottom: 160 }}>
        <Fonts />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => { setSerial(''); setCurrentStep('scan'); }} style={iconBtn}>
            <X style={{ width: 20, height: 20 }} />
          </button>
          <div>
            <h1 style={{ ...headFont, fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>Scan Unit Serial</h1>
            <p style={{ color: SUB, fontSize: 13, margin: 0 }}>Step 2 — bind the unit to this order</p>
          </div>
        </div>

        {/* Resolved order */}
        <div style={{ ...panelStyle, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4 }}>TRACKING</div>
          <div style={{ ...monoFont, fontSize: 15, color: TEXT, fontWeight: 700 }}>{trackingId}</div>
          {oi.found ? (
            <>
              <div style={{ marginTop: 10, fontSize: 15, color: TEXT, fontWeight: 700 }}>{oi.customer_name || '—'}</div>
              <div style={{ fontSize: 12.5, color: SUB, marginTop: 2 }}>{(oi.product || '—').slice(0, 70)}</div>
              <div style={{ fontSize: 11.5, color: SUB, marginTop: 4 }}>{oi.order_id}{oi.firm_name ? ` · ${oi.firm_name}` : ''}</div>
              {oi.bound_serials?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.green }}>Serial already on file: {oi.bound_serials.join(', ')}</div>
              )}
              {oi.already_scanned_out && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.orange, fontWeight: 700 }}>
                  ⚠️ Already scanned out{oi.already_out_serial ? ` (serial ${oi.already_out_serial})` : ''}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12.5, color: T.orange }}>Tracking not found in CRM — you can still record the scan + serial.</div>
          )}
        </div>

        {/* Serial input */}
        <div style={{ ...panelStyle, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 6 }}>UNIT SERIAL</div>
          <input autoFocus value={serial} onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitOutwardSerial()}
            placeholder="Scan or type the unit serial…"
            style={{ width: '100%', padding: '14px 12px', fontSize: 17, fontWeight: 700, letterSpacing: 1,
              background: '#0f172a', color: TEXT, border: `1px solid ${accent}`, borderRadius: 10, outline: 'none', boxSizing: 'border-box' }} />
          <p style={{ color: SUB, fontSize: 11.5, marginTop: 8 }}>Handheld scanner or type it — this becomes the serial of the actual unit that left the gate.</p>
        </div>

        <button onClick={submitOutwardSerial} disabled={scanning || !serial.trim()}
          style={{ width: '100%', padding: 16, background: accent, color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (scanning || !serial.trim()) ? 0.6 : 1, cursor: 'pointer' }}>
          {scanning ? <Loader2 className="animate-spin" style={{ width: 22, height: 22 }} /> : <Scan style={{ width: 22, height: 22 }} />}
          Record Outward Scan
        </button>
      </div>
    );
  }

  // ============ RENDER STEP: MEDIA CAPTURE ============
  if (currentStep === 'media') {
    const accent = tone(scanType);
    const met = mediaReq?.met;
    return (
      <div style={{ ...screen, padding: 16, paddingBottom: 160 }}>
        <Fonts />
        {/* Header with back button for pending uploads */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {selectedPendingScan && (
              <button onClick={resetFlow} style={iconBtn}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ ...headFont, fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>
                {selectedPendingScan ? 'Add Photos' : 'Capture Media'}
              </h1>
              <span style={pill(accent, TEXT)}>{scanType?.toUpperCase()}</span>
            </div>
          </div>
          <p style={{ color: SUB, fontSize: 13, margin: 0 }}>
            Tracking: <span style={{ color: TEXT, ...monoFont }}>{gateLog?.tracking_id}</span>
          </p>
        </div>

        {/* Media Requirement Banner */}
        <div style={{ padding: 16, borderRadius: 14, marginBottom: 16, background: met ? `${T.green}22` : `${T.orange}22`, border: `1px solid ${met ? T.green : T.orange}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {met ? (
              <CheckCircle2 style={{ width: 24, height: 24, color: '#5FD68A', flexShrink: 0 }} />
            ) : (
              <AlertCircle style={{ width: 24, height: 24, color: T.orange, flexShrink: 0 }} />
            )}
            <div>
              <p style={{ color: met ? '#8FE0AC' : '#F5B77A', margin: 0 }}>
                <strong>{mediaReq?.current}/{mediaReq?.required}</strong> images uploaded
                {!met && ` (Need ${mediaReq?.required - mediaReq?.current} more)`}
              </p>
              <p style={{ fontSize: 13, color: SUB, margin: 0 }}>
                {scanType === 'inward' ? 'Inward requires 2+ images' : 'Outward requires 1+ image'}
              </p>
            </div>
          </div>
        </div>

        {/* Capture Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Camera Capture */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ ...panelStyle, padding: 24, textAlign: 'center', cursor: 'pointer', color: TEXT }}
          >
            <Camera style={{ width: 40, height: 40, margin: '0 auto 8px', color: T.orange, display: 'block' }} />
            <p style={{ color: TEXT, fontWeight: 600, margin: 0 }}>Take Photo</p>
            <p style={{ color: SUB, fontSize: 12, margin: 0 }}>Camera capture</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => handleMediaCapture(e, 'image')}
            style={{ display: 'none' }}
          />

          {/* Gallery Upload */}
          <label style={{ ...panelStyle, padding: 24, textAlign: 'center', cursor: 'pointer', color: TEXT }}>
            <Upload style={{ width: 40, height: 40, margin: '0 auto 8px', color: '#9A6FE0', display: 'block' }} />
            <p style={{ color: TEXT, fontWeight: 600, margin: 0 }}>Gallery</p>
            <p style={{ color: SUB, fontSize: 12, margin: 0 }}>Upload images</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleMediaCapture(e, 'image')}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Video Capture (Optional) */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: SUB, fontSize: 13, marginBottom: 8 }}>Optional: Record Video</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
              style={{ ...panelStyle, padding: 16, textAlign: 'center', cursor: 'pointer', color: TEXT }}
            >
              <Video style={{ width: 32, height: 32, margin: '0 auto 4px', color: '#E8865A', display: 'block' }} />
              <p style={{ color: TEXT, fontSize: 14, margin: 0 }}>Record Video</p>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(e) => handleMediaCapture(e, 'video')}
              style={{ display: 'none' }}
            />

            <label style={{ ...panelStyle, padding: 16, textAlign: 'center', cursor: 'pointer', color: TEXT }}>
              <Video style={{ width: 32, height: 32, margin: '0 auto 4px', color: T.orange, display: 'block' }} />
              <p style={{ color: TEXT, fontSize: 14, margin: 0 }}>Upload Video</p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleMediaCapture(e, 'video')}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div style={{ ...panelStyle, marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Loader2 className="animate-spin" style={{ width: 20, height: 20, color: T.orange }} />
              <span style={{ color: TEXT }}>Uploading... {uploadProgress}%</span>
            </div>
            <div style={{ height: 8, background: PANEL2, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: T.orange, transition: 'all .3s', width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Media Grid */}
        {media.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ color: TEXT, fontWeight: 600, marginBottom: 8, ...headFont }}>
              Captured Media ({media.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {media.map((m) => (
                <div key={m.id} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: PANEL }}>
                  {m.media_type === 'image' ? (
                    <img
                      src={`${API}/gate/media/download/${m.id}`}
                      alt={m.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder.png';
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL2 }}>
                      <Video style={{ width: 32, height: 32, color: SUB }} />
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteMedia(m.id)}
                    style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 999, background: T.rose, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Trash2 style={{ width: 16, height: 16, color: TEXT }} />
                  </button>
                  <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(15,15,15,.85)', borderRadius: 6, padding: 4, display: 'inline-flex', color: TEXT }}>
                    {m.media_type === 'image' ? <ImageIcon style={{ width: 12, height: 12 }} /> : <Video style={{ width: 12, height: 12 }} />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fixed Bottom Buttons */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16, background: BG, borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Skip button - only show if coming from fresh scan, not pending upload */}
          {!selectedPendingScan && (
            <button
              onClick={() => {
                toast.info('Scan saved. Add photos later from "Pending" tab.');
                resetFlow();
              }}
              style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15, fontWeight: 700, ...headFont, border: `1px solid ${BORDER}`, background: 'transparent', color: T.iron200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Clock style={{ width: 20, height: 20 }} />
              Skip - Upload Photos Later
            </button>
          )}

          <button
            onClick={handleComplete}
            disabled={!met || uploading}
            style={{
              width: '100%', height: 56, borderRadius: 14, fontSize: 18, fontWeight: 800, ...headFont, color: TEXT, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: met ? accent : T.iron700,
              opacity: (!met || uploading) ? 0.7 : 1,
              cursor: (!met || uploading) ? 'not-allowed' : 'pointer',
            }}
            data-testid="btn-complete"
          >
            <Check style={{ width: 24, height: 24 }} />
            Complete {scanType === 'inward' ? 'Inward' : 'Outward'} Scan
          </button>
        </div>
      </div>
    );
  }

  // ============ RENDER STEP: COMPLETE ============
  if (currentStep === 'complete') {
    const accent = tone(scanType);
    return (
      <div style={{ ...screen, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Fonts />
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 999, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent }}>
            <CheckCircle2 style={{ width: 56, height: 56, color: TEXT }} />
          </div>

          <h1 style={{ ...headFont, fontSize: 26, fontWeight: 800, color: TEXT, marginBottom: 8 }}>
            {scanType === 'inward' ? 'Inward' : 'Outward'} Complete!
          </h1>

          <p style={{ color: SUB, marginBottom: 8 }}>Tracking ID:</p>
          <p style={{ fontSize: 20, ...monoFont, color: TEXT, marginBottom: 24 }}>{gateLog?.tracking_id}</p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            <span style={pill(T.iron700, TEXT)}>
              <ImageIcon style={{ width: 12, height: 12 }} />
              {media.filter(m => m.media_type === 'image').length} images
            </span>
            {media.filter(m => m.media_type === 'video').length > 0 && (
              <span style={pill(T.iron700, TEXT)}>
                <Video style={{ width: 12, height: 12 }} />
                {media.filter(m => m.media_type === 'video').length} videos
              </span>
            )}
          </div>

          <button
            onClick={scanNextSameType}
            style={{ width: '100%', height: 56, borderRadius: 14, fontSize: 18, fontWeight: 800, ...headFont, color: '#0F0F0F', background: T.orange, border: 'none', cursor: 'pointer', marginBottom: 10 }}
          >
            Scan next {scanType === 'inward' ? 'inward' : 'outward'} →
          </button>
          <button
            onClick={resetFlow}
            style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15, fontWeight: 700, ...headFont, color: TEXT, background: 'transparent', border: `1px solid ${BORDER}`, cursor: 'pointer' }}
            data-testid="btn-new-scan"
          >
            Change scan type
          </button>
        </div>
      </div>
    );
  }

  return null;
}
