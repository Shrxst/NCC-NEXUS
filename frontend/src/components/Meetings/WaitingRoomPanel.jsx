import { useDispatch, useSelector } from "react-redux";
import { Check, X, Clock } from "lucide-react";
import { admitUser, rejectUser } from "../../store/meetingSlice";
import "./meetingModule.css";

const WaitingRoomPanel = ({ meetingId }) => {
  const dispatch = useDispatch();
  const waitingRoom = useSelector((state) => state.meetings.waitingRoom[meetingId] || []);

  const handleAdmit = (userId) => {
    dispatch(admitUser({ meetingId, userId }));
  };

  const handleReject = (userId) => {
    dispatch(rejectUser({ meetingId, userId }));
  };

  return (
    <div className="meeting-waiting-panel">
      <h3 className="meeting-waiting-panel-title">
        <Clock size={16} />
        Waiting Room
        {waitingRoom.length > 0 ? (
          <span className="meeting-waiting-count">{waitingRoom.length}</span>
        ) : null}
      </h3>

      {waitingRoom.length === 0 ? (
        <p className="meeting-waiting-empty">No pending requests.</p>
      ) : (
        <div className="meeting-waiting-table-wrap">
          <table className="meeting-waiting-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Requested At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitingRoom.map((req) => (
                <tr key={req.userId}>
                  <td className="meeting-waiting-name">{req.name}</td>
                  <td>
                    <span className="meeting-user-role">{req.role}</span>
                  </td>
                  <td className="meeting-waiting-time">
                    {new Date(req.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="meeting-waiting-actions">
                    <button
                      className="meeting-btn meeting-btn-admit"
                      onClick={() => handleAdmit(req.userId)}
                      title="Admit"
                    >
                      <Check size={14} />
                      Admit
                    </button>
                    <button
                      className="meeting-btn meeting-btn-reject"
                      onClick={() => handleReject(req.userId)}
                      title="Reject"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WaitingRoomPanel;
