import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/authService';

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

const EventDetailsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        if (!eventId) {
          setError('Event ID not found');
          setLoading(false);
          return;
        }

        console.log('[EventDetails] Fetching event:', eventId);

        const endpoints = [
          `/api/events/${eventId}`,
          `/api/events/id/${eventId}`,
          `/api/events/details/${eventId}`,
        ];

        let response = null;
        let lastError: any = null;

        for (const endpoint of endpoints) {
          try {
            response = await apiClient.get(endpoint);
            if (response.data?.success || response.data?._id) {
              break;
            }
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        if (!response || !response.data) {
          throw lastError || new Error('Event not found');
        }

        const eventData = response.data.data || response.data;
        console.log('[EventDetails] Event loaded:', eventData);

        setEvent(eventData);
      } catch (err: any) {
        console.error('[EventDetails] Error:', err.message);
        setError(err.response?.data?.message || 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  const handleRegister = () => {
    console.log('[EventRegister] Starting registration for event:', eventId);
    navigate(`/events/${eventId}/register`);
  };

  if (loading) {
    return (
      <div className="event-details">
        <div className="loading">Loading event details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-details">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/events')}>Back to Events</button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-details">
        <div className="error-message">Event not found</div>
        <button onClick={() => navigate('/events')}>Back to Events</button>
      </div>
    );
  }

  const availableSeats = event.capacity - event.registeredCount;

  return (
    <div className="event-details">
      <button onClick={() => navigate('/events')} className="back-button">← Back to Events</button>

      <div className="event-details-container">
        {event.image && <img src={event.image} alt={event.name} className="event-image" />}

        <div className="event-info">
          <h1>{event.name}</h1>

          <div className="event-meta">
            <div className="meta-item">
              <label>Category:</label>
              <span>{event.category}</span>
            </div>
            <div className="meta-item">
              <label>Date:</label>
              <span>{new Date(event.date).toLocaleDateString()}</span>
            </div>
            <div className="meta-item">
              <label>Time:</label>
              <span>{event.time}</span>
            </div>
            <div className="meta-item">
              <label>Location:</label>
              <span>{event.location}</span>
            </div>
          </div>

          <div className="event-description">
            <h2>About Event</h2>
            <p>{event.description}</p>
          </div>

          <div className="event-details-grid">
            <div className="detail-card">
              <label>Price</label>
              <span className="price">₹{event.price}</span>
            </div>
            <div className="detail-card">
              <label>Total Capacity</label>
              <span>{event.capacity} seats</span>
            </div>
            <div className="detail-card">
              <label>Registered</label>
              <span>{event.registeredCount}</span>
            </div>
            <div className="detail-card">
              <label>Available</label>
              <span>{Math.max(0, availableSeats)}</span>
            </div>
          </div>

          <div className="action-buttons">
            {availableSeats > 0 ? (
              <button className="register-btn" onClick={handleRegister}>
                Register Now
              </button>
            ) : (
              <button className="register-btn" disabled>
                Event Full
              </button>
            )}
            <button
              className="share-btn"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: event.name,
                    text: event.description,
                    url: window.location.href,
                  });
                }
              }}
            >
              Share Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsPage;
