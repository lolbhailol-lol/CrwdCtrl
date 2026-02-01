import React from 'react';
import { Link } from 'react-router-dom';

const EventCard = ({ event }) => {
  const availableSeats = event.capacity - event.registeredCount;

  return (
    <Link to={`/events/${event._id}`} className="event-card-link">
      <div className="event-card">
        {event.image && (
          <img src={event.image} alt={event.name} className="event-image" />
        )}

        <div className="event-card-content">
          <h3 className="event-name">{event.name}</h3>

          <p className="event-description">
            {event.description?.substring(0, 100)}...
          </p>

          <div className="event-card-meta">
            <span className="category">{event.category}</span>
            <span className="date">{new Date(event.date).toLocaleDateString()}</span>
          </div>

          <div className="event-card-footer">
            <span className="price">₹{event.price}</span>
            <span className={`seats ${availableSeats > 0 ? 'available' : 'full'}`}>
              {availableSeats > 0 ? `${availableSeats} seats` : 'Full'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
