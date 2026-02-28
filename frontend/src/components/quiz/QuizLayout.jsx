import React from "react";

export default function QuizLayout({ children }) {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflowX: "hidden",
        overflowY: "auto",
        background: "linear-gradient(140deg, #eef2ff 0%, #f7f9ff 45%, #ffffff 100%)",
      }}
    >
      {children}
    </div>
  );
}
