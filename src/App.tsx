import { HashRouter, Navigate, Route, Routes } from "react-router";
import { ScheduleApp } from "@/components/schedule-app";
import { AboutPage } from "@/pages/AboutPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ScheduleApp />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
