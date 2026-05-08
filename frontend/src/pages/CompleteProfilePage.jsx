import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, User, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CompleteProfilePage() {
  const { user, token, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const missingFields = location.state?.missingFields || [];

  const [formData, setFormData] = useState({
    first_name: user?.first_name === 'Customer' ? '' : user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email?.endsWith('@temp.musclegrid.in') ? '' : user?.email || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/auth/complete-profile`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local user state
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      toast.success('Profile completed successfully!');
      
      // Redirect to customer dashboard
      navigate('/customer');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update profile. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isFieldMissing = (field) => missingFields.includes(field);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-['Barlow_Condensed']">Complete Your Profile</CardTitle>
          <CardDescription>
            Please fill in the missing details to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="flex items-center gap-1">
                  First Name
                  {isFieldMissing('first_name') && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Your first name"
                  required={isFieldMissing('first_name')}
                  className={isFieldMissing('first_name') ? 'border-orange-300 focus:border-orange-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Your last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                Email Address
                {isFieldMissing('email') && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                required={isFieldMissing('email')}
                className={isFieldMissing('email') ? 'border-orange-300 focus:border-orange-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1">
                Address
                {isFieldMissing('address') && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="House/Flat No., Street, Locality"
                required={isFieldMissing('address')}
                className={isFieldMissing('address') ? 'border-orange-300 focus:border-orange-500' : ''}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-1">
                  City
                  {isFieldMissing('city') && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  required={isFieldMissing('city')}
                  className={isFieldMissing('city') ? 'border-orange-300 focus:border-orange-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode" className="flex items-center gap-1">
                  Pincode
                  {isFieldMissing('pincode') && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="pincode"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="Pincode"
                  maxLength={6}
                  required={isFieldMissing('pincode')}
                  className={isFieldMissing('pincode') ? 'border-orange-300 focus:border-orange-500' : ''}
                />
              </div>
            </div>

            {missingFields.length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                <p className="font-medium">Please fill in the highlighted fields to continue.</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
