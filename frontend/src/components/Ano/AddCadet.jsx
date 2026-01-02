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
const AddCadet = () => {
  return (
    <div className="add-cadet-container">

      {/* 🔹 PAGE HEADER */}
      <div className="page-header">
        <h1>Add Cadet</h1>
        <p>Manage your NCC unit effectively</p>
      </div>

      {/* FORM CARD */}
      <div className="card">
        <div className="form-group">
          <label>Full Name</label>
          <input placeholder="Enter full name" />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input placeholder="cadet@example.com" />
        </div>

        <div className="form-group">
          <label>Regimental Number</label>
          <input placeholder="Enter regimental number" />
        </div>
  <div className="form-group">
  <label>Role</label>
  <select>
    <option value="">Select Role</option>
    {ROLES.map(role => (
      <option key={role} value={role}>{role}</option>
    ))}
  </select>
</div>

<div className="form-group">
  <label>Rank</label>
  <select>
    <option value="">Select Rank</option>
    {RANKS.map(rank => (
      <option key={rank} value={rank}>{rank}</option>
    ))}
  </select>
</div>

        <div className="form-group">
          <label>Year</label>
          <input placeholder="2024" />
        </div>
        
        <button className="primary-btn">Generate Credentials</button>
      </div>
    </div>
  );
};

export default AddCadet;
