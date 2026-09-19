import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import FindParking from './pages/FindParking';
import ListParking from './pages/ListParking';
import PlaceholderPage from './pages/PlaceholderPage';
import NewHostOnboarding from './pages/NewHostOnboarding';
import HostLogin from './pages/HostLogin';
import HostSignup from './pages/HostSignup';
import HostDashboard from './pages/HostDashboard';
import AdminListings from './pages/AdminListings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Main Landing */}
            <Route path="/" element={<Home />} />

            {/* Find Parking Flow */}
            <Route path="/find" element={<FindParking />} />
            <Route
              path="/open"
              element={
                <PlaceholderPage
                  title="Find Open Parking"
                  subtitle="Nearby open parking will appear here."
                  backTo="/find"
                  backLabel="Back to Find Parking"
                  pageId="page-open-parking"
                />
              }
            />
            <Route
              path="/rent"
              element={
                <PlaceholderPage
                  title="Rent Private Parking"
                  subtitle="Private parking spaces available for rent will appear here."
                  backTo="/find"
                  backLabel="Back to Find Parking"
                  pageId="page-rent-parking"
                />
              }
            />

            {/* List Parking Flow */}
            <Route path="/list" element={<ListParking />} />

            {/* Host Authentication Routes */}
            <Route path="/host/login" element={<HostLogin />} />
            <Route path="/host/signup" element={<HostSignup />} />

            {/* Protected Host Routes */}
            <Route
              path="/host/new"
              element={
                <ProtectedRoute>
                  <NewHostOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/dashboard"
              element={
                <ProtectedRoute>
                  <HostDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/bookings"
              element={
                <ProtectedRoute>
                  <HostDashboard defaultTab="bookings" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/listings"
              element={
                <ProtectedRoute>
                  <AdminListings />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
