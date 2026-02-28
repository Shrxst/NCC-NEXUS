import React from 'react';
import { BrowserRouter, Route, Routes } from "react-router-dom";

// 1. Landing & Auth Imports
import Home from "./components/LandingPage/home";
import LoginPage from "./components/LandingPage/LoginPage";
import AnoLogin from "./components/LandingPage/AnoLogin";

// 2. Cadet Module
import CadetDashboard from "./components/Cadet/CadetDashboard";
import Feed from "./components/Cadet/Feed";
import Chatbot from "./components/Cadet/Chatbot";
import CadetChat from "./components/Cadet/CadetChat";

// 3. SUO Module
import SUODashboard from "./components/SUO/dashboard";
import SUOChat from "./components/SUO/SUOChat";

// 4. Alumni Module
import AlumniDashboard from "./components/Alumni/dashboard";
import AlumniChat from "./components/Alumni/AlumniChat";

// 5. Ano Module
import AnoDashboard from "./components/Ano/AnoDashboard";
import AddCadet from "./components/Ano/AddCadet";
import ManageCadets from "./components/Ano/ManageCadets";
import AnoChat from "./components/Ano/AnoChat";
import AnoAttendance from "./components/Ano/anoAttendance";
import AnoDashboardHome from "./components/Ano/AnoDashboardHome";

// 6. Meeting Module
import MeetingListPage from "./components/Meetings/MeetingListPage";
import MeetingCreatePage from "./components/Meetings/MeetingCreatePage";
import MeetingDetailsPage from "./components/Meetings/MeetingDetailsPage";
import MeetingRoomPage from "./components/Meetings/MeetingRoomPage";
import QuizModule from "./components/quiz/QuizModule";
import QuizLayout from "./components/quiz/QuizLayout";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* LANDING PAGE */}
        <Route path="/" element={<Home />} />

        {/* AUTH ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ano-login" element={<AnoLogin />} />

        {/* CADET ROUTES */}
        <Route path="/dashboard" element={<CadetDashboard />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/cadet/chat" element={<CadetChat />} />

        {/* SUO ROUTES */}
        <Route path="/suo-dashboard" element={<SUODashboard />} />
        <Route path="/suo/chat" element={<SUOChat />} />

        {/* ALUMNI ROUTES */}
        <Route path="/alumni-dashboard" element={<AlumniDashboard />} />
        <Route path="/alumni/chat" element={<AlumniChat />} />

        {/* MEETING ROUTES */}
        <Route path="/meetings" element={<MeetingListPage />} />
        <Route path="/meetings/create" element={<MeetingCreatePage />} />
        <Route path="/meetings/:meetingId" element={<MeetingDetailsPage />} />
        <Route path="/meetings/:meetingId/room" element={<MeetingRoomPage />} />

        <Route
          path="/quiz/attempt/:attemptId"
          element={
            <QuizLayout>
              <QuizModule attemptOnly />
            </QuizLayout>
          }
        />

        {/* ANO DASHBOARD ROUTES (Nested Layout) */}
        <Route path="/ano/*" element={<AnoDashboard />}>
          <Route index element={<AnoDashboardHome />} />
          <Route path="add-cadet" element={<AddCadet />} />
          <Route path="manage-cadets" element={<ManageCadets />} />
          <Route path="ano-attendance" element={<AnoAttendance />} />
          <Route path="chat" element={<AnoChat />} />
          <Route path="meetings" element={<MeetingListPage basePath="/ano/meetings" />} />
          <Route path="meetings/create" element={<MeetingCreatePage basePath="/ano/meetings" />} />
          <Route path="meetings/:meetingId" element={<MeetingDetailsPage basePath="/ano/meetings" />} />
          <Route path="meetings/:meetingId/room" element={<MeetingRoomPage basePath="/ano/meetings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
