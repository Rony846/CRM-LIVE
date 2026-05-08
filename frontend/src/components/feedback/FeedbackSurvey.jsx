import React, { useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Star, Loader2, MessageSquare, Sparkles } from 'lucide-react';

const RatingStars = ({ label, value, onChange, description }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm text-slate-500">{value}/10</span>
      </div>
      {description && (
        <p className="text-xs text-slate-400">{description}</p>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
            key={star}
            type="button"
            className={`p-1 transition-all ${
              star <= (hover || value)
                ? 'text-yellow-400 scale-110'
                : 'text-gray-300 hover:text-yellow-200'
            }`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`w-6 h-6 ${star <= (hover || value) ? 'fill-current' : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default function FeedbackSurvey({ 
  open, 
  onOpenChange, 
  ticketId = null, 
  appointmentId = null,
  ticketNumber = null,
  onSuccess = () => {}
}) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState({
    communication: 0,
    resolution_speed: 0,
    professionalism: 0,
    overall: 0
  });
  const [comments, setComments] = useState('');

  const handleSubmit = async () => {
    // Validate all ratings are provided
    if (Object.values(ratings).some(r => r === 0)) {
      toast.error('Please provide all ratings');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/feedback`, {
        ticket_id: ticketId,
        appointment_id: appointmentId,
        ...ratings,
        comments: comments || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Thank you for your feedback!');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setRatings({ communication: 0, resolution_speed: 0, professionalism: 0, overall: 0 });
      setComments('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const averageRating = Object.values(ratings).filter(r => r > 0).length > 0
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).filter(r => r > 0).length).toFixed(1)
    : '0.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span>Share Your Experience</span>
              {ticketNumber && (
                <p className="text-sm font-normal text-slate-500">
                  Ticket: {ticketNumber}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Overall Score Preview */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100 text-center">
            <p className="text-sm text-slate-500 mb-1">Your Overall Rating</p>
            <p className="text-4xl font-bold text-blue-600">{averageRating}</p>
            <p className="text-xs text-slate-400">out of 10</p>
          </div>

          {/* Rating Categories */}
          <div className="space-y-5">
            <RatingStars
              label="Communication"
              description="How clearly did we communicate with you?"
              value={ratings.communication}
              onChange={(v) => setRatings({...ratings, communication: v})}
            />
            
            <RatingStars
              label="Resolution Speed"
              description="How quickly was your issue addressed?"
              value={ratings.resolution_speed}
              onChange={(v) => setRatings({...ratings, resolution_speed: v})}
            />
            
            <RatingStars
              label="Professionalism"
              description="How professional was our team?"
              value={ratings.professionalism}
              onChange={(v) => setRatings({...ratings, professionalism: v})}
            />
            
            <RatingStars
              label="Overall Experience"
              description="Your overall satisfaction"
              value={ratings.overall}
              onChange={(v) => setRatings({...ratings, overall: v})}
            />
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Additional Comments (Optional)
            </Label>
            <Textarea
              placeholder="Tell us more about your experience..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
