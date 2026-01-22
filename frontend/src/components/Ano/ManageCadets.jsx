import { useState, useEffect } from "react";
import { FaEdit, FaTrash, FaSearch } from "react-icons/fa";

// ✅ ADDED "Alumni"
const ROLES = ["Cadet", "SUO", "Alumni"];

// ✅ ADDED "None"
const RANKS = [
  "Senior Under Officer", "Under Officer", "Company Sergeant Major",
  "Company Quarter Master Sergeant", "Sergeant", "Corporal", "Lance Corporal", "Cadet", 
  "None"
];

const ManageCadets = () => {
  const [search, setSearch] = useState("");
  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  // 1️⃣ FETCH DATA
  const fetchCadets = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/ano/cadets", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCadets(data);
      } else {
        console.error("Failed to fetch:", data.message);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCadets();
  }, []);

  // 🔥 LOGIC: Auto-select "None" in Edit Modal if Alumni is chosen
  useEffect(() => {
    if (selectedCadet && selectedCadet.role === "Alumni") {
      setSelectedCadet(prev => ({ ...prev, rank: "None" }));
    }
  }, [selectedCadet?.role]);

  // 2️⃣ HANDLE EDIT SAVE
  const handleSave = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:5000/api/ano/cadets/${selectedCadet.regimental_no}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: selectedCadet.name,
          email: selectedCadet.email,
          role: selectedCadet.role,
          rank: selectedCadet.rank
        })
      });

      if (response.ok) {
        alert("Cadet updated successfully");
        fetchCadets(); 
        setSelectedCadet(null);
      } else {
        const data = await response.json();
        alert(`Update failed: ${data.message}`);
      }
    } catch (err) {
      alert("Update failed due to network error");
    }
  };

  // 3️⃣ HANDLE DELETE
  const handleDelete = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:5000/api/ano/cadets/${showDeleteModal.regimental_no}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setCadets(prev => prev.filter(c => c.regimental_no !== showDeleteModal.regimental_no));
        setShowDeleteModal(null);
        alert("Cadet deleted successfully");
      } else {
        alert("Delete failed");
      }
    } catch (err) {
      alert("Delete failed due to network error");
    }
  };

  const filteredCadets = cadets.filter(c =>
    `${c.name} ${c.email} ${c.unit} ${c.regimental_no}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="manage-container">
      <h2 className="page-title">Manage Cadets</h2>
      <p className="page-subtitle">View and manage all registered cadets</p>

      <div className="search-bar">
        <FaSearch />
        <input
          placeholder="Search by name, email or unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-card table-responsive">
        {loading ? (
          <p style={{padding: "20px", textAlign: "center"}}>Loading Cadets...</p>
        ) : (
          <table className="cadet-table">
            <thead>
              <tr>
                <th>Cadet</th>
                <th>Regimental No</th>
                <th>Role</th>
                <th>Rank</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCadets.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign: "center"}}>No Cadets Found</td></tr>
              ) : (
                filteredCadets.map((cadet, index) => (
                  <tr key={index}>
                    <td>
                      <div className="user-info">
                        <div className="avatar">{cadet.name?.[0] || "C"}</div>
                        <div>
                          <strong>{cadet.name}</strong>
                          <p>{cadet.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{cadet.regimental_no}</td>
                    <td>
                      {/* 🔥 Badge Color for Alumni */}
                      <span className={`badge ${cadet.role === "Cadet" ? "green" : cadet.role === "Alumni" ? "gray" : "blue"}`}>
                        {cadet.role}
                      </span>
                    </td>
                    <td>{cadet.rank}</td>
                    <td>{cadet.unit}</td>
                    <td className="actions">
                      <button className="icon-btn edit" onClick={() => setSelectedCadet(cadet)}>
                        <FaEdit />
                      </button>
                      <button className="icon-btn delete" onClick={() => setShowDeleteModal(cadet)}>
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== Edit Modal ===== */}
      {selectedCadet && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Cadet</h3>
            
            <label>Name</label>
            <input
              value={selectedCadet.name}
              onChange={(e) => setSelectedCadet({ ...selectedCadet, name: e.target.value })}
            />

            <label>Email</label>
            <input
              value={selectedCadet.email}
              onChange={(e) => setSelectedCadet({ ...selectedCadet, email: e.target.value })}
            />

            <label>Role</label>
            <select
              value={selectedCadet.role}
              onChange={(e) => setSelectedCadet({ ...selectedCadet, role: e.target.value })}
            >
              {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
            </select>

            <label>Rank</label>
            <select
              value={selectedCadet.rank}
              onChange={(e) => setSelectedCadet({ ...selectedCadet, rank: e.target.value })}
              // Disable rank input if Alumni (it forces to None)
              disabled={selectedCadet.role === "Alumni"}
            >
              {RANKS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
            </select>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setSelectedCadet(null)}>Cancel</button>
              <button className="primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Modal ===== */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Are you sure?</h3>
            <p className="text">
              This will permanently delete <b>{showDeleteModal.name}</b>.
            </p>
            <div className="modal-actions">
              <button className="cancel-btnD" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="delete-btn" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCadets;