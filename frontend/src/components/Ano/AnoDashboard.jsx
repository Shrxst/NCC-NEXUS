import { Outlet } from "react-router-dom";
import Sidebar from "./SideBar";

const AnoDashboard = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        
        <Outlet />
      </main>
    </div>
  );
};

export default AnoDashboard;
