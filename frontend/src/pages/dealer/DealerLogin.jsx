import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Users, Loader2, Phone, Mail, MapPin } from 'lucide-react';

export default function DealerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in as dealer, redirect to dealer dashboard
  useEffect(() => {
    if (user && user.role === 'dealer') {
      navigate('/dealer');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      
      if (loggedInUser.role !== 'dealer') {
        toast.error('This portal is only for authorized dealers. Please use the main CRM login.');
        return;
      }
      
      toast.success(`Welcome back, ${loggedInUser.first_name}!`);
      navigate('/dealer');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="py-4 px-6 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white font-['Barlow_Condensed']">MuscleGrid</span>
              <span className="text-orange-400 text-sm ml-2 font-medium">Partner Portal</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left side - Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 py-8">
          <h1 className="text-4xl font-bold text-white font-['Barlow_Condensed'] mb-4">
            Welcome to the<br />
            <span className="text-orange-400">Dealer Partner Portal</span>
          </h1>
          <p className="text-lg text-slate-300 mb-8 max-w-md">
            Your one-stop platform for managing orders, tracking dispatches, and growing your business with MuscleGrid.
          </p>
          
          <div className="space-y-4">
            <FeatureItem 
              icon="📦" 
              title="Easy Ordering" 
              description="Place orders 24/7 with real-time inventory visibility"
            />
            <FeatureItem 
              icon="🚚" 
              title="Track Dispatches" 
              description="Live updates on your order status and delivery"
            />
            <FeatureItem 
              icon="💰" 
              title="Dealer Pricing" 
              description="Access exclusive dealer rates and special offers"
            />
            <FeatureItem 
              icon="📄" 
              title="Invoice Management" 
              description="Download invoices and track payment history"
            />
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white font-['Barlow_Condensed']">MuscleGrid Partners</span>
              </div>
              <CardTitle className="text-2xl font-['Barlow_Condensed'] text-white">Dealer Login</CardTitle>
              <CardDescription className="text-slate-400">
                Sign in to access your dealer dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email or Phone</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="dealer@example.com or 9876543210"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500"
                    data-testid="dealer-login-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500"
                      data-testid="dealer-login-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                  disabled={loading}
                  data-testid="dealer-login-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-sm text-slate-400 text-center mb-4">
                  Not a registered dealer yet?
                </p>
                <div className="text-center mb-4">
                  <Link to="/partners/register">
                    <Button variant="outline" className="w-full border-orange-500 text-orange-400 hover:bg-orange-500/10">
                      Apply for Dealership
                    </Button>
                  </Link>
                </div>
                <div className="text-center space-y-2">
                  <a 
                    href="tel:+919800006416" 
                    className="flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Call: +91 98000 06416
                  </a>
                  <a 
                    href="mailto:service@musclegrid.in" 
                    className="flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    service@musclegrid.in
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>MuscleGrid Industries Private Limited | GST: 07AATCM1213F1ZM</span>
          </div>
          <p>© {new Date().getFullYear()} MuscleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="text-white font-medium">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}
