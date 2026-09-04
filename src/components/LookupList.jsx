import React, { useState } from 'react';
import { FaPen, FaPlus, FaTrash } from 'react-icons/fa';

// Generic add/rename/delete list editor, used for the Departments and
// Stations lookup tables on the admin Users page.
const LookupList = ({ title, items, onCreate, onUpdate, onDelete }) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    setError('');
    setBusy(true);
    try {
      await onCreate(name);
      setNewName('');
    } catch (err) {
      setError(err?.response?.data?.detail || `Failed to add ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (item) => {
    const name = editingName.trim();
    if (!name || name === item.name) {
      cancelEdit();
      return;
    }

    setError('');
    setBusy(true);
    try {
      await onUpdate(item.id, name);
      cancelEdit();
    } catch (err) {
      setError(err?.response?.data?.detail || `Failed to rename ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    setError('');
    setBusy(true);
    try {
      await onDelete(item.id);
    } catch (err) {
      setError(err?.response?.data?.detail || `Failed to delete ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lookup-editor-card">
      <h2 className="lookup-editor-title">{title}</h2>
      {error && <div className="admin-users-message error lookup-editor-error">{error}</div>}

      <div className="lookup-editor-list">
        {items.length === 0 && <p className="lookup-editor-empty">No {title.toLowerCase()} added yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="lookup-editor-row">
            {editingId === item.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="lookup-editor-input"
                  aria-label={`Edit ${title.toLowerCase()}`}
                  autoFocus
                />
                <button type="button" className="row-action-btn" disabled={busy} onClick={() => saveEdit(item)}>Save</button>
                <button type="button" className="row-action-btn" disabled={busy} onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <>
                <span className="lookup-editor-name">{item.name}</span>
                <button type="button" className="row-action-btn" disabled={busy} onClick={() => startEdit(item)}>
                  <FaPen />
                </button>
                <button type="button" className="row-action-btn danger" disabled={busy} onClick={() => handleDelete(item)}>
                  <FaTrash />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="lookup-editor-create">
        <input
          type="text"
          className="lookup-editor-input"
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')}`}
          aria-label={`New ${title.toLowerCase().replace(/s$/, '')}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          style={{ flex: 1 }}
        />
        <button type="button" className="row-action-btn" disabled={busy || !newName.trim()} onClick={handleCreate}>
          <FaPlus /> Add
        </button>
      </div>
    </section>
  );
};

export default LookupList;
