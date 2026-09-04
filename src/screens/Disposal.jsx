import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { disposalAPI } from '../services/api';

const Disposal = () => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const [selectedStation, setSelectedStation] = useState('');
  const [disposalReason, setDisposalReason] = useState('');
  const [showStationList, setShowStationList] = useState(false);

  const createInitialFormData = () => ({
    // Device Information
    deviceName: '',
    serialNumber: '',
    deviceType: '',
    deviceModel: '',
    rabTag: '',

    // Assigned To
    assignedName: '',
    assignedPosition: '',

    // Department
    department: '',
    guestDepartment: '',

    // Additional Info
    condition: '',
    disposalDate: '',
    notes: '',

    // Approval
    requestedBy: user?.full_name || user?.username || '',
    requestDate: new Date().toISOString().split('T')[0],
    approver: ''
  });
  
  // Form data state
  const [formData, setFormData] = useState(createInitialFormData);
  const [queuedItems, setQueuedItems] = useState([]);

  const [stations] = useState([
    'Nyamagabe Station',
    'Rubirizi Station',
    'Muhanga Station',
    'Musanze Station',
    'Gishwati Station',
    'Songa Station',
    'Rubona Station',
    'Ngoma Station',
    'Gakuta Station',
    'Nyagatare Station',
    'Tamira Station',
    'Ntendezi Station'
  ]);

  const [departments] = useState([
    'Information Technology',
    'Finance & Accounting',
    'Human Resources',
    'Operations',
    'Procurement',
    'Research & Development',
    'Quality Assurance',
    'Administration',
    'Field Services',
    'Logistics'
  ]);

  const [guests] = useState([
    { id: 1, name: 'John Doe', position: 'IT Manager', department: 'IT' },
    { id: 2, name: 'Jane Smith', position: 'Finance Director', department: 'Finance' },
    { id: 3, name: 'Robert Johnson', position: 'Operations Lead', department: 'Operations' },
    { id: 4, name: 'Maria Garcia', position: 'HR Specialist', department: 'HR' },
    { id: 5, name: 'David Kim', position: 'Field Officer', department: 'Field Services' },
  ]);

  const [selectedGuests, setSelectedGuests] = useState([]);
  const [showGuestSelector, setShowGuestSelector] = useState(false);
  
  // Device suggestions (would come from API in real app)
  const [deviceSuggestions] = useState([
    { name: 'Dell XPS 15 Laptop', serial: 'SN123456789', type: 'Laptop', model: 'XPS 15' },
    { name: 'HP EliteDesk Desktop', serial: 'SN987654321', type: 'Desktop', model: '800 G5' },
    { name: 'iPad Pro 12.9', serial: 'SN456789123', type: 'Tablet', model: 'iPad Pro' },
    { name: 'Lenovo ThinkPad X1', serial: 'SN789123456', type: 'Laptop', model: 'ThinkPad X1' },
    { name: 'Samsung Galaxy S21', serial: 'SN321654987', type: 'Mobile', model: 'Galaxy S21' },
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleDeviceSelect = (device) => {
    setFormData({
      ...formData,
      deviceName: device.name,
      serialNumber: device.serial,
      deviceType: device.type,
      deviceModel: device.model
    });
  };

  const handleGuestSelect = (guest) => {
    if (!selectedGuests.find(g => g.id === guest.id)) {
      setSelectedGuests([...selectedGuests, guest]);
      setFormData({
        ...formData,
        assignedName: guest.name,
        assignedPosition: guest.position,
        department: guest.department
      });
    }
    setShowGuestSelector(false);
  };

  const removeGuest = (guestId) => {
    setSelectedGuests(selectedGuests.filter(g => g.id !== guestId));
    if (selectedGuests.length <= 1) {
      setFormData({
        ...formData,
        assignedName: '',
        assignedPosition: '',
        department: ''
      });
    }
  };

  const validateCurrentItem = () => {
    if (!selectedStation) {
      alert('Please select a station');
      return false;
    }
    if (!disposalReason) {
      alert('Please select a disposal reason');
      return false;
    }
    if (!formData.deviceName || !formData.serialNumber) {
      alert('Please fill in device information');
      return false;
    }
    return true;
  };

  const handleAddAnotherItem = () => {
    if (!validateCurrentItem()) {
      return;
    }

    setQueuedItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length + 1}`,
        reason: disposalReason,
        formData: { ...formData }
      }
    ]);

    setDisposalReason('');
    setFormData(createInitialFormData());
    setSelectedGuests([]);
    setActiveStep(1);
    alert('Item added. You can now enter another item.');
  };

  const removeQueuedItem = (itemId) => {
    setQueuedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const itemsToSubmit = [...queuedItems];
    const hasDraftItem = Boolean(
      disposalReason ||
      formData.deviceName ||
      formData.serialNumber ||
      formData.deviceType ||
      formData.deviceModel ||
      formData.rabTag ||
      formData.assignedName ||
      formData.assignedPosition ||
      formData.department ||
      formData.guestDepartment ||
      formData.condition ||
      formData.disposalDate ||
      formData.notes ||
      selectedGuests.length
    );

    if (hasDraftItem) {
      if (!validateCurrentItem()) {
        return;
      }
      itemsToSubmit.push({
        id: `${Date.now()}-draft`,
        reason: disposalReason,
        formData: { ...formData }
      });
    }

    if (itemsToSubmit.length === 0) {
      alert('Please add at least one item to submit.');
      return;
    }

    try {
      const requestNumbers = [];

      for (const item of itemsToSubmit) {
        const response = await disposalAPI.create({
          station: selectedStation,
          reason: item.reason,
          device_name: item.formData.deviceName,
          serial_number: item.formData.serialNumber,
          device_type: item.formData.deviceType || null,
          device_model: item.formData.deviceModel || null,
          rab_tag: item.formData.rabTag || null,
          assigned_name: item.formData.assignedName || null,
          assigned_position: item.formData.assignedPosition || null,
          department: item.formData.department || null,
          guest_department: item.formData.guestDepartment || null,
          condition: item.formData.condition || null,
          disposal_date: item.formData.disposalDate || null,
          notes: item.formData.notes || null,
          requested_by_email: user?.email || null,
        });

        requestNumbers.push(response.request_number);
      }

      alert(
        `Submitted ${requestNumbers.length} disposal request(s) successfully. Request IDs: ${requestNumbers.join(', ')}`
      );
    } catch (error) {
      alert(error?.response?.data?.detail || 'Failed to submit disposal request. Please try again.');
      return;
    }

    // Reset form
    setActiveStep(1);
    setSelectedStation('');
    setDisposalReason('');
    setFormData(createInitialFormData());
    setSelectedGuests([]);
    setQueuedItems([]);
  };

  const nextStep = () => {
    if (activeStep === 1) {
      if (!selectedStation) {
        alert('Please select a station');
        return;
      }
      if (!disposalReason) {
        alert('Please select a disposal reason');
        return;
      }
    }
    if (activeStep === 2) {
      if (!formData.deviceName || !formData.serialNumber) {
        alert('Please fill in device information');
        return;
      }
    }
    setActiveStep(activeStep + 1);
  };

  const prevStep = () => {
    setActiveStep(activeStep - 1);
  };

  const totalItemsPendingSubmission = queuedItems.length + (disposalReason && formData.deviceName && formData.serialNumber ? 1 : 0);

  return (
    <div className="disposal-page">
      <UnifiedSidebar activePath="/disposal" />

      {/* Main Content */}
      <div className="main-content">
        <TopNavbar title="Disposal Management" />
        {/* Header */}
        <header className="disposal-header">
          <h1>Disposal Management</h1>
          <p>Submit and manage device disposal requests</p>
        </header>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`step ${activeStep >= 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Station & Reason</span>
          </div>
          <div className={`step ${activeStep >= 2 ? 'active' : ''} ${activeStep > 2 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Device Info</span>
          </div>
          <div className={`step ${activeStep >= 3 ? 'active' : ''} ${activeStep > 3 ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Assignment</span>
          </div>
          <div className={`step ${activeStep >= 4 ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Review & Submit</span>
          </div>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="disposal-form">
          {/* Step 1: Station & Reason */}
          {activeStep === 1 && (
            <div className="form-step">
              <h2>Step 1: Select Station & Disposal Reason</h2>
              
              {/* Station Selection */}
              <div className="form-section">
                <h3>
                  {/*<span className="section-icon">📍</span>*/}
                  Station
                </h3>
                <div className="station-selector">
                  <button 
                    type="button"
                    className="station-dropdown-btn"
                    onClick={() => setShowStationList(!showStationList)}
                  >
                    <span>{selectedStation || 'Check in the List of stations'}</span>
                  </button>
                  
                  {showStationList && (
                    <div className="station-list">
                      {stations.map((station, index) => (
                        <div 
                          key={index}
                          className={`station-item ${selectedStation === station ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedStation(station);
                            setShowStationList(false);
                          }}
                        >
                          {station}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Disposal Reason */}
              <div className="form-section">
                <h3>
                  Reason
                </h3>
                <div className="reason-options">
                  <label className={`reason-card ${disposalReason === 'reuse' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="disposalReason"
                      value="reuse"
                      checked={disposalReason === 'reuse'}
                      onChange={(e) => setDisposalReason(e.target.value)}
                    />
                    <div className="reason-content">
                      <span className="reason-title">Re-Use</span>
                      <span className="reason-desc">Device will be refurbished or repurposed</span>
                    </div>
                  </label>

                  <label className={`reason-card ${disposalReason === 'dispose' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="disposalReason"
                      value="dispose"
                      checked={disposalReason === 'dispose'}
                      onChange={(e) => setDisposalReason(e.target.value)}
                    />
                    <div className="reason-content">
                      {/*<span className="reason-icon">🗑️</span>*/}
                      <span className="reason-title">Dispose</span>
                      <span className="reason-desc">Device will be permanently disposed</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-navigation">
                <button type="button" className="next-btn" onClick={nextStep}>
                  Next: Device Information
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Device Information */}
          {activeStep === 2 && (
            <div className="form-step">
              <h2>Step 2: Fill in Device Information</h2>
              
              <div className="form-section">
                <h3>
                  {/*<span className="section-icon">💻</span>*/}
                  Device Information
                </h3>

                {/* Device Quick Select */}
                <div className="device-suggestions">
                  <label>Quick Select Device:</label>
                  <div className="suggestion-buttons">
                    {deviceSuggestions.map((device, index) => (
                      <button
                        key={index}
                        type="button"
                        className="suggestion-btn"
                        onClick={() => handleDeviceSelect(device)}
                      >
                        {device.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Device Name *</label>
                    <input
                      type="text"
                      name="deviceName"
                      value={formData.deviceName}
                      onChange={handleInputChange}
                      placeholder="Enter device name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Serial Number *</label>
                    <input
                      type="text"
                      name="serialNumber"
                      value={formData.serialNumber}
                      onChange={handleInputChange}
                      placeholder="Enter serial number"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Device Type</label>
                    <select
                      name="deviceType"
                      value={formData.deviceType}
                      onChange={handleInputChange}
                    >
                      <option value="">Select type</option>
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Tablet">Tablet</option>
                      <option value="Mobile">Mobile</option>
                      <option value="Printer">Printer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Device Model</label>
                    <input
                      type="text"
                      name="deviceModel"
                      value={formData.deviceModel}
                      onChange={handleInputChange}
                      placeholder="Enter device model"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>RAB Tag (if applicable)</label>
                  <input
                    type="text"
                    name="rabTag"
                    value={formData.rabTag}
                    onChange={handleInputChange}
                    placeholder="e.g., RAB00123"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Condition</label>
                    <select
                      name="condition"
                      value={formData.condition}
                      onChange={handleInputChange}
                    >
                      <option value="">Select condition</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Non-functional">Non-functional</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Disposal Date</label>
                    <input
                      type="date"
                      name="disposalDate"
                      value={formData.disposalDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>

              <div className="form-navigation">
                <button type="button" className="prev-btn" onClick={prevStep}>
                  <span className="btn-arrow">←</span>
                  Previous
                </button>
                <button type="button" className="next-btn" onClick={nextStep}>
                  Next: Assignment
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: More Info (Assignment) */}
          {activeStep === 3 && (
            <div className="form-step">
              <h2>Step 3: Assignment Details</h2>
              
              <div className="form-section">
                <h3>
                  <span className="section-icon">👤</span>
                  Assigned To
                </h3>

                {/* Guest Selector */}
                <div className="guest-selector">
                  <button
                    type="button"
                    className="guest-selector-btn"
                    onClick={() => setShowGuestSelector(!showGuestSelector)}
                  >
                    <span>Choose guests by</span>
                    <span className="dropdown-arrow">▼</span>
                  </button>

                  {showGuestSelector && (
                    <div className="guest-list">
                      {guests.map(guest => (
                        <div
                          key={guest.id}
                          className="guest-item"
                          onClick={() => handleGuestSelect(guest)}
                        >
                          <span className="guest-name">{guest.name}</span>
                          <span className="guest-position">{guest.position}</span>
                          <span className="guest-dept">{guest.department}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Guests */}
                {selectedGuests.length > 0 && (
                  <div className="selected-guests">
                    <h4>Selected Guests:</h4>
                    {selectedGuests.map(guest => (
                      <div key={guest.id} className="selected-guest">
                        <span>{guest.name} - {guest.position}</span>
                        <button
                          type="button"
                          className="remove-guest"
                          onClick={() => removeGuest(guest.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned To Name</label>
                    <input
                      type="text"
                      name="assignedName"
                      value={formData.assignedName}
                      onChange={handleInputChange}
                      placeholder="Enter assignee name"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Position</label>
                    <input
                      type="text"
                      name="assignedPosition"
                      value={formData.assignedPosition}
                      onChange={handleInputChange}
                      placeholder="Enter position"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>
                  Department
                </h3>

                <div className="form-group">
                  <label>Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                  >
                    <option value="">Select department</option>
                    {departments.map((dept, index) => (
                      <option key={index} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Guest Department (if different)</label>
                  <input
                    type="text"
                    name="guestDepartment"
                    value={formData.guestDepartment}
                    onChange={handleInputChange}
                    placeholder="Enter guest department"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>
                  Additional Notes
                </h3>

                <div className="form-group">
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Enter any additional information or special instructions..."
                    rows="4"
                  />
                </div>
              </div>

              <div className="form-navigation">
                <button type="button" className="prev-btn" onClick={prevStep}>
                  Previous
                </button>
                <button type="button" className="next-btn" onClick={nextStep}>
                  Next: Review & Submit
                  
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {activeStep === 4 && (
            <div className="form-step">
              <h2>Step 4: Review & Submit Disposal Request</h2>
              
              <div className="review-section">
                <div className="review-card">
                  <h3>Station & Reason</h3>
                  <div className="review-item">
                    <span className="review-label">Station:</span>
                    <span className="review-value">{selectedStation}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Reason:</span>
                    <span className="review-value">
                      {disposalReason ? (disposalReason === 'reuse' ? 'Re-Use' : 'Dispose') : '-'}
                    </span>
                  </div>
                </div>

                <div className="review-card">
                  <h3>Device Information</h3>
                  <div className="review-item">
                    <span className="review-label">Device Name:</span>
                    <span className="review-value">{formData.deviceName}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Serial Number:</span>
                    <span className="review-value">{formData.serialNumber}</span>
                  </div>
                  {formData.deviceType && (
                    <div className="review-item">
                      <span className="review-label">Device Type:</span>
                      <span className="review-value">{formData.deviceType}</span>
                    </div>
                  )}
                  {formData.deviceModel && (
                    <div className="review-item">
                      <span className="review-label">Model:</span>
                      <span className="review-value">{formData.deviceModel}</span>
                    </div>
                  )}
                  {formData.rabTag && (
                    <div className="review-item">
                      <span className="review-label">RAB Tag:</span>
                      <span className="review-value">{formData.rabTag}</span>
                    </div>
                  )}
                  {formData.condition && (
                    <div className="review-item">
                      <span className="review-label">Condition:</span>
                      <span className="review-value">{formData.condition}</span>
                    </div>
                  )}
                  {formData.disposalDate && (
                    <div className="review-item">
                      <span className="review-label">Disposal Date:</span>
                      <span className="review-value">{formData.disposalDate}</span>
                    </div>
                  )}
                </div>

                <div className="review-card">
                  <h3>Assignment Details</h3>
                  {formData.assignedName && (
                    <div className="review-item">
                      <span className="review-label">Assigned To:</span>
                      <span className="review-value">{formData.assignedName}</span>
                    </div>
                  )}
                  {formData.assignedPosition && (
                    <div className="review-item">
                      <span className="review-label">Position:</span>
                      <span className="review-value">{formData.assignedPosition}</span>
                    </div>
                  )}
                  {formData.department && (
                    <div className="review-item">
                      <span className="review-label">Department:</span>
                      <span className="review-value">{formData.department}</span>
                    </div>
                  )}
                  {selectedGuests.length > 0 && (
                    <div className="review-item">
                      <span className="review-label">Guests:</span>
                      <div className="review-guests">
                        {selectedGuests.map(g => (
                          <span key={g.id} className="guest-tag">{g.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {formData.notes && (
                  <div className="review-card">
                    <h3>Additional Notes</h3>
                    <p className="review-notes">{formData.notes}</p>
                  </div>
                )}

                {queuedItems.length > 0 && (
                  <div className="review-card">
                    <h3>Queued Items ({queuedItems.length})</h3>
                    <div className="queued-items-list">
                      {queuedItems.map((item, index) => (
                        <div key={item.id} className="queued-item-row">
                          <div>
                            <strong>#{index + 1}</strong> {item.formData.deviceName} ({item.formData.serialNumber})
                            <span className="queued-item-reason">{item.reason === 'reuse' ? 'Re-Use' : 'Dispose'}</span>
                          </div>
                          <button
                            type="button"
                            className="remove-item-btn"
                            onClick={() => removeQueuedItem(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="review-card">
                  <h3>Request Information</h3>
                  <div className="review-item">
                    <span className="review-label">Requested By:</span>
                    <span className="review-value">{formData.requestedBy}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Request Date:</span>
                    <span className="review-value">{formData.requestDate}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Status:</span>
                    <span className="review-value status-pending">Pending</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Items Ready:</span>
                    <span className="review-value">{totalItemsPendingSubmission}</span>
                  </div>
                </div>
              </div>

              <div className="form-navigation">
                <button type="button" className="prev-btn" onClick={prevStep}>
                  <span className="btn-arrow">←</span>
                  Previous
                </button>
                <button type="button" className="add-item-btn" onClick={handleAddAnotherItem}>
                  Add This Item & Continue
                </button>
                <button type="submit" className="submit-btn">
                  Submit {totalItemsPendingSubmission || 1} Item(s)
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Disposal;