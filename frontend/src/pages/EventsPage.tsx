import React, { useEffect, useState } from 'react';
import apiClient from '../services/authService';
import EventCard from '../components/EventCard';

interface Event {
  _id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: string;
  image: string;
  price: number;
  capacity: number;
  registeredCount: number;
}

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const fetchEvents = async (): Promise<void> => {
      try {
        console.log('[Events] Fetching events list');

        const response = await apiClient.get('/api/events');

        if (!response.data?.data) {
          throw new Error('No events data received');
        }

        console.log('[Events] Loaded:', response.data.data.length, 'events');
        setEvents(response.data.data);
        setFilteredEvents(response.data.data);
      } catch (err: any) {
        console.error('[Events] Error:', err.message);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handleCategoryFilter = (category: string): void => {
    setSelectedCategory(category);

    if (category === 'all') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(
        events.filter((e) => e.category.toLowerCase() === category.toLowerCase())
      );
    }
  };

  const categories = ['all', ...new Set(events.map((e) => e.category))];

  if (loading) {
    return (
      <div className="events-page">
        <div className="loading">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="events-page">
      <h1>Events</h1>

      <div className="events-filter">
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryFilter(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div className="events-grid">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => <ViewDetails key={event._id} event={event} />)
        ) : (
          <div className="no-events">No events found</div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
