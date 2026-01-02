import { useState } from "react";
import { FaEdit, FaTrash, FaSearch } from "react-icons/fa";
const ROLES = ["Cadet", "SUO", "Alumni"];

const RANKS = [
  "Senior Under Officer",
  "Under Officer",
  "Company Sergeant Major",
  "Company Quarter Master Sergeant",
  "Sergeant",
  "Corporal",
  "Lance Corporal",
  "Cadet"
];

const ManageCadets = () => {
  const [search, setSearch] = useState("");
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
const [cadets, setCadets] = useState([
  {
    name: "Shami Dubey",
    email: "shami.dubey@example.com",
    role: "Cadet",
    rank: "Sergeant",
    unit: "SGSITS",
  },
  {
    name: "Rahul Kumar",
    email: "rahul.kumar@example.com",
    role: "SUO",
    rank: "Under Officer",
    unit: "SGSITS",
  },
]);

const handleSave = () => {
  setCadets(prev =>
    prev.map(c =>
      c.email === selectedCadet.email ? selectedCadet : c
    )
  );
  setSelectedCadet(null); // close modal
};

  const filteredCadets = cadets.filter(c =>
    `${c.name} ${c.email} ${c.unit}`.toLowerCase().includes(search.toLowerCase())
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

      <div className="table-card">
        <table className="cadet-table">
          <thead>
            <tr>
              <th>Cadet</th>
              <th>Role</th>
              <th>Rank</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCadets.map((cadet, index) => (
              <tr key={index}>
                <td>
                  <div className="user-info">
                    <div className="avatar">{cadet.name[0]}</div>
                    <div>
                      <strong>{cadet.name}</strong>
                      <p>{cadet.email}</p>
                    </div>
                  </div>
                </td>

                <td>
                  <span className={`badge ${cadet.role === "Cadet" ? "green" : "blue"}`}>
                    {cadet.role}
                  </span>
                </td>

                <td>{cadet.rank}</td>
                <td>{cadet.unit}</td>

                <td className="actions">
                  <button
                     className="icon-btn edit"
                     onClick={() => setSelectedCadet(cadet)}
>
  <FaEdit />
</button>


                 <button
  className="icon-btn delete"
  onClick={() => setShowDeleteModal(cadet)}
>
  <FaTrash />
</button>


                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Edit Modal ===== */}
     {selectedCadet && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Edit Cadet</h3>

      <label>Name</label>
      <input
        value={selectedCadet.name}
        onChange={(e) =>
          setSelectedCadet({ ...selectedCadet, name: e.target.value })
        }
      />

      <label>Email</label>
      <input
        value={selectedCadet.email}
        onChange={(e) =>
          setSelectedCadet({ ...selectedCadet, email: e.target.value })
        }
      />

      <label>Role</label>
<select
  value={selectedCadet.role}
  onChange={(e) =>
    setSelectedCadet({ ...selectedCadet, role: e.target.value })
  }
>
  {ROLES.map(role => (
    <option key={role} value={role}>{role}</option>
  ))}
</select>

<label>Rank</label>
<select
  value={selectedCadet.rank}
  onChange={(e) =>
    setSelectedCadet({ ...selectedCadet, rank: e.target.value })
  }
>
  {RANKS.map(rank => (
    <option key={rank} value={rank}>{rank}</option>
  ))}
</select>


      <label>Unit</label>
      <input
        value={selectedCadet.unit}
        onChange={(e) =>
          setSelectedCadet({ ...selectedCadet, unit: e.target.value })
        }
      />

      <div className="modal-actions">
        <button class="cancel-btn" onClick={() => setSelectedCadet(null)}>Cancel</button>
        <button className="primary" onClick={handleSave}>
  Save Changes
</button>

      </div>
    </div>
  </div>
)}

 {/*delete modal  */}
{showDeleteModal && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Are you sure?</h3>
      <p className="text">
        This will permanently delete <b>{showDeleteModal.name}</b>.
        This action cannot be undone.
      </p>

      <div className="modal-actions">
        <button
          className="cancel-btnD"
          onClick={() => setShowDeleteModal(null)}
        >
          Cancel
        </button>

        <button
          className="delete-btn"
          onClick={() => {
            // remove cadet
            setCadets(prev =>
              prev.filter(c => c.email !== showDeleteModal.email)
            );
            setShowDeleteModal(null);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default ManageCadets;
