import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/authService';

interface Event {
  _id: string;
  name: string;
  price: number;
}

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  teamName: string;
}

const EventRegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    teamName: '',
  });

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        if (!eventId) {
          setError('Event ID not found');
          setLoading(false);
          return;
        }

        const response = await apiClient.get(`/api/events/${eventId}`);
        const eventData = response.data.data || response.data;
        setEvent(eventData);
      } catch (err: any) {
        console.error('[EventRegistration] Error:', err.message);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setError('');

    try {
      await apiClient.post(`/api/events/${eventId}/register`, formData);

      console.log('[EventRegistration] Registration successful');
      navigate(`/events/${eventId}/confirmation`, { replace: true });
    } catch (err: any) {
      console.error('[EventRegistration] Error:', err.message);
      setError(err.response?.data?.message || 'Registration failed');
      setRegistering(false);
    }
  };

  if (loading) {
    return <div className="registration-page"><div className="loading">Loading...</div></div>;
  }

  if (error && !event) {
    return (
      <div className="registration-page">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/events')}>Back to Events</button>
      </div>
    );
  }

  return (
    <div className="registration-page">
      <button onClick={() => navigate(-1)} className="back-button">← Back</button>

      <div className="registration-container">
        <h1>Register for Event</h1>
        {event && <h2>{event.name}</h2>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <input
              id="fullName"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              required
              disabled={registering}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={registering}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone *</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              disabled={registering}
            />
          </div>

          <div className="form-group">
            <label htmlFor="teamName">Team Name (if applicable)</label>
            <input
              id="teamName"
              type="text"
              name="teamName"
              value={formData.teamName}
              onChange={handleInputChange}
              disabled={registering}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {event && (
            <div className="registration-summary">
              <p>Amount: ₹{event.price}</p>
            </div>
          )}

          <button type="submit" disabled={registering} className="submit-btn">
            {registering ? 'Processing...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EventRegistrationPage;
