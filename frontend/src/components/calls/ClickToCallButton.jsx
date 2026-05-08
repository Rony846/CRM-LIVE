import { useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Phone, Loader2, PhoneCall, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClickToCallButton({ 
  phone, 
  customerName,
  ticketId,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  className = ''
}) {
  const { token, user } = useAuth();
  const [calling, setCalling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [callStatus, setCallStatus] = useState(null); // null, 'success', 'error'

  const headers = { Authorization: `Bearer ${token}` };

  const initiateCall = async () => {
    setCalling(true);
    setCallStatus(null);
    
    try {
      const res = await axios.post(`${API}/smartflo/click-to-call`, null, {
        headers,
        params: {
          customer_phone: phone,
          ticket_id: ticketId
        }
      });
      
      setCallStatus('success');
      toast.success(`Call initiated to ${phone}`);
      
      // Auto close after 3 seconds
      setTimeout(() => {
        setConfirmOpen(false);
        setCallStatus(null);
      }, 3000);
      
    } catch (err) {
      console.error('Click-to-call error:', err);
      setCallStatus('error');
      toast.error(err.response?.data?.detail || 'Failed to initiate call');
    } finally {
      setCalling(false);
    }
  };

  if (!phone) return null;

  // Clean phone for display
  const displayPhone = phone.replace('+91', '').replace('91', '');

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-1 text-green-600 border-green-600 hover:bg-green-50 ${className}`}
        onClick={() => setConfirmOpen(true)}
        title={`Call ${displayPhone}`}
        data-testid="click-to-call-btn"
      >
        <Phone className="w-3.5 h-3.5" />
        {showLabel && <span>Call</span>}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-green-400" />
              Click to Call
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {callStatus === 'success' ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-green-400">Call Initiated!</p>
                <p className="text-sm text-slate-400 mt-1">Your phone will ring first, then we'll connect to customer</p>
              </div>
            ) : callStatus === 'error' ? (
              <div className="text-center py-4">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-red-400">Call Failed</p>
                <p className="text-sm text-slate-400 mt-1">Please try again or contact admin</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-700 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm">Calling</p>
                  <p className="text-2xl font-bold text-white font-mono">{displayPhone}</p>
                  {customerName && (
                    <p className="text-cyan-400 text-sm mt-1">{customerName}</p>
                  )}
                </div>
                
                <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300">
                  <p className="flex items-center gap-2">
                    <span className="text-cyan-400">1.</span> Your phone will ring first
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-cyan-400">2.</span> Pick up to connect to customer
                  </p>
                </div>
              </div>
            )}
          </div>

          {!callStatus && (
            <DialogFooter>
              <Button 
                variant="ghost" 
                onClick={() => setConfirmOpen(false)}
                disabled={calling}
              >
                Cancel
              </Button>
              <Button
                onClick={initiateCall}
                disabled={calling}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                {calling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
                {calling ? 'Calling...' : 'Start Call'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
