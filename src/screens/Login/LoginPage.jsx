// src/pages/Login/LoginPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardPathForRole } from '../../utils/roles';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORG_DOMAIN = '@icttoolsasm.com';

const ROUTES = [
  { start: { x: 100, y: 150, delay: 0 }, end: { x: 200, y: 80, delay: 2 } },
  { start: { x: 200, y: 80, delay: 2 }, end: { x: 260, y: 120, delay: 4 } },
  { start: { x: 50, y: 50, delay: 1 }, end: { x: 150, y: 180, delay: 3 } },
  { start: { x: 280, y: 60, delay: 0.5 }, end: { x: 180, y: 180, delay: 2.5 } },
];

const DotMap = () => {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const generateDots = (width, height) => {
    const dots = [];
    const gap = 12;

    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        const isInMapShape =
          (x < width * 0.25 && x > width * 0.05 && y < height * 0.4 && y > height * 0.1) ||
          (x < width * 0.25 && x > width * 0.15 && y < height * 0.8 && y > height * 0.4) ||
          (x < width * 0.45 && x > width * 0.3 && y < height * 0.35 && y > height * 0.15) ||
          (x < width * 0.5 && x > width * 0.35 && y < height * 0.65 && y > height * 0.35) ||
          (x < width * 0.7 && x > width * 0.45 && y < height * 0.5 && y > height * 0.1) ||
          (x < width * 0.8 && x > width * 0.65 && y < height * 0.8 && y > height * 0.6);

        if (isInMapShape && Math.random() > 0.3) {
          dots.push({ x, y, radius: 1, opacity: Math.random() * 0.5 + 0.2 });
        }
      }
    }
    return dots;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
      canvas.width = width;
      canvas.height = height;
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = generateDots(dimensions.width, dimensions.height);
    let animationFrameId;
    let startTime = Date.now();

    const drawDots = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      dots.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${dot.opacity})`;
        ctx.fill();
      });
    };

    const drawRoutes = () => {
      const currentTime = (Date.now() - startTime) / 1000;

      ROUTES.forEach((route) => {
        const elapsed = currentTime - route.start.delay;
        if (elapsed <= 0) return;

        const duration = 3;
        const progress = Math.min(elapsed / duration, 1);
        const x = route.start.x + (route.end.x - route.start.x) * progress;
        const y = route.start.y + (route.end.y - route.start.y) * progress;

        ctx.beginPath();
        ctx.moveTo(route.start.x, route.start.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();
      });
    };

    const animate = () => {
      drawDots();
      drawRoutes();

      const currentTime = (Date.now() - startTime) / 1000;
      if (currentTime > 15) {
        startTime = Date.now();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  return <canvas ref={canvasRef} className="login-dotmap-canvas" />;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!email.toLowerCase().endsWith(ORG_DOMAIN)) {
      setError(`Use your organization email (${ORG_DOMAIN})`);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        const role = result.data?.user?.role;
        navigate(dashboardPathForRole(role));
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoError = (e) => {
    e.currentTarget.style.display = 'none';
    const fallback = document.getElementById('login-logo-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
    }
  };

  return (
    <div className="login-page-root">
      <div className="login-card">
        {/* Left: Dot map hero */}
        <div className="login-map-side">
          <DotMap />
          <div className="login-map-overlay">
            <div className="login-map-logo">
              <img
                src="/Logo.png"
                alt="MURI Logo"
                className="login-map-logo-img"
                onError={handleLogoError}
              />
              <div
                className="login-map-logo-fallback"
                id="login-logo-fallback"
                style={{ display: 'none' }}
              >
                MURI
              </div>
            </div>
            <h2>MURI</h2>
            <p>Clarity from complexity</p>
          </div>
        </div>

        {/* Right: Sign in form */}
        <div className="login-form-side">
          <h1>Welcome back</h1>
          <p className="login-form-subtitle">Sign in to your account</p>

          {error && <div className="login-error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" className={`login-submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;