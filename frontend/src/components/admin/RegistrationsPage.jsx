import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, Calendar, User, Mail, Phone, QrCode } from 'lucide-react';
import FestScannerSetup from './FestScannerSetup';
import { adminFetchJSON } from '../../utils/adminApi';

export default function RegistrationsPage() {
  const [fests, setFests] = useState([]);
  const [selectedFest, setSelectedFest] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [festSearch, setFestSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFests();
  }, []);

  const fetchFests = async () => {
    try {
      const data = await adminFetchJSON('/admin/fests?limit=500');
      setFests(data.fests || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load fests');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (festId) => {
    setRegistrationsLoading(true);
    try {
      const data = await adminFetchJSON(`/registrations/admin/fests/${festId}/registrations`);
      setRegistrations(data.registrations || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load registrations');
      setRegistrations([]);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const handleFestSelect = (fest) => {
    setSelectedFest(fest);
    setRegistrations([]);
    if (fest.registration?.mode === 'INTERNAL_FORM') {
      fetchRegistrations(fest._id);
    }
  };

  const updateRegistrationStatus = async (registrationId, status) => {
    try {
      await adminFetchJSON(`/registrations/admin/registrations/${registrationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      fetchRegistrations(selectedFest._id);
    } catch (err) {
      setError(err.message || 'Failed to update registration status');
    }
  };

  const filteredFests = useMemo(() => {
    const q = festSearch.trim().toLowerCase();
    if (!q) return fests;
    return fests.filter(
      (fest) =>
        fest.festName?.toLowerCase().includes(q) ||
        fest.collegeName?.toLowerCase().includes(q)
    );
  }, [fests, festSearch]);

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = reg.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reg.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-400 bg-green-900/20';
      case 'rejected': return 'text-red-400 bg-red-900/20';
      default: return 'text-yellow-400 bg-yellow-900/20';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Registration Management</h1>
        <p className="text-gray-400">View and manage fest registrations</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="underline hover:text-red-200 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {!selectedFest ? (
        <div className="bg-[#111213] border border-dashed border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <QrCode className="text-[#0ECCEE] shrink-0" size={24} />
          <div className="flex-1 text-sm text-gray-400">
            <span className="text-gray-200 font-medium">Organizer scanner login</span> — click a fest in the list below, or use{' '}
            <Link to="/admin/scanner-access" className="text-[#0ECCEE] hover:underline">
              Admin → Scanner Access
            </Link>{' '}
            to set fest code + password without selecting registrations.
          </div>
        </div>
      ) : (
        <FestScannerSetup festId={selectedFest._id} festName={selectedFest.festName} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fests List */}
        <div className="bg-[#111213] rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Select Fest</h2>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search fests..."
              value={festSearch}
              onChange={(e) => setFestSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1D1E20] border border-gray-700 rounded-lg text-sm focus:border-[#0ECCEE] focus:outline-none"
            />
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading fests...</div>
          ) : filteredFests.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {fests.length === 0 ? 'No fests found.' : `No fests match "${festSearch}"`}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredFests.map((fest) => (
                <button
                  key={fest._id}
                  onClick={() => handleFestSelect(fest)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFest?._id === fest._id
                      ? 'bg-[#0ECCEE]/20 border border-[#0ECCEE]/50'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="font-medium">{fest.festName}</div>
                  <div className="text-sm text-gray-400">{fest.collegeName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded ${
                      fest.registration?.mode === 'INTERNAL_FORM' 
                        ? 'bg-green-900/20 text-green-400'
                        : fest.registration?.mode === 'EXTERNAL_LINK'
                        ? 'bg-blue-900/20 text-blue-400'
                        : 'bg-gray-900/20 text-gray-400'
                    }`}>
                      {fest.registration?.mode === 'INTERNAL_FORM' ? 'Internal Form' :
                       fest.registration?.mode === 'EXTERNAL_LINK' ? 'External Link' :
                       'Not Started'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Registrations */}
        <div className="lg:col-span-2 bg-[#111213] rounded-xl p-6">
          {!selectedFest ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a fest to view registrations</p>
            </div>
          ) : selectedFest.registration?.mode !== 'INTERNAL_FORM' ? (
            <div className="text-center py-12 text-gray-400">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>This fest uses {selectedFest.registration?.mode === 'EXTERNAL_LINK' ? 'external registration' : 'no registration system'}</p>
              {selectedFest.registration?.mode === 'EXTERNAL_LINK' && (
                <a 
                  href={selectedFest.registration.externalLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#0ECCEE] hover:underline mt-2 inline-block"
                >
                  View External Form
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selectedFest.festName} Registrations</h2>
                  <p className="text-gray-400">{filteredRegistrations.length} registrations</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-[#1D1E20] border border-gray-700 rounded-lg focus:border-[#0ECCEE] focus:outline-none"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-[#1D1E20] border border-gray-700 rounded-lg focus:border-[#0ECCEE] focus:outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {registrationsLoading ? (
                <div className="text-center py-12 text-gray-400">Loading registrations...</div>
              ) : filteredRegistrations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No registrations found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRegistrations.map((registration) => (
                    <div key={registration._id} className="bg-[#1D1E20] rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#0ECCEE]/20 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-[#0ECCEE]" />
                          </div>
                          <div>
                            <h3 className="font-medium">{registration.user?.name}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {registration.user?.email}
                              </span>
                              {registration.user?.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {registration.user.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {/* Online payment badge */}
                          {registration.paymentStatus === 'paid' && (
                            <span
                              className="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 font-medium cursor-help"
                              title={`Payment ID: ${registration.payment_id || registration.payment_order_id || 'N/A'}`}
                            >
                              💳 Paid ₹{registration.amountPaid}
                            </span>
                          )}
                          {registration.paymentStatus === 'free' && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400">
                              Free
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(registration.status)}`}>
                            {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                          </span>
                          <select
                            value={registration.status}
                            onChange={(e) => updateRegistrationStatus(registration._id, e.target.value)}
                            className="text-xs px-2 py-1 bg-[#111213] border border-gray-700 rounded focus:border-[#0ECCEE] focus:outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </div>

                      {/* Registration Responses */}
                      {registration.responses && Object.keys(registration.responses).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <h4 className="text-sm font-medium mb-2">Registration Details:</h4>
                          
                          {/* Debug info for development */}
                          {import.meta.env.DEV && (
                            <div className="mb-2 p-2 bg-gray-800 rounded text-xs">
                              <strong>Debug:</strong> {JSON.stringify(registration.responses, null, 2)}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {Object.entries(registration.responses).map(([key, value]) => {
                              // Check if this is a file upload field (value has uploaded property)
                              const isFileField = value && typeof value === 'object' && value.uploaded;
                              let displayValue;
                              
                              if (isFileField) {
                                // Check for Cloudinary link first
                                if (value.cloudinaryLink) {
                                  displayValue = (
                                    <a 
                                      href={value.cloudinaryLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 underline"
                                    >
                                      📁 View File
                                    </a>
                                  );
                                } else if (value.driveLink && value.driveLink.startsWith('https://drive.google.com')) {
                                  // Legacy Google Drive link support
                                  displayValue = (
                                    <a 
                                      href={value.driveLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 underline"
                                    >
                                      📁 View File
                                    </a>
                                  );
                                } else {
                                  // Generic uploaded status
                                  displayValue = (
                                    <span className="text-green-400">
                                      ✅ File Uploaded
                                    </span>
                                  );
                                }
                              } else {
                                // Regular text field
                                displayValue = Array.isArray(value) ? value.join(', ') : 
                                              value || 'Not provided';
                              }
                              
                              return (
                                <div key={key} className="flex">
                                  <span className="text-gray-400 capitalize w-1/3">{key.replace(/_/g, ' ')}:</span>
                                  <span className={`w-2/3 ${isFileField ? '' : 'text-white'}`}>
                                    {displayValue}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2">
                        Submitted: {new Date(registration.submittedAt).toLocaleDateString()} at {new Date(registration.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}



