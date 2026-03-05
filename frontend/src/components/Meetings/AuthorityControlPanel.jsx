import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { PhoneOff, Shield, Users, Clock } from "lucide-react";
import { updateMeetingStatusAsync, toggleBriefingMode } from "../../store/meetingSlice";
import { MEETING_STATUS } from "./meetingUtils";
import "./meetingModule.css";

const AuthorityControlPanel = ({
  meeting,
  basePath = "/meetings",
  canToggleBriefing = true,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const participants = useSelector((state) => state.meetings.participants[meeting.id] || []);
  const waitingRoom = useSelector((state) => state.meetings.waitingRoom[meeting.id] || []);
  const isBriefing = useSelector((state) => state.meetings.briefingMode[meeting.id] || false);

  const endMeeting = () => {
    dispatch(updateMeetingStatusAsync({ meetingId: meeting.id, status: MEETING_STATUS.ENDED }));
    navigate(`${basePath}/${meeting.id}`);
  };

  const handleBriefingToggle = () => {
    dispatch(toggleBriefingMode({ meetingId: meeting.id }));
  };

  return (
    <div className="meeting-authority-panel">
      <h3 className="meeting-authority-panel-title">
        <Shield size={18} />
        Command Control Panel
      </h3>

      <div className="meeting-authority-stats">
        <div className="meeting-authority-stat">
          <Users size={16} />
          <span>{participants.length}</span>
          <label>Participants</label>
        </div>
        <div className="meeting-authority-stat">
          <Clock size={16} />
          <span>{waitingRoom.length}</span>
          <label>Waiting</label>
          {waitingRoom.length > 0 ? (
            <span className="meeting-authority-badge">{waitingRoom.length}</span>
          ) : null}
        </div>
      </div>

      <div className="meeting-authority-actions">
        {canToggleBriefing ? (
          <button
            className={`meeting-btn ${isBriefing ? "meeting-btn-briefing-active" : "meeting-btn-secondary"}`}
            onClick={handleBriefingToggle}
          >
            <Shield size={14} />
            {isBriefing ? "Briefing Mode ON" : "Briefing Mode"}
          </button>
        ) : null}

        <button className="meeting-btn meeting-btn-danger" onClick={endMeeting}>
          <PhoneOff size={14} />
          End Meeting
        </button>
      </div>
    </div>
  );
};

export default AuthorityControlPanel;
