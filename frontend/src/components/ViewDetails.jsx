import React from 'react';
import { Link } from 'react-router-dom';

const ViewDetails = ({ event }) => {
  const availableSeats = event.capacity - event.registeredCount;

  return (
    <Link to={`/events/${event._id}`} className="event-card-link">
      <div className="event-card">
        {event.image && (
          <img src={event.image} alt={event.name} className="event-image" />
        )}
        <div className="event-details">
          <h3>{event.name}</h3>
          <p className="event-date">{event.date} at {event.time}</p>
          <p className="event-location">{event.location}</p>
          <p className="event-category">{event.category}</p>
          <p className="event-price">₹{event.price}</p>
          <p className="event-seats">{availableSeats} seats available</p>
          <p className="event-description">{event.description}</p>
        </div>
      </div>
    </Link>
  );
};

export default ViewDetails;
