import { useState } from "react";
import logoImage from "./assets/ncc-logo.png";
import NavBar from "./NavBar";
import LoginModal from "./LoginModal";
import AnoLoginModal from "./AnoLoginModal"; // ✅ ADD
const LandingPage = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showAnoLogin, setShowAnoLogin] = useState(false); // ✅ ADD

  return (
    <div className="page">
      <NavBar
        onCadetLogin={() => setShowLogin(true)}
        onAnoLogin={() => setShowAnoLogin(true)}
      />
      <main className="hero" id="home">
        <section className="hero-content">
          <span className="hero-pill">Official Digital Command Center</span>
          <h1>NCC Nexus</h1>
          <p className="hero-tagline">
            Empowering Discipline Through Digital Command
          </p>
          <p className="hero-body">
            A centralized digital platform for NCC Cadets, SUOs, Alumni, and ANOs.
            Streamlining operations, enhancing communication, and fostering excellence
            in the National Cadet Corps.
          </p>

          <div className="hero-actions">
            {/* CADET LOGIN POPUP */}
            <button
              className="primary"
              type="button"
              onClick={() => setShowLogin(true)}
            >
              Cadet Login
            </button>

            {/* ✅ ANO LOGIN POPUP */}
            <button
              className="secondary"
              type="button"
              onClick={() => setShowAnoLogin(true)}
            >
              ANO Login
            </button>
          </div>
        </section>

        <section className="hero-visual" aria-hidden="true">
          <div className="glow-ring">
            <div className="logo-circle">
              <img src={logoImage} alt="" />
            </div>
          </div>
        </section>
      </main>

      {/* CADET LOGIN MODAL */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* ✅ ANO LOGIN MODAL */}
      {showAnoLogin && (
        <AnoLoginModal onClose={() => setShowAnoLogin(false)} />
      )}
    </div>
  );
};

export default LandingPage;
