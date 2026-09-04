import React, { useCallback, useEffect, useState } from 'react';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import LookupList from '../components/LookupList';
import { departmentAPI, stationAPI } from '../services/api';

const DepartmentsStations = () => {
  const [departments, setDepartments] = useState([]);
  const [stations, setStations] = useState([]);
  const [loadError, setLoadError] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      setLoadError('');
      const [departmentData, stationData] = await Promise.all([departmentAPI.list(), stationAPI.list()]);
      setDepartments(departmentData || []);
      setStations(stationData || []);
    } catch (error) {
      setLoadError(error?.response?.data?.detail || 'Unable to load departments and stations from server.');
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  return (
    <div className="simple-dashboard-root">
      <div className="simple-container">
        <UnifiedSidebar activePath="/admin/departments-stations" />

        <main className="simple-main">
          <TopNavbar title="Departments & Stations" />
          <div className="simple-dashboard-content">
            <div className="admin-users-main">
              <header className="admin-users-header">
                <h1>Departments & Stations</h1>
                <p>Manage the department and station options offered when creating or editing a user.</p>
              </header>

              {loadError && <div className="admin-users-message error">{loadError}</div>}

              <div className="lookup-editor-grid">
                <LookupList
                  title="Departments"
                  items={departments}
                  onCreate={async (name) => {
                    await departmentAPI.create(name);
                    await loadLookups();
                  }}
                  onUpdate={async (id, name) => {
                    await departmentAPI.update(id, name);
                    await loadLookups();
                  }}
                  onDelete={async (id) => {
                    await departmentAPI.remove(id);
                    await loadLookups();
                  }}
                />
                <LookupList
                  title="Stations"
                  items={stations}
                  onCreate={async (name) => {
                    await stationAPI.create(name);
                    await loadLookups();
                  }}
                  onUpdate={async (id, name) => {
                    await stationAPI.update(id, name);
                    await loadLookups();
                  }}
                  onDelete={async (id) => {
                    await stationAPI.remove(id);
                    await loadLookups();
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DepartmentsStations;
