import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { documentAPI } from '../services/api';

const DOCUMENT_TYPES = {
  receiving: 'receiving',
  returning: 'returning',
};

const SOURCE_OPTIONS = ['New Computer', 'Internal transfer', 'External Institution'];

const ASSET_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 're-assigned', label: 'Re-assigned' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'disposed', label: 'Disposed' },
];

const Document = () => {
  const { user } = useAuth();
  const normalizedRole = (user?.role || '').toLowerCase();
  const canApproveDocuments = normalizedRole === 'it';
  const canManageDocuments = ['admin', 'manager', 'it'].includes(normalizedRole);
  const formatStatusLabel = (value) => (value || '').replace(/_/g, ' ');
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'drafts', 'submitted'
  const [itQueueFilter, setItQueueFilter] = useState('all');
  const [formData, setFormData] = useState({
    documentType: DOCUMENT_TYPES.returning,
    // Staff Information
    date: new Date().toISOString().split('T')[0],
    nameOfStaff: '',
    position: '',
    division: '',
    
    // Technical Details - Device
    deviceModel: '',
    deviceSerialNumber: '',
    rabAssetCode: '',
    recipientEmail: '',
    sourceOfComputer: '',
    acquisitionDetails: '',
    receivingComment: '',
    
    // Technical Details - Problem
    natureOfProblem: '',
    observation: '',
    
    // Key Recommendation
    keyRecommendation: '',
    
    // Additional Fields
    priority: 'medium',
    assetStatus: 'active',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [drafts, setDrafts] = useState([]);
  const [submittedDocs, setSubmittedDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [backendMessage, setBackendMessage] = useState('');
  const [signatureInputs, setSignatureInputs] = useState({});

  useEffect(() => {
    if (!canManageDocuments) {
      setActiveTab('pending-signatures');
    }
  }, [canManageDocuments]);

  // Load drafts from localStorage on mount
  useEffect(() => {
    const savedDrafts = localStorage.getItem('documentDrafts');
    
    if (savedDrafts) {
      setDrafts(JSON.parse(savedDrafts));
    }

    documentAPI.list()
      .then((docs) => {
        const mapped = (docs || []).map((doc) => ({
          id: doc.id,
          documentType: doc.document_type || DOCUMENT_TYPES.returning,
          date: doc.date,
          nameOfStaff: doc.name_of_staff,
          position: doc.position,
          division: doc.division,
          deviceModel: doc.device_model,
          deviceSerialNumber: doc.device_serial_number,
          rabAssetCode: doc.rab_asset_code,
          recipientEmail: doc.recipient_email,
          sourceOfComputer: doc.source_of_computer,
          acquisitionDetails: doc.acquisition_details,
          receivingComment: doc.receiving_comment,
          userSignature: doc.user_signature,
          userSignedAt: doc.user_signed_at,
          signatureStatus: doc.signature_status || 'not_required',
          natureOfProblem: doc.nature_of_problem,
          observation: doc.observation,
          keyRecommendation: doc.key_recommendation,
          priority: doc.priority,
          assetStatus: doc.asset_status || 'active',
          status: doc.status,
          approvalStatus: doc.approval_status,
          approvedById: doc.approved_by_id,
          approvedAt: doc.approved_at,
          approvalNote: doc.approval_note,
          disposalId: doc.disposal_id,
          submittedAt: doc.created_at,
          updatedAt: doc.updated_at,
          documentRef: doc.document_ref,
        }));
        setSubmittedDocs(mapped);
      })
      .catch(() => {
        setBackendMessage('Could not load documents from backend.');
      });
  }, []);

  // Save drafts to localStorage
  useEffect(() => {
    localStorage.setItem('documentDrafts', JSON.stringify(drafts));
  }, [drafts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveDraft = () => {
    // Validate required fields
    if (!formData.nameOfStaff || !formData.deviceModel || !formData.deviceSerialNumber) {
      alert('Please fill in at least: Staff Name, Device Model, and Serial Number');
      return;
    }

    if (formData.documentType === DOCUMENT_TYPES.receiving && !formData.sourceOfComputer) {
      alert('Please select source of computer for receiving document');
      return;
    }

    if (formData.documentType === DOCUMENT_TYPES.receiving && !formData.recipientEmail) {
      alert('Please provide recipient email for receiving document');
      return;
    }

    const draftDoc = {
      ...formData,
      id: 'draft-' + Date.now(),
      status: 'draft',
      savedAt: new Date().toISOString()
    };

    setDrafts([draftDoc, ...drafts]);
    alert('Document saved as draft!');
    
    // Clear form but keep staff info
    setFormData({
      ...formData,
      date: new Date().toISOString().split('T')[0],
      deviceModel: '',
      deviceSerialNumber: '',
      rabAssetCode: '',
      recipientEmail: '',
      sourceOfComputer: '',
      acquisitionDetails: '',
      receivingComment: '',
      natureOfProblem: '',
      observation: '',
      keyRecommendation: '',
      updatedAt: new Date().toISOString()
    });
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!formData.nameOfStaff) {
      alert('Please enter staff name');
      return;
    }
    if (!formData.position) {
      alert('Please enter position');
      return;
    }
    if (!formData.division) {
      alert('Please enter division/department/unit');
      return;
    }
    if (!formData.deviceModel) {
      alert('Please enter device model');
      return;
    }
    if (!formData.deviceSerialNumber) {
      alert('Please enter device serial number');
      return;
    }
    if (formData.documentType === DOCUMENT_TYPES.returning && !formData.natureOfProblem) {
      alert('Please describe the nature of the problem');
      return;
    }

    try {
      const response = await documentAPI.create({
        date: formData.date,
        document_type: formData.documentType,
        name_of_staff: formData.nameOfStaff,
        position: formData.position,
        division: formData.division,
        device_model: formData.deviceModel,
        device_serial_number: formData.deviceSerialNumber,
        rab_asset_code: formData.rabAssetCode || null,
        recipient_email: formData.recipientEmail || null,
        source_of_computer: formData.sourceOfComputer || null,
        acquisition_details: formData.acquisitionDetails || null,
        receiving_comment: formData.receivingComment || null,
        nature_of_problem:
          formData.documentType === DOCUMENT_TYPES.returning
            ? formData.natureOfProblem
            : (formData.natureOfProblem || null),
        observation: formData.observation || null,
        key_recommendation:
          formData.documentType === DOCUMENT_TYPES.returning
            ? (formData.keyRecommendation || null)
            : null,
        priority: formData.priority,
        asset_status: formData.assetStatus,
        submitted_by_email: user?.email || null,
      });

      const submittedDoc = {
        ...formData,
        id: response.id,
        documentType: response.document_type,
        status: response.status,
        assetStatus: response.asset_status,
        recipientEmail: response.recipient_email,
        userSignature: response.user_signature,
        userSignedAt: response.user_signed_at,
        signatureStatus: response.signature_status,
        approvalStatus: response.approval_status,
        approvedById: response.approved_by_id,
        approvedAt: response.approved_at,
        approvalNote: response.approval_note,
        disposalId: response.disposal_id,
        submittedBy: user?.email || 'unknown',
        submittedAt: response.created_at,
        documentRef: response.document_ref,
      };

      setSubmittedDocs([submittedDoc, ...submittedDocs]);
      alert('Document submitted successfully! Reference: ' + submittedDoc.documentRef);
      setBackendMessage('');
    } catch {
      setBackendMessage('Document submission failed. Please try again.');
      return;
    }
    
    // Clear form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      nameOfStaff: '',
      position: '',
      division: '',
      documentType: DOCUMENT_TYPES.returning,
      deviceModel: '',
      deviceSerialNumber: '',
      rabAssetCode: '',
      recipientEmail: '',
      sourceOfComputer: '',
      acquisitionDetails: '',
      receivingComment: '',
      natureOfProblem: '',
      observation: '',
      keyRecommendation: '',
      priority: 'medium',
      assetStatus: 'active',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const loadDraft = (draft) => {
    setFormData(draft);
    setActiveTab('new');
    setSelectedDoc(null);
  };

  const deleteDraft = (id) => {
    setDrafts(drafts.filter(draft => draft.id !== id));
  };

  const viewDocument = (doc) => {
    setSelectedDoc(doc);
    setShowPreview(true);
  };

  const handleApproval = async (doc, decision) => {
    try {
      const response = await documentAPI.approve(doc.id, {
        decision,
        approved_by_email: user?.email || null,
        approval_note: decision === 'approved' ? 'Approved by IT.' : 'Rejected by IT. Review required.',
      });

      setSubmittedDocs((prev) =>
        prev.map((item) =>
          item.id === doc.id
            ? {
                ...item,
                status: response.status,
                approvalStatus: response.approval_status,
                approvedById: response.approved_by_id,
                approvedAt: response.approved_at,
                approvalNote: response.approval_note,
              }
            : item
        )
      );

      setBackendMessage(`Document ${response.document_ref} ${decision} successfully.`);
    } catch (error) {
      setBackendMessage(error?.response?.data?.detail || 'Failed to update document approval.');
    }
  };

  const canCurrentUserSign = (doc) => {
    if (canManageDocuments) return false;
    if ((doc.documentType || DOCUMENT_TYPES.returning) !== DOCUMENT_TYPES.receiving) return false;
    if ((doc.signatureStatus || 'not_required') === 'signed') return false;
    return (doc.recipientEmail || '').toLowerCase() === (user?.email || '').toLowerCase();
  };

  const handleSignDocument = async (doc) => {
    const signatureText = (signatureInputs[doc.id] || '').trim();
    if (!signatureText) {
      setBackendMessage('Please enter your digital signature before sending back to IT.');
      return;
    }

    try {
      const response = await documentAPI.sign(doc.id, {
        signer_email: user?.email || '',
        signature_text: signatureText,
      });

      setSubmittedDocs((prev) =>
        prev.map((item) =>
          item.id === doc.id
            ? {
                ...item,
                status: response.status,
                signatureStatus: response.signature_status,
                userSignature: response.user_signature,
                userSignedAt: response.user_signed_at,
              }
            : item
        )
      );

      setSignatureInputs((prev) => ({ ...prev, [doc.id]: '' }));
      setBackendMessage(`Document ${response.document_ref} signed and returned to IT.`);
    } catch (error) {
      setBackendMessage(error?.response?.data?.detail || 'Failed to sign document.');
    }
  };

  const filterDocuments = (docs) => {
    return docs.filter(doc => 
      doc.nameOfStaff?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.deviceModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.deviceSerialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.documentType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.documentRef?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const receivingDocsForCurrentUser = submittedDocs.filter(
    (doc) =>
      (doc.recipientEmail || '').toLowerCase() === (user?.email || '').toLowerCase() &&
      (doc.documentType || DOCUMENT_TYPES.returning) === DOCUMENT_TYPES.receiving
  );

  const pendingSignatureDocsForCurrentUser = receivingDocsForCurrentUser.filter(
    (doc) => (doc.signatureStatus || 'not_required') === 'pending_user_signature'
  );

  const itReceivingDocs = submittedDocs.filter(
    (doc) => (doc.documentType || DOCUMENT_TYPES.returning) === DOCUMENT_TYPES.receiving
  );

  const itPendingSignatureDocs = itReceivingDocs.filter(
    (doc) => (doc.signatureStatus || 'not_required') === 'pending_user_signature'
  );

  const itReturnedDocs = itReceivingDocs.filter(
    (doc) => (doc.signatureStatus || 'not_required') === 'signed' || doc.status === 'returned_to_it'
  );

  let submittedDocsBase = [];
  if (canManageDocuments) {
    if (itQueueFilter === 'pending') {
      submittedDocsBase = itPendingSignatureDocs;
    } else if (itQueueFilter === 'returned') {
      submittedDocsBase = itReturnedDocs;
    } else {
      submittedDocsBase = submittedDocs;
    }
  } else if (activeTab === 'pending-signatures') {
    submittedDocsBase = pendingSignatureDocsForCurrentUser;
  } else {
    submittedDocsBase = receivingDocsForCurrentUser;
  }

  const displayedSubmittedDocs = filterDocuments(submittedDocsBase);
  const submittedSectionTitle = canManageDocuments
    ? 'Submitted Documents'
    : activeTab === 'pending-signatures'
      ? 'Pending Signatures'
      : 'My Receiving Documents';

  return (
    <div className="document-page">
      <UnifiedSidebar activePath="/document" />

      {/* Main Content */}
      <div className="main-content">
        <TopNavbar title="Documents" />
        {/* Header */}
        <header className="document-header">
          <h1>Documents</h1>
          {/*<p>Create and manage technical documentation and reports</p>*/}
          {backendMessage && <p style={{ color: '#b91c1c' }}>{backendMessage}</p>}
        </header>

        {/* Tabs */}
        <div className="document-tabs">
          {canManageDocuments && (
            <>
              <button 
                className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => setActiveTab('new')}
              >
                {/*<span className="tab-icon">📝</span>*/}
                New Document
              </button>
              <button 
                className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
                onClick={() => setActiveTab('drafts')}
              >
                {/*<span className="tab-icon">📄</span>}*/}
                Drafts ({drafts.length})
              </button>
            </>
          )}
          {canManageDocuments ? (
            <button
              className={`tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
              onClick={() => setActiveTab('submitted')}
            >
              Submitted ({submittedDocs.length})
            </button>
          ) : (
            <>
              <button
                className={`tab-btn ${activeTab === 'pending-signatures' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending-signatures')}
              >
                Pending Signatures ({pendingSignatureDocsForCurrentUser.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
                onClick={() => setActiveTab('submitted')}
              >
                My Receiving Documents ({receivingDocsForCurrentUser.length})
              </button>
            </>
          )}
        </div>

        {/* Search Bar (for drafts and submitted) */}
        {(activeTab === 'drafts' || activeTab === 'submitted' || activeTab === 'pending-signatures') && (
          <div className="search-bar">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder={activeTab === 'pending-signatures' ? 'Search pending signatures...' : `Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {/* New Document Form */}
        {activeTab === 'new' && (
          <div className="document-form">
            <div className="form-section">
              <h2>Technical Documentation Form</h2>
              <p className="form-subtitle">Fill in the details below to create a technical report</p>
              <div className="form-row">
                <div className="form-group">
                  <label>Document Type <span className="required">*</span></label>
                  <select
                    name="documentType"
                    value={formData.documentType}
                    onChange={handleInputChange}
                  >
                    <option value={DOCUMENT_TYPES.receiving}>Receiving Document</option>
                    <option value={DOCUMENT_TYPES.returning}>Returning Document</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Asset Status <span className="required">*</span></label>
                  <select
                    name="assetStatus"
                    value={formData.assetStatus}
                    onChange={handleInputChange}
                  >
                    {ASSET_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Staff Information */}
            <div className="form-section">
              <h3>
                {/*<span className="section-icon">👤</span>*/}
                Staff Information
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Date <span className="required">*</span></label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Name of Staff <span className="required">*</span></label>
                  <input
                    type="text"
                    name="nameOfStaff"
                    value={formData.nameOfStaff}
                    onChange={handleInputChange}
                    placeholder="Enter staff full name"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Position <span className="required">*</span></label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    placeholder="Enter position/title"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Division/Department/Unit <span className="required">*</span></label>
                <input
                  type="text"
                  name="division"
                  value={formData.division}
                  onChange={handleInputChange}
                  placeholder="e.g., IT Department, Finance Division"
                  required
                />
              </div>
            </div>

            {/* Technical Details - Device */}
            <div className="form-section">
              <h3>
                {/*<span className="section-icon">💻</span>*/}
                Technical Details - Device Information
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Device Model <span className="required">*</span></label>
                  <input
                    type="text"
                    name="deviceModel"
                    value={formData.deviceModel}
                    onChange={handleInputChange}
                    placeholder="e.g., Dell XPS 15, HP EliteDesk"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Device Serial Number <span className="required">*</span></label>
                  <input
                    type="text"
                    name="deviceSerialNumber"
                    value={formData.deviceSerialNumber}
                    onChange={handleInputChange}
                    placeholder="Enter serial number"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>RAB Asset Code</label>
                <input
                  type="text"
                  name="rabAssetCode"
                  value={formData.rabAssetCode}
                  onChange={handleInputChange}
                  placeholder="e.g., RAB-ASSET-00123"
                />
                <small className="field-hint">If applicable</small>
              </div>

              {formData.documentType === DOCUMENT_TYPES.receiving && (
                <>
                  <div className="form-group">
                    <label>Recipient Email <span className="required">*</span></label>
                    <input
                      type="email"
                      name="recipientEmail"
                      value={formData.recipientEmail}
                      onChange={handleInputChange}
                      placeholder="staff.name@rab.gov.rw"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Source of the Computer <span className="required">*</span></label>
                    <select
                      name="sourceOfComputer"
                      value={formData.sourceOfComputer}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select source</option>
                      {SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Acquisition Date, last owner or institution</label>
                    <input
                      type="text"
                      name="acquisitionDetails"
                      value={formData.acquisitionDetails}
                      onChange={handleInputChange}
                      placeholder="Enter acquisition date, previous owner, or institution"
                    />
                  </div>

                  <div className="form-group">
                    <label>Comment</label>
                    <textarea
                      name="receivingComment"
                      value={formData.receivingComment}
                      onChange={handleInputChange}
                      placeholder="Additional receiving notes from IT staff"
                      rows="3"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Technical Details - Problem */}
            {formData.documentType === DOCUMENT_TYPES.returning ? (
              <div className="form-section">
                <h3>
                  Technical Details - Problem Description
                </h3>

                <div className="form-group">
                  <label>Nature of the Problem <span className="required">*</span></label>
                  <textarea
                    name="natureOfProblem"
                    value={formData.natureOfProblem}
                    onChange={handleInputChange}
                    placeholder="Describe the nature of the technical problem..."
                    rows="4"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Observation</label>
                  <textarea
                    name="observation"
                    value={formData.observation}
                    onChange={handleInputChange}
                    placeholder="Enter your observations, findings, or notes..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Priority Level</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="low">Low - Can be scheduled</option>
                    <option value="medium">Medium - Should be addressed soon</option>
                    <option value="high">High - Urgent attention needed</option>
                    <option value="critical">Critical - Immediate action required</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-section">
                <h3>Receiving Notes</h3>
                <div className="form-group">
                  <label>Observation</label>
                  <textarea
                    name="observation"
                    value={formData.observation}
                    onChange={handleInputChange}
                    placeholder="IT receiving observations"
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Priority Level</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="low">Low - Can be scheduled</option>
                    <option value="medium">Medium - Should be addressed soon</option>
                    <option value="high">High - Urgent attention needed</option>
                    <option value="critical">Critical - Immediate action required</option>
                  </select>
                </div>
              </div>
            )}

            {/* Key Recommendation */}
            {formData.documentType === DOCUMENT_TYPES.returning && (
              <div className="form-section">
                <h3>
                  {/*<span className="section-icon">🔑</span>*/}
                  Key Recommendation
                </h3>

                <div className="form-group">
                  <textarea
                    name="keyRecommendation"
                    value={formData.keyRecommendation}
                    onChange={handleInputChange}
                    placeholder="Provide your key recommendation(s) for addressing this issue..."
                    rows="3"
                  />
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button type="button" className="draft-btn" onClick={handleSaveDraft}>
                {/*<span className="btn-icon">💾</span>*/}
                Save as Draft
              </button>
              <button type="button" className="submit-btn" onClick={handleSubmit}>
                {/*<span className="btn-icon">📤</span>*/}
                Submit Document
              </button>
            </div>
          </div>
        )}

        {/* Drafts List */}
        {activeTab === 'drafts' && (
          <div className="documents-list">
            <h2>Draft Documents</h2>
            {filterDocuments(drafts).length > 0 ? (
              <div className="documents-grid">
                {filterDocuments(drafts).map(draft => (
                  <div key={draft.id} className="document-card draft">
                    <div className="card-header">
                      <span className="doc-status">Draft</span>
                      <span className="doc-date">{new Date(draft.savedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="card-body">
                      <div className="doc-type-row">
                        <span className={`doc-type-badge doc-type-${draft.documentType || DOCUMENT_TYPES.returning}`}>
                          {(draft.documentType || DOCUMENT_TYPES.returning).toUpperCase()}
                        </span>
                        <span className={`asset-status-badge asset-status-${(draft.assetStatus || 'active').replace(/\s+/g, '-').toLowerCase()}`}>
                          {draft.assetStatus || 'active'}
                        </span>
                      </div>
                      <h4>{draft.nameOfStaff || 'Unnamed'}</h4>
                      <p className="doc-device">{draft.deviceModel} - {draft.deviceSerialNumber}</p>
                      <p className="doc-preview">{(draft.natureOfProblem || draft.receivingComment || 'No notes').substring(0, 60)}...</p>
                    </div>
                    <div className="card-footer">
                      <button type="button" className="edit-btn" onClick={() => loadDraft(draft)}>
                        {/*<span className="btn-icon">✏️</span>*/}
                        Edit
                      </button>
                      <button type="button" className="delete-btn" onClick={() => deleteDraft(draft.id)}>
                        {/*<span className="btn-icon">🗑️</span>*/}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {/*<span className="empty-icon">📄</span>}*/}
                <p>No draft documents found</p>
                <button type="button" className="create-btn" onClick={() => setActiveTab('new')}>
                  Create New Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submitted Documents List */}
        {(activeTab === 'submitted' || activeTab === 'pending-signatures') && (
          <div className="documents-list">
            <h2>{submittedSectionTitle}</h2>
            {canManageDocuments && (
              <>
                <div className="document-workflow-summary">
                  <div className="summary-card">
                    <div className="summary-label">Receiving Documents</div>
                    <div className="summary-value">{itReceivingDocs.length}</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-label">Pending User Signatures</div>
                    <div className="summary-value">{itPendingSignatureDocs.length}</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-label">Signed and Returned</div>
                    <div className="summary-value">{itReturnedDocs.length}</div>
                  </div>
                </div>

                <div className="doc-queue-filters">
                  <button
                    type="button"
                    className={`queue-filter-btn ${itQueueFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setItQueueFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`queue-filter-btn ${itQueueFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setItQueueFilter('pending')}
                  >
                    Pending Signatures
                  </button>
                  <button
                    type="button"
                    className={`queue-filter-btn ${itQueueFilter === 'returned' ? 'active' : ''}`}
                    onClick={() => setItQueueFilter('returned')}
                  >
                    Signed and Returned
                  </button>
                </div>
              </>
            )}
            {displayedSubmittedDocs.length > 0 ? (
              <div className="documents-grid">
                {displayedSubmittedDocs.map(doc => (
                  <div key={doc.id} className="document-card submitted">
                    <div className="card-header">
                      <span className="doc-ref">{doc.documentRef}</span>
                      <span className="doc-date">{new Date(doc.submittedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="card-body">
                      <div className="doc-type-row">
                        <span className={`doc-type-badge doc-type-${doc.documentType || DOCUMENT_TYPES.returning}`}>
                          {(doc.documentType || DOCUMENT_TYPES.returning).toUpperCase()}
                        </span>
                        <span className={`asset-status-badge asset-status-${(doc.assetStatus || 'active').replace(/\s+/g, '-').toLowerCase()}`}>
                          {doc.assetStatus || 'active'}
                        </span>
                      </div>
                      <h4>{doc.nameOfStaff}</h4>
                      <p className="doc-position">{doc.position} - {doc.division}</p>
                      <p className="doc-device">{doc.deviceModel} | {doc.deviceSerialNumber}</p>
                      <div className="doc-approval-row">
                        <span className={`approval-badge approval-${doc.approvalStatus || 'pending'}`}>
                          {doc.approvalStatus || 'pending'}
                        </span>
                        <span className={`signature-badge signature-${(doc.signatureStatus || 'not_required').replace(/\s+/g, '-').toLowerCase()}`}>
                          {formatStatusLabel(doc.signatureStatus || 'not_required')}
                        </span>
                        {doc.disposalId && <span className="linked-disposal">From Disposal #{doc.disposalId}</span>}
                      </div>
                      <div className="doc-priority">
                        <span className={`priority-badge priority-${doc.priority}`}>
                          {doc.priority}
                        </span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button type="button" className="view-btn" onClick={() => viewDocument(doc)}>
                        {/*<span className="btn-icon">👁️</span>*/}
                        View
                      </button>
                      {canApproveDocuments && doc.approvalStatus === 'pending' && (
                        <>
                          <button type="button" className="approve-btn" onClick={() => handleApproval(doc, 'approved')}>
                            Approve
                          </button>
                          <button type="button" className="reject-btn" onClick={() => handleApproval(doc, 'rejected')}>
                            Reject
                          </button>
                        </>
                      )}
                      {canCurrentUserSign(doc) && (
                        <div className="signature-action-block">
                          <input
                            type="text"
                            placeholder="Type your digital signature"
                            value={signatureInputs[doc.id] || ''}
                            onChange={(e) =>
                              setSignatureInputs((prev) => ({
                                ...prev,
                                [doc.id]: e.target.value,
                              }))
                            }
                          />
                          <button type="button" className="approve-btn" onClick={() => handleSignDocument(doc)}>
                            Sign and Send to IT
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {/*<span className="empty-icon">📋</span>*/}
                <p>
                  {activeTab === 'pending-signatures'
                    ? 'No pending signatures right now.'
                    : 'No submitted documents found'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Document Preview Modal */}
        {showPreview && selectedDoc && (
          <div className="modal-overlay" onClick={() => setShowPreview(false)}>
            <div className="modal-content document-preview" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Document Preview</h2>
                <button className="close-modal" onClick={() => setShowPreview(false)}>✕</button>
              </div>
              
              <div className="preview-content">
                <div className="preview-header">
                  <h3>Rwanda Agriculture and Animal Resource Development Board</h3>
                  <p>
                    {selectedDoc.documentType === DOCUMENT_TYPES.receiving
                      ? 'Laptop Receive Form'
                      : 'Technical Returning Form'}
                  </p>
                  <div className="doc-ref-badge">{selectedDoc.documentRef || 'Draft'}</div>
                </div>

                <div className="preview-section">
                  <h4>Document Classification</h4>
                  <div className="preview-row">
                    <span className="preview-label">Document Type:</span>
                    <span>{selectedDoc.documentType || DOCUMENT_TYPES.returning}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Asset Status:</span>
                    <span className={`asset-status-badge asset-status-${(selectedDoc.assetStatus || 'active').replace(/\s+/g, '-').toLowerCase()}`}>
                      {selectedDoc.assetStatus || 'active'}
                    </span>
                  </div>
                </div>

                <div className="preview-section">
                  <h4>Staff Information</h4>
                  <div className="preview-row">
                    <span className="preview-label">Date:</span>
                    <span>{new Date(selectedDoc.date).toLocaleDateString()}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Name of Staff:</span>
                    <span>{selectedDoc.nameOfStaff}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Position:</span>
                    <span>{selectedDoc.position}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Division/Department/Unit:</span>
                    <span>{selectedDoc.division}</span>
                  </div>
                </div>

                <div className="preview-section">
                  <h4>Device Information</h4>
                  <div className="preview-row">
                    <span className="preview-label">Device Model:</span>
                    <span>{selectedDoc.deviceModel}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Serial Number:</span>
                    <span>{selectedDoc.deviceSerialNumber}</span>
                  </div>
                  {selectedDoc.rabAssetCode && (
                    <div className="preview-row">
                      <span className="preview-label">RAB Asset Code:</span>
                      <span>{selectedDoc.rabAssetCode}</span>
                    </div>
                  )}
                  {selectedDoc.documentType === DOCUMENT_TYPES.receiving && (
                    <>
                      <div className="preview-row">
                        <span className="preview-label">Recipient Email:</span>
                        <span>{selectedDoc.recipientEmail || '-'}</span>
                      </div>
                      <div className="preview-row">
                        <span className="preview-label">Source of Computer:</span>
                        <span>{selectedDoc.sourceOfComputer || '-'}</span>
                      </div>
                      <div className="preview-row">
                        <span className="preview-label">Acquisition Details:</span>
                        <span>{selectedDoc.acquisitionDetails || '-'}</span>
                      </div>
                      <div className="preview-row">
                        <span className="preview-label">Comment:</span>
                        <p>{selectedDoc.receivingComment || '-'}</p>
                      </div>
                    </>
                  )}
                </div>

                {(selectedDoc.documentType || DOCUMENT_TYPES.returning) === DOCUMENT_TYPES.returning ? (
                  <div className="preview-section">
                    <h4>Problem Description</h4>
                    <div className="preview-row">
                      <span className="preview-label">Nature of Problem:</span>
                      <p>{selectedDoc.natureOfProblem}</p>
                    </div>
                    {selectedDoc.observation && (
                      <div className="preview-row">
                        <span className="preview-label">Observation:</span>
                        <p>{selectedDoc.observation}</p>
                      </div>
                    )}
                    <div className="preview-row">
                      <span className="preview-label">Priority:</span>
                      <span className={`priority-badge priority-${selectedDoc.priority}`}>
                        {selectedDoc.priority}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="preview-section">
                    <h4>Receiving Details</h4>
                    {selectedDoc.observation && (
                      <div className="preview-row">
                        <span className="preview-label">Observation:</span>
                        <p>{selectedDoc.observation}</p>
                      </div>
                    )}
                    <div className="preview-row">
                      <span className="preview-label">Priority:</span>
                      <span className={`priority-badge priority-${selectedDoc.priority}`}>
                        {selectedDoc.priority}
                      </span>
                    </div>
                  </div>
                )}

                {(selectedDoc.documentType || DOCUMENT_TYPES.returning) === DOCUMENT_TYPES.receiving && (
                  <div className="preview-section">
                    <h4>User Signature</h4>
                    <div className="preview-row">
                      <span className="preview-label">Signature Status:</span>
                      <span className={`signature-badge signature-${(selectedDoc.signatureStatus || 'not_required').replace(/\s+/g, '-').toLowerCase()}`}>
                        {formatStatusLabel(selectedDoc.signatureStatus || 'not_required')}
                      </span>
                    </div>
                    <div className="preview-row">
                      <span className="preview-label">Digital Signature:</span>
                      <span>{selectedDoc.userSignature || '-'}</span>
                    </div>
                    <div className="preview-row">
                      <span className="preview-label">Signed At:</span>
                      <span>{selectedDoc.userSignedAt ? new Date(selectedDoc.userSignedAt).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                )}

                <div className="preview-section">
                  <h4>Approval</h4>
                  <div className="preview-row">
                    <span className="preview-label">Approval Status:</span>
                    <span className={`approval-badge approval-${selectedDoc.approvalStatus || 'pending'}`}>
                      {selectedDoc.approvalStatus || 'pending'}
                    </span>
                  </div>
                  {selectedDoc.approvedAt && (
                    <div className="preview-row">
                      <span className="preview-label">Reviewed At:</span>
                      <span>{new Date(selectedDoc.approvedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedDoc.approvalNote && (
                    <div className="preview-row">
                      <span className="preview-label">Review Note:</span>
                      <p>{selectedDoc.approvalNote}</p>
                    </div>
                  )}
                </div>

                {selectedDoc.keyRecommendation && (
                  <div className="preview-section">
                    <h4>Key Recommendation</h4>
                    <p>{selectedDoc.keyRecommendation}</p>
                  </div>
                )}

                <div className="preview-footer">
                  <p>Submitted by: {selectedDoc.submittedBy || user?.email}</p>
                  <p>Date: {new Date(selectedDoc.submittedAt || selectedDoc.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="close-btn" onClick={() => setShowPreview(false)}>Close</button>
                <button type="button" className="print-btn" onClick={() => window.print()}>
                  {/*<span className="btn-icon">🖨️</span>*/}
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="document-footer">
          <p>©2026. MURI. All rights reserved.</p>
          
        </footer>
      </div>
    </div>
  );
};

export default Document;
