import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import safeLocalStorage from '../utils/safeLocalStorage';

const ProtectedRoute = ({ children, requireVerification = true }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the full URL so login can restore it
    const intended = window.location.pathname + window.location.search;
    if (intended && intended !== '/login') {
      safeLocalStorage.setItem('auth_redirect', intended);
    }
    return <Navigate to="/login" replace />;
  }

  // Check if email verification is required
  if (requireVerification && user && !user.email_verified) {
    return <Navigate to="/verify-email-pending" replace />;
  }

  return children;
};

export default ProtectedRoute;
