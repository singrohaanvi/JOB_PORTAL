import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import socket from "../../utils/socket";

const EmployerDashBoard = () => {
  const [overview, setOverview] = useState({
    total_jobs: 0,
    total_applications: 0,
    active_jobs: 0,
    inactive_jobs: 0,
    recent_applications: [],
  });

  // Fetch dashboard data
  const getDashboardOverView = async () => {
    try {
      const res = await axiosInstance.get("/employer/dashboard");
      setOverview(res.data.data);
    } catch (err) {
      console.log(err);
    }
  };

  // Fetch on page load
  useEffect(() => {
    getDashboardOverView();
  }, []);

  // 🔥 Real-Time WebSocket Listener
  useEffect(() => {
    socket.on("job_applied", (data) => {
      console.log("Real-Time: New application received", data);

      alert(`New Application Received for Job: ${data.jobId}`);

      // refresh dashboard instantly
      getDashboardOverView();
    });

    // cleanup
    return () => {
      socket.off("job_applied");
    };
  }, []);

  return (
    <div className="dashboard-container">
      <h2>Employer Dashboard</h2>

      {/* Stats Section */}
      <div className="stats">
        <div className="stat-box">
          <h3>Total Jobs</h3>
          <p>{overview.total_jobs}</p>
        </div>

        <div className="stat-box">
          <h3>Active Jobs</h3>
          <p>{overview.active_jobs}</p>
        </div>

        <div className="stat-box">
          <h3>Inactive Jobs</h3>
          <p>{overview.inactive_jobs}</p>
        </div>

        <div className="stat-box">
          <h3>Total Applications</h3>
          <p>{overview.total_applications}</p>
        </div>
      </div>

      {/* Recent Applications Section */}
      <h3>Recent Applications</h3>
      <ul>
        {overview.recent_applications.length === 0 ? (
          <p>No applications found</p>
        ) : (
          overview.recent_applications.map((app, index) => (
            <li key={index}>
              <strong>{app.candidate_name}</strong> applied for{" "}
              <span>{app.job_title}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default EmployerDashBoard;
