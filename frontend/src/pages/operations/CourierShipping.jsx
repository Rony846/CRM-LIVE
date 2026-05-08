import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Package, Loader2, Search, Truck, MapPin, Phone, 
  CheckCircle, Clock, Building2, ArrowRight, FileText,
  Download, RefreshCw, Weight, Ruler, IndianRupee, User,
  Upload, AlertTriangle, Box, History
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function CourierShipping() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  
  // Warehouse data
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  
  // Form state
  const [shipmentCategory, setShipmentCategory] = useState('b2c');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
    alt_phone: '',
    address_line1: '',
    address_line2: '',
    landmark: '',
    pincode: '',
    invoice_number: '',
    invoice_amount: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    product_name: '',
    product_category: 'Electronics',
    hsn: '',
    payment_type: 'Prepaid',
    cod_amount: '',
    ewaybill_number: '',
  });
  
  // File uploads
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceBase64, setInvoiceBase64] = useState('');
  const [ewaybillFile, setEwaybillFile] = useState(null);
  const [ewaybillBase64, setEwaybillBase64] = useState('');
  
  // Rates
  const [rates, setRates] = useState([]);
  const [selectedRate, setSelectedRate] = useState(null);
  const [calculatingRates, setCalculatingRates] = useState(false);
  
  // Created shipment
  const [createdShipment, setCreatedShipment] = useState(null);
  const [manifestingShipment, setManifestingShipment] = useState(false);
  const [manifestedShipment, setManifestedShipment] = useState(null);
  
  // Shipment history
  const [shipments, setShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Label dialog
  const [labelDialog, setLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);
  const [downloadingLabel, setDownloadingLabel] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchShipments();
    }
  }, [activeTab]);

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(`${API}/courier/warehouses?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setWarehouses(response.data.warehouses);
        // Select first warehouse by default
        if (response.data.warehouses.length > 0) {
          setSelectedWarehouse(response.data.warehouses[0]);
        }
      }
    } catch (error) {
      toast.error('Failed to load warehouses');
    }
  };

  const fetchShipments = async () => {
    setShipmentsLoading(true);
    try {
      const params = new URLSearchParams({ page_size: '50' });
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await axios.get(`${API}/courier/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setShipments(response.data.shipments);
      }
    } catch (error) {
      toast.error('Failed to load shipments');
    } finally {
      setShipmentsLoading(false);
    }
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      toast.error('Only PDF or image files are allowed');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (type === 'invoice') {
        setInvoiceFile(file);
        setInvoiceBase64(base64);
      } else {
        setEwaybillFile(file);
        setEwaybillBase64(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateRates = async () => {
    if (!selectedWarehouse) {
      toast.error('Please select a pickup warehouse');
      return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error('Please enter a valid 6-digit destination pincode');
      return;
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      toast.error('Please enter package weight');
      return;
    }
    
    setCalculatingRates(true);
    setRates([]);
    setSelectedRate(null);
    
    try {
      const response = await axios.post(`${API}/courier/calculate-rates`, {
        shipment_category: shipmentCategory.toUpperCase(),
        payment_type: formData.payment_type,
        pickup_pincode: selectedWarehouse.address_pincode,
        destination_pincode: formData.pincode,
        invoice_amount: parseFloat(formData.invoice_amount) || 0,
        weight: parseFloat(formData.weight),
        length: parseInt(formData.length) || 10,
        width: parseInt(formData.width) || 10,
        height: parseInt(formData.height) || 10,
        risk_type: shipmentCategory === 'b2b' ? 'OwnerRisk' : ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setRates(response.data.rates);
        if (response.data.rates.length === 0) {
          toast.warning('No courier services available for this route');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate rates');
    } finally {
      setCalculatingRates(false);
    }
  };

  const createShipment = async () => {
    // Validation
    if (!selectedWarehouse) {
      toast.error('Please select a pickup warehouse');
      return;
    }
    if (!formData.first_name) {
      toast.error('Customer first name is required');
      return;
    }
    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Valid phone number is required');
      return;
    }
    if (!formData.address_line1) {
      toast.error('Address is required');
      return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error('Valid 6-digit pincode is required');
      return;
    }
    if (!formData.weight) {
      toast.error('Package weight is required');
      return;
    }
    
    // B2B validation for invoice > 50000
    const invoiceAmount = parseFloat(formData.invoice_amount) || 0;
    if (shipmentCategory === 'b2b' && invoiceAmount > 50000) {
      if (!formData.ewaybill_number) {
        toast.error('E-way bill number is required for B2B shipments over Rs. 50,000');
        return;
      }
    }
    
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        shipment_category: shipmentCategory,
        warehouse_id: selectedWarehouse.warehouse_id,
        invoice_amount: invoiceAmount,
        weight: parseFloat(formData.weight),
        length: parseInt(formData.length) || 10,
        width: parseInt(formData.width) || 10,
        height: parseInt(formData.height) || 10,
      };
      
      // Add invoice document if uploaded
      if (invoiceBase64) {
        payload.invoice_document = invoiceBase64;
      }
      
      // Add e-way bill document if uploaded
      if (ewaybillBase64) {
        payload.ewaybill_document = ewaybillBase64;
      }
      
      const response = await axios.post(`${API}/courier/create-shipment`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCreatedShipment(response.data);
        toast.success('Shipment created successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  const manifestShipment = async () => {
    if (!selectedRate) {
      toast.error('Please select a courier');
      return;
    }
    
    setManifestingShipment(true);
    
    try {
      const response = await axios.post(`${API}/courier/manifest`, {
        system_order_id: createdShipment.system_order_id,
        courier_id: selectedRate.courier_id,
        shipment_category: shipmentCategory,
        risk_type: shipmentCategory === 'b2b' ? 'OwnerRisk' : ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setManifestedShipment(response.data);
        toast.success(`AWB Generated: ${response.data.awb_number}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to manifest shipment');
    } finally {
      setManifestingShipment(false);
    }
  };

  const downloadLabel = async (systemOrderId) => {
    setDownloadingLabel(true);
    
    try {
      const response = await axios.get(`${API}/courier/label/${systemOrderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Convert base64 to blob and download
        const byteCharacters = atob(response.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.data.media_type });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${response.data.filename}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Label downloaded successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download label');
    } finally {
      setDownloadingLabel(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      company_name: '',
      phone: '',
      alt_phone: '',
      address_line1: '',
      address_line2: '',
      landmark: '',
      pincode: '',
      invoice_number: '',
      invoice_amount: '',
      weight: '',
      length: '',
      width: '',
      height: '',
      product_name: '',
      product_category: 'Electronics',
      hsn: '',
      payment_type: 'Prepaid',
      cod_amount: '',
      ewaybill_number: '',
    });
    setInvoiceFile(null);
    setInvoiceBase64('');
    setEwaybillFile(null);
    setEwaybillBase64('');
    setRates([]);
    setSelectedRate(null);
    setCreatedShipment(null);
    setManifestedShipment(null);
  };

  const getStatusBadge = (status) => {
    const styles = {
      created: 'bg-yellow-100 text-yellow-800',
      manifested: 'bg-green-100 text-green-800',
      in_transit: 'bg-blue-100 text-blue-800',
      delivered: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {status?.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="courier-shipping-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Courier Shipping
            </h1>
            <p className="text-muted-foreground">Create and manage courier shipments via Bigship</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="create" data-testid="tab-create">
              <Package className="h-4 w-4 mr-2" />
              Create Shipment
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Shipment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className={`flex items-center gap-2 ${!createdShipment ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!createdShipment ? 'bg-primary text-white' : 'bg-green-500 text-white'}`}>
                  {createdShipment ? <CheckCircle className="h-5 w-5" /> : '1'}
                </div>
                <span className="font-medium">Enter Details</span>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${createdShipment && !manifestedShipment ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${createdShipment && !manifestedShipment ? 'bg-primary text-white' : manifestedShipment ? 'bg-green-500 text-white' : 'bg-muted'}`}>
                  {manifestedShipment ? <CheckCircle className="h-5 w-5" /> : '2'}
                </div>
                <span className="font-medium">Select Courier</span>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${manifestedShipment ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${manifestedShipment ? 'bg-green-500 text-white' : 'bg-muted'}`}>
                  {manifestedShipment ? <CheckCircle className="h-5 w-5" /> : '3'}
                </div>
                <span className="font-medium">Download Label</span>
              </div>
            </div>

            {/* Success state - show label download */}
            {manifestedShipment ? (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-700 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Shipment Created Successfully!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Order ID</Label>
                      <p className="font-mono font-bold">{createdShipment.system_order_id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">AWB Number</Label>
                      <p className="font-mono font-bold text-primary">{manifestedShipment.awb_number}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Courier</Label>
                      <p className="font-medium">{manifestedShipment.courier_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">LR Number</Label>
                      <p className="font-mono">{manifestedShipment.lr_number}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button 
                      onClick={() => downloadLabel(createdShipment.system_order_id)}
                      disabled={downloadingLabel}
                      data-testid="download-label-btn"
                    >
                      {downloadingLabel ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download Shipping Label
                    </Button>
                    <Button variant="outline" onClick={resetForm} data-testid="new-shipment-btn">
                      Create New Shipment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : createdShipment ? (
              /* Step 2: Select Courier */
              <Card>
                <CardHeader>
                  <CardTitle>Select Courier Service</CardTitle>
                  <CardDescription>
                    Order ID: <span className="font-mono font-bold">{createdShipment.system_order_id}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rates.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">Calculate rates to see available courier options</p>
                      <Button onClick={calculateRates} disabled={calculatingRates}>
                        {calculatingRates ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Calculate Rates
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 max-h-96 overflow-y-auto">
                        {rates.map((rate) => (
                          <div
                            key={rate.courier_id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedRate?.courier_id === rate.courier_id
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedRate(rate)}
                            data-testid={`rate-option-${rate.courier_id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{rate.courier_name}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <Badge variant="outline">{rate.courier_type}</Badge>
                                  <span>Zone: {rate.zone}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {rate.tat} days
                                  </span>
                                  <span>Weight: {rate.billable_weight} kg</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-primary">
                                  Rs. {rate.total_shipping_charges}
                                </p>
                                {rate.other_additional_charges && (
                                  <p className="text-xs text-muted-foreground">
                                    Base: Rs. {rate.courier_charge}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-3 pt-4 border-t">
                        <Button 
                          onClick={manifestShipment}
                          disabled={!selectedRate || manifestingShipment}
                          className="flex-1"
                          data-testid="manifest-btn"
                        >
                          {manifestingShipment ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Truck className="h-4 w-4 mr-2" />
                          )}
                          Book {selectedRate?.courier_name || 'Courier'} - Rs. {selectedRate?.total_shipping_charges || 0}
                        </Button>
                        <Button variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Step 1: Enter Details */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Shipment Type Selection */}
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Shipment Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup 
                      value={shipmentCategory} 
                      onValueChange={setShipmentCategory}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="b2c" id="b2c" data-testid="radio-b2c" />
                        <Label htmlFor="b2c" className="cursor-pointer">
                          <span className="font-medium">B2C - Single/Surface</span>
                          <span className="text-muted-foreground ml-2">(Standard courier delivery)</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="b2b" id="b2b" data-testid="radio-b2b" />
                        <Label htmlFor="b2b" className="cursor-pointer">
                          <span className="font-medium">B2B - Heavy Shipment</span>
                          <span className="text-muted-foreground ml-2">(LTL/PTL freight)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Pickup Warehouse */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Pickup Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={selectedWarehouse?.warehouse_id?.toString()} 
                      onValueChange={(val) => {
                        const wh = warehouses.find(w => w.warehouse_id.toString() === val);
                        setSelectedWarehouse(wh);
                      }}
                    >
                      <SelectTrigger data-testid="warehouse-select">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.warehouse_id} value={wh.warehouse_id.toString()}>
                            {wh.warehouse_name} - {wh.address_city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedWarehouse && (
                      <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                        <p className="font-medium">{selectedWarehouse.warehouse_name}</p>
                        <p className="text-muted-foreground">{selectedWarehouse.address_line1}</p>
                        <p className="text-muted-foreground">{selectedWarehouse.address_city}, {selectedWarehouse.address_state}</p>
                        <p className="font-mono mt-1">PIN: {selectedWarehouse.address_pincode}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>First Name *</Label>
                        <Input 
                          placeholder="First name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div>
                        <Label>Last Name</Label>
                        <Input 
                          placeholder="Last name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                    
                    {shipmentCategory === 'b2b' && (
                      <div>
                        <Label>Company Name</Label>
                        <Input 
                          placeholder="Company name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                          data-testid="input-company"
                        />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Phone *</Label>
                        <Input 
                          placeholder="10-digit phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                          data-testid="input-phone"
                        />
                      </div>
                      <div>
                        <Label>Alt Phone</Label>
                        <Input 
                          placeholder="Alternate phone"
                          value={formData.alt_phone}
                          onChange={(e) => setFormData({...formData, alt_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Address */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Delivery Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Address Line 1 *</Label>
                      <Input 
                        placeholder="House/Building, Street"
                        value={formData.address_line1}
                        onChange={(e) => setFormData({...formData, address_line1: e.target.value})}
                        data-testid="input-address1"
                      />
                    </div>
                    <div>
                      <Label>Address Line 2</Label>
                      <Input 
                        placeholder="Area, Colony"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({...formData, address_line2: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Landmark</Label>
                        <Input 
                          placeholder="Near..."
                          value={formData.landmark}
                          onChange={(e) => setFormData({...formData, landmark: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Pincode *</Label>
                        <Input 
                          placeholder="6-digit PIN"
                          value={formData.pincode}
                          onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                          data-testid="input-pincode"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Package Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Box className="h-4 w-4" />
                      Package Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Product Name *</Label>
                      <Input 
                        placeholder="e.g., Solar Inverter 5KW"
                        value={formData.product_name}
                        onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                        data-testid="input-product"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Category</Label>
                        <Select 
                          value={formData.product_category}
                          onValueChange={(val) => setFormData({...formData, product_category: val})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Electronics">Electronics</SelectItem>
                            <SelectItem value="Machinery">Machinery</SelectItem>
                            <SelectItem value="Auto Parts">Auto Parts</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>HSN Code</Label>
                        <Input 
                          placeholder="HSN code"
                          value={formData.hsn}
                          onChange={(e) => setFormData({...formData, hsn: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label>Weight (kg) *</Label>
                        <Input 
                          type="number"
                          placeholder="KG"
                          value={formData.weight}
                          onChange={(e) => setFormData({...formData, weight: e.target.value})}
                          data-testid="input-weight"
                        />
                      </div>
                      <div>
                        <Label>L (cm)</Label>
                        <Input 
                          type="number"
                          placeholder="cm"
                          value={formData.length}
                          onChange={(e) => setFormData({...formData, length: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>W (cm)</Label>
                        <Input 
                          type="number"
                          placeholder="cm"
                          value={formData.width}
                          onChange={(e) => setFormData({...formData, width: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>H (cm)</Label>
                        <Input 
                          type="number"
                          placeholder="cm"
                          value={formData.height}
                          onChange={(e) => setFormData({...formData, height: e.target.value})}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Invoice & Payment */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      Invoice & Payment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Invoice Number</Label>
                        <Input 
                          placeholder="INV-XXXX"
                          value={formData.invoice_number}
                          onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                          data-testid="input-invoice-no"
                        />
                      </div>
                      <div>
                        <Label>Invoice Amount (Rs.)</Label>
                        <Input 
                          type="number"
                          placeholder="Amount"
                          value={formData.invoice_amount}
                          onChange={(e) => setFormData({...formData, invoice_amount: e.target.value})}
                          data-testid="input-invoice-amount"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Payment Type</Label>
                        <Select 
                          value={formData.payment_type}
                          onValueChange={(val) => setFormData({...formData, payment_type: val})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Prepaid">Prepaid</SelectItem>
                            <SelectItem value="COD">Cash on Delivery</SelectItem>
                            {shipmentCategory === 'b2b' && (
                              <SelectItem value="ToPay">To Pay</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.payment_type === 'COD' && (
                        <div>
                          <Label>COD Amount</Label>
                          <Input 
                            type="number"
                            placeholder="Amount to collect"
                            value={formData.cod_amount}
                            onChange={(e) => setFormData({...formData, cod_amount: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Invoice upload */}
                    <div>
                      <Label>Upload Invoice (PDF/Image)</Label>
                      <div className="mt-1">
                        <Input 
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => handleFileChange(e, 'invoice')}
                          className="cursor-pointer"
                        />
                        {invoiceFile && (
                          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {invoiceFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* E-way Bill (B2B with invoice > 50000) */}
                {shipmentCategory === 'b2b' && (
                  <Card className={parseFloat(formData.invoice_amount) > 50000 ? 'border-orange-300' : ''}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        E-Way Bill
                        {parseFloat(formData.invoice_amount) > 50000 && (
                          <Badge variant="destructive" className="ml-2">Required</Badge>
                        )}
                      </CardTitle>
                      {parseFloat(formData.invoice_amount) > 50000 && (
                        <CardDescription className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          E-way bill is mandatory for B2B shipments over Rs. 50,000
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>E-Way Bill Number {parseFloat(formData.invoice_amount) > 50000 && '*'}</Label>
                        <Input 
                          placeholder="12-digit e-way bill number"
                          value={formData.ewaybill_number}
                          onChange={(e) => setFormData({...formData, ewaybill_number: e.target.value})}
                          data-testid="input-ewaybill"
                        />
                      </div>
                      <div>
                        <Label>Upload E-Way Bill (PDF/Image)</Label>
                        <div className="mt-1">
                          <Input 
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => handleFileChange(e, 'ewaybill')}
                            className="cursor-pointer"
                          />
                          {ewaybillFile && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {ewaybillFile.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <Card className="lg:col-span-3">
                  <CardContent className="pt-6">
                    <div className="flex gap-3 justify-end">
                      <Button 
                        variant="outline"
                        onClick={calculateRates}
                        disabled={calculatingRates}
                        data-testid="calculate-rates-btn"
                      >
                        {calculatingRates ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Calculate Rates
                      </Button>
                      <Button 
                        onClick={createShipment}
                        disabled={loading}
                        data-testid="create-shipment-btn"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Package className="h-4 w-4 mr-2" />
                        )}
                        Create Shipment
                      </Button>
                    </div>
                    
                    {/* Rate preview */}
                    {rates.length > 0 && !createdShipment && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">Available Rates ({rates.length} options)</p>
                        <div className="flex flex-wrap gap-2">
                          {rates.slice(0, 5).map((rate) => (
                            <Badge key={rate.courier_id} variant="outline">
                              {rate.courier_name}: Rs.{rate.total_shipping_charges}
                            </Badge>
                          ))}
                          {rates.length > 5 && (
                            <Badge variant="secondary">+{rates.length - 5} more</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Shipment History</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name, phone, AWB..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                        onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
                      />
                    </div>
                    <Button variant="outline" onClick={fetchShipments} disabled={shipmentsLoading}>
                      <RefreshCw className={`h-4 w-4 ${shipmentsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {shipmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : shipments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No shipments found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>AWB</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.map((shipment) => (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-mono text-sm">
                            {shipment.bigship_order_id}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{shipment.customer_name}</p>
                              <p className="text-sm text-muted-foreground">{shipment.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{shipment.pincode}</p>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{shipment.product_name}</p>
                              <p className="text-xs text-muted-foreground">{shipment.weight} kg</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {shipment.awb_number || '-'}
                          </TableCell>
                          <TableCell>{shipment.courier_name || '-'}</TableCell>
                          <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                          <TableCell>
                            {shipment.status === 'manifested' && shipment.bigship_order_id && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => downloadLabel(shipment.bigship_order_id)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Label
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
