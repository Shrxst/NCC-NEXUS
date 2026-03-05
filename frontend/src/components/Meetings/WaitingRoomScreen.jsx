import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Clock, LogOut } from "lucide-react";

import { requestAdmissionAsync } from "../../store/meetingSlice";

import {
  joinMeetingRoom,
  leaveMeetingRoom,
  bindMeetingSocketEvents,
} from "../../features/ui/socket";

import {
  formatMeetingDateTime,
  getCurrentUser
} from "./meetingUtils";

import "./meetingModule.css";

const WaitingRoomScreen = ({ meeting, basePath = "/meetings" }) => {

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const currentUser = getCurrentUser();

  const admittedUsers = useSelector(
    (state) => state.meetings.admittedUsers[meeting.id]
  ) || [];

  const isAdmitted = admittedUsers.includes(Number(currentUser.id));

  useEffect(() => {
    dispatch(
      requestAdmissionAsync({
        meetingId: meeting.id,
      })
    );
  }, [dispatch, meeting.id]);

  useEffect(() => {
    joinMeetingRoom(meeting.id);

    bindMeetingSocketEvents({
      onUserAdmitted: ({ meetingId, userId }) => {
        if (
          String(meetingId) === String(meeting.id) &&
          Number(userId) === Number(currentUser.id)
        ) {
          navigate(`${basePath}/${meeting.id}/room`);
        }
      },

      onMeetingEnded: () => {
        navigate(basePath);
      }
    });

    return () => {
      leaveMeetingRoom(meeting.id);
    };
  }, [basePath, currentUser.id, meeting.id, navigate]);

  if (isAdmitted) return null;

  const handleLeave = () => {
    navigate(basePath);
  };

  return (
    <div className="meeting-waiting-room">
      <div className="meeting-waiting-card">

        <div className="meeting-waiting-icon">
          <Clock size={48} />
        </div>

        <h2>Waiting for Host Approval</h2>

        <p className="meeting-waiting-subtitle">
          You will be admitted once the host approves your request.
        </p>

        <div className="meeting-waiting-info">

          <h3>{meeting.title}</h3>

          <p>
            <strong>Scheduled:</strong>{" "}
            {formatMeetingDateTime(meeting.dateTime)}
          </p>

          <p>
            <strong>Requested at:</strong>{" "}
            {new Date().toLocaleTimeString()}
          </p>

        </div>

        <div className="meeting-waiting-dots">
          <span className="meeting-dot" />
          <span className="meeting-dot" />
          <span className="meeting-dot" />
        </div>

        <button
          className="meeting-btn meeting-btn-danger meeting-waiting-leave"
          onClick={handleLeave}
        >
          <LogOut size={16} />
          Leave Waiting Room
        </button>

      </div>
    </div>
  );

};

export default WaitingRoomScreen;
