import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, X, Clock } from "lucide-react";

import {
  admitUserAsync,
  rejectUserAsync,
  fetchWaitingList
} from "../../store/meetingSlice";

import {
  joinMeetingRoom,
  leaveMeetingRoom,
  bindMeetingSocketEvents
} from "../../features/ui/socket";

import "./meetingModule.css";

const WaitingRoomPanel = ({ meetingId }) => {

  const dispatch = useDispatch();

  const waitingRoom = useSelector(
    (state) => state.meetings.waitingRoom[meetingId]
  ) || [];

  // Load waiting list
  useEffect(() => {

    dispatch(fetchWaitingList(meetingId));

  }, [meetingId]);

  // Join socket room
  useEffect(() => {

    joinMeetingRoom(meetingId);

    bindMeetingSocketEvents({

      onWaitingRequest: () => {

        dispatch(fetchWaitingList(meetingId));

      },

      onUserAdmitted: () => {

        dispatch(fetchWaitingList(meetingId));

      },

      onUserRejected: () => {

        dispatch(fetchWaitingList(meetingId));

      }

    });

    return () => {
      leaveMeetingRoom(meetingId);
    };

  }, [meetingId]);

  const handleAdmit = (waitingId) => {

    dispatch(admitUserAsync({
      meetingId,
      waitingId
    }));

  };

  const handleReject = (waitingId) => {

    dispatch(rejectUserAsync({
      meetingId,
      waitingId
    }));

  };

  return (

    <div className="meeting-waiting-panel">

      <h3 className="meeting-waiting-panel-title">

        <Clock size={16} />
        Waiting Room

        {waitingRoom.length > 0 && (
          <span className="meeting-waiting-count">
            {waitingRoom.length}
          </span>
        )}

      </h3>

      {waitingRoom.length === 0 ? (

        <p className="meeting-waiting-empty">
          No pending requests.
        </p>

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

                <tr key={req.waitingId}>

                  <td className="meeting-waiting-name">
                    {req.name}
                  </td>

                  <td>
                    <span className="meeting-user-role">
                      {req.role || "Cadet"}
                    </span>
                  </td>

                  <td className="meeting-waiting-time">
                    {new Date(req.requestedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>

                  <td className="meeting-waiting-actions">

                    <button
                      className="meeting-btn meeting-btn-admit"
                      onClick={() => handleAdmit(req.waitingId)}
                    >
                      <Check size={14} />
                      Admit
                    </button>

                    <button
                      className="meeting-btn meeting-btn-reject"
                      onClick={() => handleReject(req.waitingId)}
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
