import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import logoImage from "../assets/ncc-logo.png";

const NavBar = ({ onCadetLogin, onAnoLogin }) => {
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = (id) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="brand cursor-pointer" onClick={() => scrollToSection("home")}>
        <div className="brand-mark">
          <img src={logoImage} alt="NCC Nexus logo" />
        </div>
        <div className="brand-text">
          <span className="brand-title">NCC NEXUS</span>
          <span className="brand-subtitle">National Cadet Corps</span>
        </div>
      </div>

      <nav className="nav-links">
        <button onClick={() => scrollToSection("home")} className="nav-btn">Home</button>
        <button onClick={() => scrollToSection("about")} className="nav-btn">About NCC</button>
        <button onClick={() => scrollToSection("structure")} className="nav-btn">Structure</button>

        <div className="login-dropdown" ref={dropdownRef}>
          <button className="nav-login" type="button" onClick={() => setOpen(!open)}>
            Login
          </button>

          {open && (
            <div className="login-menu">
              <button onClick={() => { setOpen(false); onCadetLogin(); }}>
                Cadet Login
              </button>
              <button onClick={() => { setOpen(false); onAnoLogin(); }}>
                ANO Login
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="mobile-nav" ref={mobileMenuRef}>
        <button
          type="button"
          className="nav-mobile-toggle"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>

        {mobileMenuOpen ? (
          <div className="mobile-nav-menu">
            <button
              className="mobile-nav-btn"
              onClick={() => {
                scrollToSection("home");
                setMobileMenuOpen(false);
              }}
            >
              Home
            </button>
            <button
              className="mobile-nav-btn"
              onClick={() => {
                scrollToSection("about");
                setMobileMenuOpen(false);
              }}
            >
              About NCC
            </button>
            <button
              className="mobile-nav-btn"
              onClick={() => {
                scrollToSection("structure");
                setMobileMenuOpen(false);
              }}
            >
              Structure
            </button>

            <button
              className="mobile-nav-btn mobile-login-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                onCadetLogin();
              }}
            >
              Cadet Login
            </button>
            <button
              className="mobile-nav-btn mobile-login-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                onAnoLogin();
              }}
            >
              ANO Login
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default NavBar;
