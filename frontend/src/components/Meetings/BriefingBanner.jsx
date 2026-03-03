import { Shield, VolumeX } from "lucide-react";
import "./meetingModule.css";

const BriefingBanner = ({ active }) => {
  if (!active) return null;

  return (
    <div className="meeting-briefing-banner">
      <div className="meeting-briefing-content">
        <Shield size={18} />
        <strong>Briefing Mode Active</strong>
        <span className="meeting-briefing-muted">
          <VolumeX size={14} />
          Participants muted
        </span>
      </div>
    </div>
  );
};

export default BriefingBanner;
