import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { 
  Phone, Mail, User, Package, Calendar, Clock, 
  Search, Filter, Plus, Edit2, Trash2, MessageSquare,
  TrendingUp, Users, UserCheck, UserX, PhoneCall
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-indigo-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { value: 'converted', label: 'Converted', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' }
];

const LEAD_SOURCES = [
  { value: 'voice_agent', label: 'Voice Agent' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'other', label: 'Other' }
];

export default function LeadsPage() {
  const { token, user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [users, setUsers] = useState([]);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      
      const res = await fetch(`${API}/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, sourceFilter]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.filter(u => ['admin', 'call_support'].includes(u.role)));
      }
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, [fetchLeads]);

  const handleCreateLead = async (formData) => {
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) form.append(key, value);
      });
      
      const res = await fetch(`${API}/api/leads/manual`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      
      if (res.ok) {
        toast.success('Lead created successfully');
        setShowAddModal(false);
        fetchLeads();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create lead');
      }
    } catch (err) {
      toast.error('Failed to create lead');
    }
  };

  const handleUpdateLead = async (leadId, updateData) => {
    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (res.ok) {
        toast.success('Lead updated');
        setShowEditModal(false);
        setSelectedLead(null);
        fetchLeads();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update lead');
      }
    } catch (err) {
      toast.error('Failed to update lead');
    }
  };

  const handleAddNote = async (leadId, note) => {
    try {
      const form = new FormData();
      form.append('note', note);
      
      const res = await fetch(`${API}/api/leads/${leadId}/add-note`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      
      if (res.ok) {
        toast.success('Note added');
        setShowNoteModal(false);
        setSelectedLead(null);
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Lead deleted');
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to delete lead');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = LEAD_STATUSES.find(s => s.value === status);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusConfig?.color || 'bg-gray-500'}`}>
        {statusConfig?.label || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6" data-testid="leads-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Leads</h1>
          <p className="text-gray-400 text-sm">Manage and track sales opportunities</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          data-testid="add-lead-btn"
        >
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
              <p className="text-xs text-gray-400">Total Leads</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <PhoneCall className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.new || 0}</p>
              <p className="text-xs text-gray-400">New</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.qualified || 0}</p>
              <p className="text-xs text-gray-400">Qualified</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.converted || 0}</p>
              <p className="text-xs text-gray-400">Converted</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <UserX className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.lost || 0}</p>
              <p className="text-xs text-gray-400">Lost</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            data-testid="lead-search"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
          data-testid="status-filter"
        >
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
          data-testid="source-filter"
        >
          <option value="">All Sources</option>
          {LEAD_SOURCES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="leads-table">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    No leads found
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-700/30 transition-colors" data-testid={`lead-row-${lead.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                          {(lead.name || 'L')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{lead.name}</p>
                          <p className="text-xs text-gray-500">ID: {lead.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300">{lead.product_interest || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm capitalize">{lead.source?.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm">{lead.assigned_to_name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{formatDate(lead.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedLead(lead); setShowEditModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                          title="Edit"
                          data-testid={`edit-lead-${lead.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedLead(lead); setShowNoteModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-green-400 transition-colors"
                          title="Add Note"
                          data-testid={`note-lead-${lead.id}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                            data-testid={`delete-lead-${lead.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <LeadFormModal
          title="Add New Lead"
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateLead}
          users={users}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <LeadFormModal
          title="Edit Lead"
          lead={selectedLead}
          onClose={() => { setShowEditModal(false); setSelectedLead(null); }}
          onSubmit={(data) => handleUpdateLead(selectedLead.id, data)}
          users={users}
          isEdit
        />
      )}

      {/* Add Note Modal */}
      {showNoteModal && selectedLead && (
        <AddNoteModal
          lead={selectedLead}
          onClose={() => { setShowNoteModal(false); setSelectedLead(null); }}
          onSubmit={(note) => handleAddNote(selectedLead.id, note)}
        />
      )}
    </div>
  );
}

// Lead Form Modal Component
function LeadFormModal({ title, lead, onClose, onSubmit, users, isEdit }) {
  const [formData, setFormData] = useState({
    phone: lead?.phone || '',
    name: lead?.name || '',
    email: lead?.email || '',
    product_interest: lead?.product_interest || '',
    source: lead?.source || 'walk_in',
    status: lead?.status || 'new',
    notes: lead?.notes || '',
    assigned_to: lead?.assigned_to || '',
    follow_up_date: lead?.follow_up_date || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                required
                disabled={isEdit}
                data-testid="lead-phone-input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                data-testid="lead-name-input"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              data-testid="lead-email-input"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Product Interest</label>
            <input
              type="text"
              value={formData.product_interest}
              onChange={(e) => setFormData({...formData, product_interest: e.target.value})}
              placeholder="e.g., Solar Inverter, Battery, Stabilizer"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              data-testid="lead-product-input"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                data-testid="lead-source-select"
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  data-testid="lead-status-select"
                >
                  {LEAD_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Assign To</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              data-testid="lead-assign-select"
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
              data-testid="lead-notes-input"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              data-testid="submit-lead-btn"
            >
              {isEdit ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Note Modal Component
function AddNoteModal({ lead, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (note.trim()) {
      onSubmit(note);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Add Note - {lead.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Enter your note about this lead..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none resize-none"
              required
              data-testid="add-note-input"
            />
          </div>
          
          {/* Show recent interactions */}
          {lead.interactions && lead.interactions.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Recent Activity:</p>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {lead.interactions.slice(-3).reverse().map((interaction, idx) => (
                  <div key={idx} className="text-xs text-gray-500 bg-gray-700/50 p-2 rounded">
                    <span className="text-gray-400">{interaction.type}</span>
                    {interaction.notes && <span> - {interaction.notes.slice(0, 50)}...</span>}
                    <span className="block text-gray-600">{new Date(interaction.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              data-testid="submit-note-btn"
            >
              Add Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
