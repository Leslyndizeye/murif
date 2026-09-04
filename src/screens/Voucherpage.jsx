import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, FileText, Upload } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { CalendarScheduler } from '../components/ui/calendar-scheduler';
import DropdownSelect from '../components/ui/dropdown-select';
import { documentAPI, voucherAPI } from '../services/api';

const DRAFT_STORAGE_KEY = 'muri_voucher_draft';
const STATUS_META = {
  open: { label: 'Open' },
  assigned: { label: 'Assigned' },
  in_progress: { label: 'In Progress' },
  resolved: { label: 'Resolved' },
  closed: { label: 'Closed' },
};

const VoucherPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    requestType: 'technical',
    priority: 'medium',
    appointmentSeverity: 'medium',
    preferredDate: '',
    preferredTime: '',
    problemDescription: '',
    requester_name: '',
    requester_station: ''
  });
  const [activeTab, setActiveTab] = useState('create');
  const [tickets, setTickets] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
  }, []);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = React.useRef(null);
  const location = useLocation();
  const [notesState, setNotesState] = useState({});
  const [documentLinkState, setDocumentLinkState] = useState({});
  const [updatingTicketIds, setUpdatingTicketIds] = useState(new Set());

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    // Prefill requester name and station from logged in user when available
    if (currentUser && Object.keys(currentUser).length > 0) {
      setFormData((prev) => ({
        ...prev,
        requester_name: currentUser.full_name || currentUser.username || currentUser.email || prev.requester_name,
        requester_station: currentUser.station || prev.requester_station,
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      const savedDraft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
      if (savedDraft && typeof savedDraft === 'object') {
        setFormData((prev) => ({
          ...prev,
          ...savedDraft,
        }));
      }
    } catch {
      // Ignore malformed draft payloads.
    }
  }, []);

  const normalizedRole = (currentUser?.role || '').toLowerCase();
  const isITRole = ['admin', 'manager', 'it'].includes(normalizedRole);
  const isUserRole = normalizedRole === 'user';
  const canManageTickets = isITRole;
  const canCreateVoucher = isUserRole;
  const currentUserId = Number(currentUser?.id || 0);

  const getStatusMeta = useCallback(
    (status) => STATUS_META[status] || { label: status || 'Unknown' },
    []
  );

  const buildDraftPayload = useCallback(() => ({
    ...formData,
    savedAt: new Date().toISOString(),
  }), [formData]);

  const showOnlyMyTickets = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('filter') === 'my-tickets';
  }, [location.search]);

  const focusVoucherId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const rawValue = searchParams.get('voucher_id');
    if (!rawValue) {
      return null;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }, [location.search]);

  const focusTicketNumber = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('ticket') || '';
  }, [location.search]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);

      const voucherParams = {};
      if (showOnlyMyTickets && currentUserId) {
        voucherParams.assigned_to_id = currentUserId;
      }

      const [voucherData, documentData] = await Promise.all([
        voucherAPI.list(voucherParams),
        documentAPI.list(),
      ]);

      const normalizedTickets = (voucherData || []).filter((ticket) => {
        if (isUserRole && currentUserId) {
          return ticket.requester_id === currentUserId;
        }
        return true;
      });
      setTickets(normalizedTickets);
      setDocuments(documentData || []);

      const nextNotesState = {};
      const nextDocumentLinkState = {};

      normalizedTickets.forEach((ticket) => {
        nextNotesState[ticket.id] = {
          diagnosis: ticket.diagnosis || '',
          action_taken: ticket.action_taken || '',
        };

        const linkedDocument = (documentData || []).find((doc) => doc.voucher_id === ticket.id);
        nextDocumentLinkState[ticket.id] = linkedDocument ? linkedDocument.id : '';
      });

      setNotesState(nextNotesState);
      setDocumentLinkState(nextDocumentLinkState);
    } catch (error) {
      showMessage(error?.response?.data?.detail || 'Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isUserRole, showOnlyMyTickets, showMessage]);

  useEffect(() => {
    if (!canCreateVoucher && activeTab === 'create') {
      setActiveTab('list');
    }
  }, [activeTab, canCreateVoucher]);

  useEffect(() => {
    if (focusVoucherId || focusTicketNumber) {
      setActiveTab('list');
    }
  }, [focusTicketNumber, focusVoucherId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== fileArray.length) {
      showMessage('Some files were skipped (must be PNG, JPG, or PDF, max 10MB each)', 'error');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!currentUser?.email) {
      showMessage('Please login again to submit ticket.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await voucherAPI.create({
        title: formData.title,
        description: `[${formData.requestType}] ${formData.problemDescription}`,
        priority: formData.priority,
        severity: formData.appointmentSeverity,
        preferred_date: formData.preferredDate || null,
        preferred_time: formData.preferredTime || null,
        status: 'pending',
        requester_email: currentUser.email,
        requester_name: formData.requester_name || currentUser.full_name || currentUser.email,
        requester_station: formData.requester_station || currentUser.station || null,
      });

      setFormData({
        title: '',
        requestType: 'technical',
        priority: 'medium',
        appointmentSeverity: 'medium',
        preferredDate: '',
        preferredTime: '',
        problemDescription: '',
        requester_name: currentUser.full_name || currentUser.username || currentUser.email || '',
        requester_station: currentUser.station || '',
      });
      setUploadedFiles([]);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      showMessage('Ticket submitted successfully.', 'success');
      await loadTickets();
      setActiveTab('list');
    } catch (error) {
      showMessage(error?.response?.data?.detail || 'Failed to submit ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId, nextStatus) => {
    setUpdatingTicketIds((previous) => new Set(previous).add(ticketId));
    try {
      await voucherAPI.update(ticketId, { status: nextStatus });
      showMessage('Ticket status updated.', 'success');
      await loadTickets();
    } catch (error) {
      showMessage(error?.response?.data?.detail || 'Failed to update ticket status', 'error');
    } finally {
      setUpdatingTicketIds((previous) => {
        const next = new Set(previous);
        next.delete(ticketId);
        return next;
      });
    }
  };

  const handleSaveNotes = async (ticketId) => {
    try {
      const payload = notesState[ticketId] || {};
      await voucherAPI.update(ticketId, {
        diagnosis: payload.diagnosis || null,
        action_taken: payload.action_taken || null,
      });
      showMessage('Diagnosis and action saved.', 'success');
      await loadTickets();
    } catch (error) {
      showMessage(error?.response?.data?.detail || 'Failed to save diagnosis/action', 'error');
    }
  };

  const handleLinkDocument = async (ticketId) => {
    try {
      const selectedDocumentId = documentLinkState[ticketId] ? Number(documentLinkState[ticketId]) : null;
      if (!selectedDocumentId) {
        showMessage('Select a document to link.', 'error');
        return;
      }

      await documentAPI.linkToVoucher(selectedDocumentId, ticketId);
      showMessage('Document linked to ticket successfully.', 'success');
      await loadTickets();
    } catch (error) {
      showMessage(error?.response?.data?.detail || 'Failed to link document', 'error');
    }
  };

  const displayedTickets = useMemo(() => {
    if (focusVoucherId) {
      return tickets.filter((ticket) => ticket.id === focusVoucherId);
    }

    if (focusTicketNumber) {
      return tickets.filter((ticket) => ticket.ticket_number === focusTicketNumber);
    }

    return tickets;
  }, [focusTicketNumber, focusVoucherId, tickets]);

  const hasTicketFilter = Boolean(focusVoucherId || focusTicketNumber);

  const handleSaveDraft = () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(buildDraftPayload()));
    showMessage('Draft saved locally.', 'success');
  };

  return (
    <div className="voucher-container">
      <UnifiedSidebar activePath="/voucher" />

      {/* Main Content */}
      <main className="voucher-main">
        <TopNavbar title="Tickets" />
        <header className="voucher-header">
          <div>
            <h1>Ticket</h1>
            <p>Submit support requests, save drafts, and track progress in real time</p>
          </div>
        </header>

        <div className="voucher-tabs">
          {canCreateVoucher && (
            <button
              className={`voucher-tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              <Calendar size={20} /> Book Appointment
            </button>
          )}
          <button
            className={`voucher-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <FileText size={20} /> {canCreateVoucher ? 'View Requests' : 'All Requests'}
          </button>
        </div>

        {message && (
          <div className={`voucher-message voucher-message-${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>
            {message}
          </div>
        )}

        {canCreateVoucher && activeTab === 'create' && <div className="voucher-form-container">
          <h2>Submit New Request</h2>
          <p>Start now, save it as a draft if needed, and submit once the issue is ready.</p>

          <form onSubmit={handleSubmit}>
            <div className="voucher-form-group">
              <label>Issue Title *</label>
              <input
                type="text"
                placeholder="Enter issue title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="voucher-form-group">
              <label>Name *</label>
              <input
                type="text"
                placeholder="the name of the requester"
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                required
              />
            </div>

            <div className="voucher-form-group">
              <label>Issue Severity *</label>
              <DropdownSelect
                value={formData.appointmentSeverity}
                onChange={(appointmentSeverity) => setFormData({ ...formData, appointmentSeverity })}
                options={[{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'simple', label: 'Simple' }]}
              />
            </div>

            <div className="voucher-form-group voucher-appointment-card">
              <label>Preferred Appointment</label>
              <CalendarScheduler
                date={formData.preferredDate}
                time={formData.preferredTime}
                onDateChange={(preferredDate) => setFormData({ ...formData, preferredDate })}
                onTimeChange={(preferredTime) => setFormData({ ...formData, preferredTime })}
              />
              <small>Critical and high issues should be booked first on the IT calendar.</small>
            </div>

            <div className="voucher-form-group">
              <label>Station *</label>
              <DropdownSelect
                value={formData.requester_station}
                onChange={(requester_station) => setFormData({ ...formData, requester_station })}
                placeholder="Select station"
                options={['Tamira Station', 'Rwerere Station', 'Nyagatare Station', 'Muhanga Station', 'Rubiizi Station', 'Ngoma Station', 'Musanze Station', 'Nyamagabe Station', 'Gishwati Station', 'Songa Station', 'Rubona Station', 'Ntendezi Station', 'Gakuta Station'].map((station) => ({ value: station, label: station }))}
              />
            </div>

            <div className="voucher-form-group">
              <label>Request Type *</label>
              <DropdownSelect
                value={formData.requestType}
                onChange={(requestType) => setFormData({ ...formData, requestType })}
                options={[{ value: 'technical', label: 'Technical' }, { value: 'software', label: 'Software' }, { value: 'hardware', label: 'Hardware' }]}
              />
            </div>

            <div className="voucher-form-group">
              <label>Category *</label>
              <DropdownSelect
                value={formData.priority}
                onChange={(priority) => setFormData({ ...formData, priority })}
                options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]}
              />
            </div>

            <div className="voucher-form-group">
              <label>Problem Description *</label>
              <textarea
                placeholder="Describe your issue in detail..."
                value={formData.problemDescription}
                onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                rows="6"
                required
              />
              <small>{formData.problemDescription.length} characters</small>
            </div>

            <div className="voucher-form-group voucher-upload-group">
              <label>Attachments (Optional)</label>
              <div 
                className="voucher-upload"
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ cursor: 'pointer' }}
              >
                <Upload size={24} />
                <p>Click to upload or drag and drop</p>
                <small>PNG, JPG, PDF up to 10MB</small>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    Selected files ({uploadedFiles.length}):
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {uploadedFiles.map((file, index) => (
                      <li key={index} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: '#f0f2f5',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        fontSize: '14px'
                      }}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#e74c3c',
                            cursor: 'pointer',
                            fontSize: '16px'
                          }}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="voucher-form-actions">
              <button type="button" className="voucher-secondary-btn" onClick={handleSaveDraft}>
                Save Draft
              </button>
              <button type="submit" className="voucher-submit-btn">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>}

        {activeTab === 'list' && (
          <div className="voucher-form-container">
            <h2>Submitted Tickets</h2>
            <p>Monitor and update ticket progress</p>

            {!loading && displayedTickets.length === 0 && (
              <p>{(showOnlyMyTickets || isITRole) ? 'No pending tickets found.' : 'No tickets found.'}</p>
            )}

            {!loading && hasTicketFilter && displayedTickets.length === 0 && (
              <p>Ticket from notification was not found in your accessible list.</p>
            )}

            {!loading && displayedTickets.length > 0 && (
              <div className="voucher-ticket-grid">
                {displayedTickets.map((ticket) => (
                  <div key={ticket.id} className={`voucher-ticket-card ${hasTicketFilter ? 'voucher-ticket-card-focus' : ''}`}>
                    <div className="voucher-ticket-card-header">
                      <div>
                        <span className="voucher-ticket-number">{ticket.ticket_number}</span>
                        <h4>{ticket.title}</h4>
                      </div>
                      <span className={`voucher-status-badge voucher-status-${ticket.status || 'open'}`}>
                        {getStatusMeta(ticket.status).label}
                      </span>
                    </div>
                    <p className="voucher-ticket-description">{ticket.description}</p>
                    <div className="voucher-ticket-meta-grid">
                      <p><span>Priority</span><strong>{ticket.priority}</strong></p>
                      <p><span>Raised by</span><strong>{ticket.requester_name || ticket.requester_email || 'Unknown staff member'}</strong></p>
                      <p><span>Station</span><strong>{ticket.requester_station || 'Not provided'}</strong></p>
                      <p><span>Severity</span><strong>{ticket.severity || ticket.priority || 'medium'}</strong></p>
                    </div>
                    {(ticket.preferred_date || ticket.preferred_time) && (
                      <div className="voucher-ticket-appointment">
                        <span>Preferred appointment</span>
                        <strong>{[ticket.preferred_date, ticket.preferred_time].filter(Boolean).join(' ')}</strong>
                      </div>
                    )}

                    {canManageTickets && (
                      <div className="voucher-ticket-actions-row voucher-ticket-card-footer">
                        {updatingTicketIds.has(ticket.id) ? (
                          <span className="voucher-ticket-updating">Updating status…</span>
                        ) : (
                          <label className="voucher-status-control">
                            <span>Update status</span>
                            <DropdownSelect
                              value={ticket.status}
                              onChange={(nextStatus) => handleStatusChange(ticket.id, nextStatus)}
                              className="voucher-status-dropdown"
                              options={[
                                { value: 'open', label: 'Open' },
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'resolved', label: 'Resolved' },
                                { value: 'closed', label: 'Closed' },
                              ]}
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {canManageTickets && (
                      <div className="voucher-ticket-manage">
                        <div className="voucher-ticket-notes">
                          <label className="voucher-ticket-label">Diagnosis</label>
                          <textarea
                            className="voucher-ticket-textarea"
                            rows="2"
                            value={notesState[ticket.id]?.diagnosis || ''}
                            onChange={(e) =>
                              setNotesState((prev) => ({
                                ...prev,
                                [ticket.id]: {
                                  diagnosis: e.target.value,
                                  action_taken: prev[ticket.id]?.action_taken || '',
                                },
                              }))
                            }
                          />

                          <label className="voucher-ticket-label">Action Taken</label>
                          <textarea
                            className="voucher-ticket-textarea"
                            rows="2"
                            value={notesState[ticket.id]?.action_taken || ''}
                            onChange={(e) =>
                              setNotesState((prev) => ({
                                ...prev,
                                [ticket.id]: {
                                  diagnosis: prev[ticket.id]?.diagnosis || '',
                                  action_taken: e.target.value,
                                },
                              }))
                            }
                          />
                          <button className="voucher-ticket-action" type="button" onClick={() => handleSaveNotes(ticket.id)}>Save Diagnosis/Action</button>
                        </div>

                        <div className="voucher-ticket-inline">
                          <label className="voucher-ticket-label">Link Document:</label>
                          <DropdownSelect
                            className="voucher-status-dropdown"
                            value={documentLinkState[ticket.id] || ''}
                            onChange={(value) => setDocumentLinkState((prev) => ({ ...prev, [ticket.id]: value }))}
                            placeholder="Select document"
                            options={documents.map((doc) => ({
                              value: String(doc.id),
                              label: `${doc.document_ref} - ${doc.name_of_staff}`,
                            }))}
                          />
                          <button className="voucher-ticket-action" type="button" onClick={() => handleLinkDocument(ticket.id)}>Link</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="voucher-footer">©2026. MURI</footer>
      </main>
    </div>
  );
};

export default VoucherPage;
