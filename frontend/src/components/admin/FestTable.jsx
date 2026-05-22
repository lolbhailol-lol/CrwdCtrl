import { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
import FestFormModal from './FestFormModal';
import CompetitionModal from './Competition_Modal';

const SECTION_OPTIONS = [
  { value: 'ongoing',     label: '🔥 Trending Now',   color: 'text-green-400' },
  { value: 'upcoming',    label: '⏳ Upcoming',        color: 'text-orange-400' },
  { value: 'beyondcampus',label: '🌍 Beyond Campus',  color: 'text-blue-400' },
  { value: 'lastyearhit', label: '⭐ Last Year Hit',  color: 'text-purple-400' },
  { value: 'completed',   label: '✅ Completed',       color: 'text-gray-400' },
];

// Configure API base URL - Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
console.log('🔧 FestTable - API_BASE_URL:', API_BASE_URL);

// Helper to clear server-side cache after admin operations
const clearServerCache = async () => {
  try {
    const token = localStorage.getItem('admin_token');
    await fetch(`${API_BASE_URL}/admin/clear-cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    console.log('✅ Server cache cleared');
  } catch (err) {
    console.warn('⚠️ Could not clear server cache:', err);
  }
};

// Simple drag and drop implementation
const useDragAndDrop = (items, onReorder) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedOverItem, setDraggedOverItem] = useState(null);

  const handleDragStart = (e, item, index) => {
    console.log('Drag start:', item.festName, index);
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e, item, index) => {
    e.preventDefault();
    if (draggedItem && draggedItem.item._id !== item._id) {
      setDraggedOverItem({ item, index });
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggedOverItem(null);
    }
  };

  const handleDrop = (e, item, index) => {
    e.preventDefault();
    console.log('Drop:', item.festName, index);
    
    if (draggedItem && draggedItem.item._id !== item._id) {
      console.log('Reordering from', draggedItem.index, 'to', index);
      onReorder(draggedItem.index, index);
    }
    
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  const handleDragEnd = () => {
    console.log('Drag end');
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  // Return object with all handlers and state
  return {
    draggedItem,
    draggedOverItem,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  };
};

export default function FestTable() {
  const [fests, setFests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedFest, setSelectedFest] = useState(null);
  const [showCompetition, setShowCompetition] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [editingPriority, setEditingPriority] = useState(null);
  const [priorityValues, setPriorityValues] = useState({});

  const fetchFests = () => {
    // Clear any cached data before fetching fresh data
    localStorage.removeItem('crwdctrl_fests_cache');
    localStorage.removeItem('crwdctrl_fests_timestamp');
    localStorage.removeItem('crwdctrl_fest_details_cache');
    
    fetch(`${API_BASE_URL}/admin/fests`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log('✅ Fetched fresh fests from backend:', data);
        setFests(data.fests || data);
      })
      .catch(err => console.error('Error fetching fests:', err));
  };

  useEffect(fetchFests, []);

  // Update individual fest priority
  const updateFestPriority = async (festId, priority) => {
    try {
      setIsReordering(true);
      
      // Convert empty string to null/undefined for default priority
      const priorityValue = priority === '' ? 999 : parseInt(priority);
      
      if (priority !== '' && (isNaN(priorityValue) || priorityValue < 1 || priorityValue > 999)) {
        alert('Priority must be a number between 1 and 999, or leave blank for default');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/fests/${festId}/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ priority: priorityValue })
      });

      if (response.ok) {
        fetchFests(); // Refresh the list
        setEditingPriority(null);
        setPriorityValues(prev => ({ ...prev, [festId]: '' }));
        
        // Notify other tabs/windows that admin data was updated
        localStorage.setItem('admin_data_updated', Date.now().toString());
        setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
        await clearServerCache();
      } else {
        const error = await response.json();
        alert(`Failed to update priority: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update priority');
    } finally {
      setIsReordering(false);
    }
  };

  const handlePriorityKeyPress = (e, festId) => {
    if (e.key === 'Enter') {
      updateFestPriority(festId, priorityValues[festId] || '');
    } else if (e.key === 'Escape') {
      setEditingPriority(null);
      setPriorityValues(prev => ({ ...prev, [festId]: '' }));
    }
  };

  const handlePriorityChange = (festId, value) => {
    setPriorityValues(prev => ({ ...prev, [festId]: value }));
  };

  const startEditingPriority = (festId, currentPriority) => {
    setEditingPriority(festId);
    setPriorityValues(prev => ({ 
      ...prev, 
      [festId]: currentPriority && currentPriority !== 999 ? currentPriority.toString() : '' 
    }));
  };

  const assignFestSection = async (id, status) => {
    await fetch(`${API_BASE_URL}/admin/fests/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
      },
      body: JSON.stringify({ status }),
    });
    await clearServerCache();
    localStorage.setItem('admin_data_updated', Date.now().toString());
    setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
    fetchFests();
  };

  const assignFestSlide = async (id, value) => {
    await fetch(`${API_BASE_URL}/admin/fests/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
      },
      body: JSON.stringify({ showOnHomeSlide: value }),
    });
    await clearServerCache();
    fetchFests();
  };

  const deleteFest = async (id) => {
    await fetch(`${API_BASE_URL}/admin/fests/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`
      }
    });
    await clearServerCache();
    fetchFests();
  };

  // Group fests by status for better priority management
  const festsByStatus = {
    ongoing: fests.filter(f => f.status === 'ongoing').sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    upcoming: fests.filter(f => f.status === 'upcoming').sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    beyondcampus: fests.filter(f => f.status === 'beyondcampus').sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    completed: fests.filter(f => f.status === 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  };

  // Reorder function for each section
  const handleReorder = async (section, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    setIsReordering(true);
    
    try {
      const currentList = [...festsByStatus[section]];
      const [movedItem] = currentList.splice(fromIndex, 1);
      currentList.splice(toIndex, 0, movedItem);

      // Create priority updates based on new order
      const festUpdates = currentList.map((fest, index) => ({
        festId: fest._id,
        priority: index + 1
      }));

      console.log('Reordering:', section, 'from', fromIndex, 'to', toIndex);
      console.log('Updates:', festUpdates);

      const response = await fetch(`${API_BASE_URL}/admin/fests/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ festUpdates })
      });

      if (response.ok) {
        fetchFests();
        
        // Notify other tabs/windows that admin data was updated
        localStorage.setItem('admin_data_updated', Date.now().toString());
        setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
        await clearServerCache();
      } else {
        console.error('Failed to reorder fests');
      }
    } catch (error) {
      console.error('Error reordering fests:', error);
    } finally {
      setIsReordering(false);
    }
  };

  // Drag and drop hooks for each section
  const ongoingDnd = useDragAndDrop(festsByStatus.ongoing || [], (from, to) => handleReorder('ongoing', from, to));
  const upcomingDnd = useDragAndDrop(festsByStatus.upcoming || [], (from, to) => handleReorder('upcoming', from, to));
  const beyondCampusDnd = useDragAndDrop(festsByStatus.beyondcampus || [], (from, to) => handleReorder('beyondcampus', from, to));

  // Priority cell component
  const PriorityCell = ({ fest }) => {
    const isEditing = editingPriority === fest._id;
    const currentValue = priorityValues[fest._id] || '';
    const displayPriority = fest.priority && fest.priority !== 999 ? fest.priority : '';

    if (isEditing) {
      return (
        <td className="py-4">
          <input
            type="number"
            min="1"
            max="999"
            value={currentValue}
            onChange={(e) => handlePriorityChange(fest._id, e.target.value)}
            onKeyDown={(e) => handlePriorityKeyPress(e, fest._id)}
            onBlur={() => updateFestPriority(fest._id, currentValue)}
            className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-white"
            placeholder="Auto"
            autoFocus
          />
        </td>
      );
    }

    return (
      <td className="py-4">
        <button
          onClick={() => startEditingPriority(fest._id, fest.priority)}
          className="w-16 px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition-colors text-center"
          title="Click to edit priority (1=highest, blank=default)"
        >
          {displayPriority || 'Auto'}
        </button>
      </td>
    );
  };

  // Draggable row component
  const DraggableRow = ({ fest, index, dndHandlers, children }) => {
    // Safety check for dndHandlers - provide default empty handlers if undefined
    const safeHandlers = dndHandlers || {
      draggedItem: null,
      draggedOverItem: null,
      handleDragStart: () => {},
      handleDragOver: () => {},
      handleDragEnter: () => {},
      handleDragLeave: () => {},
      handleDrop: () => {},
      handleDragEnd: () => {}
    };

    const isDragging = safeHandlers.draggedItem && safeHandlers.draggedItem.item._id === fest._id;
    const isDraggedOver = safeHandlers.draggedOverItem && safeHandlers.draggedOverItem.item._id === fest._id;

    return (
      <tr
        draggable={!!dndHandlers}
        onDragStart={(e) => safeHandlers.handleDragStart(e, fest, index)}
        onDragOver={safeHandlers.handleDragOver}
        onDragEnter={(e) => safeHandlers.handleDragEnter(e, fest, index)}
        onDragLeave={safeHandlers.handleDragLeave}
        onDrop={(e) => safeHandlers.handleDrop(e, fest, index)}
        onDragEnd={safeHandlers.handleDragEnd}
        className={`border-b border-gray-800 transition-all duration-200 select-none ${
          isDragging ? 'opacity-50 scale-95 bg-blue-900/20' : ''
        } ${
          isDraggedOver ? 'bg-blue-900/30 border-blue-500 border-2' : 'hover:bg-gray-800/30'
        } ${dndHandlers ? 'cursor-move' : 'cursor-default'}`}
      >
        {children}
      </tr>
    );
  };

  return (
    <div className="bg-[#111213] rounded-xl p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-semibold">Fests</h2>
        <button
          onClick={() => { setSelectedFest(null); setShowForm(true); }}
          className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
        >
          + Create Fest
        </button>
      </div>

      {fests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No fests found. Create your first fest!
        </div>
      ) : (
        <div className="space-y-8">
          {isReordering && (
            <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
              Updating order...
            </div>
          )}

          {/* Ongoing Fests */}
          {festsByStatus.ongoing.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-green-400 flex items-center">
                🟢 Ongoing Fests
                <span className="ml-2 text-sm text-gray-400">(Drag to reorder or click priority to edit)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="pb-3 w-12"></th>
                      <th className="pb-3 w-20">Priority</th>
                      <th className="pb-3">Fest Name</th>
                      <th className="pb-3">College</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {festsByStatus.ongoing.map((fest, index) => (
                      <DraggableRow key={fest._id} fest={fest} index={index} dndHandlers={ongoingDnd}>
                        <td className="py-4">
                          <div className="flex items-center justify-center">
                            <div 
                              className="p-2 hover:bg-gray-700 rounded cursor-grab active:cursor-grabbing transition-colors"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                            </div>
                          </div>
                        </td>
                        <PriorityCell fest={fest} />
                        <td className="py-4 font-medium">{fest.festName}</td>
                        <td className="py-4 text-gray-300">{fest.collegeName}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                            {fest.festType}
                          </span>
                        </td>
                        <td className="py-4 text-gray-400 text-sm">{fest.festDate || 'N/A'}</td>
                        <td className="py-4">
                          <div className="flex gap-2 justify-end flex-wrap">
                            <button
                              onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                            >
                              Competitions
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${fest.festName}"?`)) {
                                  deleteFest(fest._id);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </DraggableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upcoming Fests */}
          {festsByStatus.upcoming.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400 flex items-center">
                🟠 Upcoming Fests
                <span className="ml-2 text-sm text-gray-400">(Drag to reorder or click priority to edit)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="pb-3 w-12"></th>
                      <th className="pb-3 w-20">Priority</th>
                      <th className="pb-3">Fest Name</th>
                      <th className="pb-3">College</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {festsByStatus.upcoming.map((fest, index) => (
                      <DraggableRow key={fest._id} fest={fest} index={index} dndHandlers={upcomingDnd}>
                        <td className="py-4">
                          <div className="flex items-center justify-center">
                            <div 
                              className="p-2 hover:bg-gray-700 rounded cursor-grab active:cursor-grabbing transition-colors"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                            </div>
                          </div>
                        </td>
                        <PriorityCell fest={fest} />
                        <td className="py-4 font-medium">{fest.festName}</td>
                        <td className="py-4 text-gray-300">{fest.collegeName}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                            {fest.festType}
                          </span>
                        </td>
                        <td className="py-4 text-gray-400 text-sm">{fest.festDate || 'N/A'}</td>
                        <td className="py-4">
                          <div className="flex gap-2 justify-end flex-wrap">
                            <button
                              onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                            >
                              Competitions
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${fest.festName}"?`)) {
                                  deleteFest(fest._id);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </DraggableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Beyond Campus Fests */}
          {festsByStatus.beyondcampus.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-cyan-400 flex items-center">
                🔵 Beyond Campus Fests
                <span className="ml-2 text-sm text-gray-400">(Drag to reorder or click priority to edit)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="pb-3 w-12"></th>
                      <th className="pb-3 w-20">Priority</th>
                      <th className="pb-3">Fest Name</th>
                      <th className="pb-3">College</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {festsByStatus.beyondcampus.map((fest, index) => (
                      <DraggableRow key={fest._id} fest={fest} index={index} dndHandlers={beyondCampusDnd}>
                        <td className="py-4">
                          <div className="flex items-center justify-center">
                            <div 
                              className="p-2 hover:bg-gray-700 rounded cursor-grab active:cursor-grabbing transition-colors"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                            </div>
                          </div>
                        </td>
                        <PriorityCell fest={fest} />
                        <td className="py-4 font-medium">{fest.festName}</td>
                        <td className="py-4 text-gray-300">{fest.collegeName}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                            {fest.festType}
                          </span>
                        </td>
                        <td className="py-4 text-gray-400 text-sm">{fest.festDate || 'N/A'}</td>
                        <td className="py-4">
                          <div className="flex gap-2 justify-end flex-wrap">
                            <button
                              onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                            >
                              Competitions
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${fest.festName}"?`)) {
                                  deleteFest(fest._id);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </DraggableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completed Fests (No Drag and Drop) */}
          {festsByStatus.completed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-400 flex items-center">
                ⚫ Completed Fests
                <span className="ml-2 text-sm text-gray-500">(Chronological order)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="pb-3">Fest Name</th>
                      <th className="pb-3">College</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {festsByStatus.completed.map(fest => (
                      <tr key={fest._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="py-4 font-medium">{fest.festName}</td>
                        <td className="py-4 text-gray-300">{fest.collegeName}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                            {fest.festType}
                          </span>
                        </td>
                        <td className="py-4 text-gray-400 text-sm">{fest.festDate || 'N/A'}</td>
                        <td className="py-4">
                          <div className="flex gap-2 justify-end flex-wrap">
                            <button
                              onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                            >
                              Competitions
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${fest.festName}"?`)) {
                                  deleteFest(fest._id);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <FestFormModal
          fest={selectedFest}
          onClose={() => setShowForm(false)}
          onSaved={fetchFests}
        />
      )}

      {showCompetition && (
        <CompetitionModal
          fest={selectedFest}
          onClose={() => setShowCompetition(false)}
          onSaved={fetchFests}
        />
      )}
    </div>
  );
}
