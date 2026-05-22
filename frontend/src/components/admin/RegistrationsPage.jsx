import { useEffect, useState } from 'react';
import { Eye, Download, Filter, Search, Calendar, User, Mail, Phone } from 'lucide-react';

// Configure API base URL - Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
console.log('🔧 RegistrationsPage - API_BASE_URL:', API_BASE_URL);

export default function RegistrationsPage() {
  const [fests, setFests] = useState([]);
  const [selectedFest, setSelectedFest] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchFests();
  }, []);

  const fetchFests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/fests`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFests(data.fests || []);
      }
    } catch (error) {
      console.error('Error fetching fests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (festId) => {
    setRegistrationsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/registrations/admin/fests/${festId}/registrations`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data.registrations || []);
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
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
      const response = await fetch(`${API_BASE_URL}/registrations/admin/registrations/${registrationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Refresh registrations
        fetchRegistrations(selectedFest._id);
      }
    } catch (error) {
      console.error('Error updating registration status:', error);
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fests List */}
        <div className="bg-[#111213] rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Select Fest</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading fests...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fests.map((fest) => (
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
                          {/* Razorpay payment badge */}
                          {registration.paymentStatus === 'paid' && (
                            <span
                              className="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 font-medium cursor-help"
                              title={`Razorpay Payment ID: ${registration.razorpay_payment_id}`}
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
                          {process.env.NODE_ENV === 'development' && (
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



