import React from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";

function getEventStatus(value) {
  const eventDate = new Date(value).getTime();
  const diff = eventDate - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return { label: "Today", tone: "today" };
  if (days === 1) return { label: "Tomorrow", tone: "upcoming" };
  if (days > 1) return { label: `In ${days} days`, tone: "upcoming" };
  return { label: "Completed", tone: "completed" };
}

function toCalendarLink(eventDetails) {
  const start = new Date(eventDetails.date);
  const end = new Date(start.getTime() + 1000 * 60 * 60);
  const encodeDate = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventDetails.title || "NCC Event",
    dates: `${encodeDate(start)}/${encodeDate(end)}`,
    details: eventDetails.description || "",
    location: eventDetails.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function EventCard({ eventDetails }) {
  if (!eventDetails) return null;
  const status = getEventStatus(eventDetails.date);

  return (
    <div className="community-event-card">
      <div className="community-event-head">
        <div className="community-event-title-block">
          <h4>{eventDetails.title}</h4>
          {eventDetails.eventTag ? (
            <span className="community-event-tag">{eventDetails.eventTag}</span>
          ) : null}
        </div>
        <span className={`community-inline-chip community-event-status ${status.tone}`}>
          <Clock3 size={13} />
          {status.label}
        </span>
      </div>
      <div className="community-event-meta-line">
        <p className="community-event-date">
          <CalendarDays size={14} />
          {new Date(eventDetails.date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
        </p>
        <p className="community-event-location">
          <MapPin size={14} />
          {eventDetails.location}
        </p>
      </div>
      <p className="community-event-desc">{eventDetails.description}</p>
      <div className="community-event-footer">
        <a href={toCalendarLink(eventDetails)} target="_blank" rel="noreferrer">
          <FaArrowUpRightFromSquare size={14} />
          Add to Calendar
        </a>
      </div>
    </div>
  );
}
