'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const statusOptions = ['EDITING', 'REVIEW', 'COMPLETED', 'HOLD'];
const toneOptions = [
  { key: 'FORMAL', label: 'Formal' },
  { key: 'FRIENDLY', label: 'Friendly' },
  { key: 'PREMIUM', label: 'Premium' }
];

const countryCodes = [
  { name: 'India', code: 'in', dial: '+91' },
  { name: 'United States', code: 'us', dial: '+1' },
  { name: 'United Kingdom', code: 'gb', dial: '+44' },
  { name: 'Australia', code: 'au', dial: '+61' },
  { name: 'Canada', code: 'ca', dial: '+1' },
  { name: 'UAE', code: 'ae', dial: '+971' },
  { name: 'Singapore', code: 'sg', dial: '+65' },
  { name: 'Germany', code: 'de', dial: '+49' },
  { name: 'France', code: 'fr', dial: '+33' },
  { name: 'Japan', code: 'jp', dial: '+81' },
  { name: 'China', code: 'cn', dial: '+86' },
  { name: 'Brazil', code: 'br', dial: '+55' },
  { name: 'Mexico', code: 'mx', dial: '+52' },
  { name: 'Pakistan', code: 'pk', dial: '+92' },
  { name: 'Bangladesh', code: 'bd', dial: '+880' },
  { name: 'Sri Lanka', code: 'lk', dial: '+94' },
  { name: 'Nepal', code: 'np', dial: '+977' },
  { name: 'South Africa', code: 'za', dial: '+27' },
  { name: 'Nigeria', code: 'ng', dial: '+234' },
  { name: 'Kenya', code: 'ke', dial: '+254' },
];

function FlagImg({ code }) {
  return (
    <span
      className={`fi fi-${code}`}
      style={{ width: '20px', height: '15px', display: 'inline-block', borderRadius: '2px', backgroundSize: 'cover', flexShrink: 0 }}
    />
  );
}

function PhoneInput({ value, onChange, disabled }) {
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [localNumber, setLocalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // Parse incoming value to split dial code and local number
  useEffect(() => {
    if (value) {
      const match = countryCodes.find(c => value.startsWith(c.dial));
      if (match) {
        setSelectedCountry(match);
        setLocalNumber(value.slice(match.dial.length).trim());
      } else {
        setLocalNumber(value);
      }
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClose(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        listRef.current && !listRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClose);
      return () => document.removeEventListener('mousedown', handleClose);
    }
  }, [isOpen]);

  // Calculate position — use page-level coords (rect + scroll) for position:absolute in body portal.
  // position:fixed breaks when any ancestor has a CSS transform (glassmorphism, animations, etc).
  function handleOpen() {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: Math.max(260, rect.width)
      });
    }
    setIsOpen(prev => !prev);
    setSearch('');
  }

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch('');
    onChange(`${country.dial} ${localNumber}`.trim());
  };

  const handleNumberChange = (e) => {
    const num = e.target.value.replace(/[^0-9\s\-()]/g, '');
    setLocalNumber(num);
    onChange(`${selectedCountry.dial} ${num}`.trim());
  };

  const filtered = countryCodes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  const dropdown = isOpen ? (
    <div
      ref={listRef}
      style={{
        position: 'absolute',   // absolute inside body portal = page coordinates
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        borderRadius: '16px',
        backgroundColor: '#fff',
        border: '1px solid #e4e4e7',
        overflow: 'hidden'
      }}
    >
      {/* Search */}
      <div style={{ padding: '8px', borderBottom: '1px solid #f4f4f5' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or code..."
          style={{
            width: '100%',
            padding: '7px 12px',
            fontSize: '13px',
            background: '#fafafa',
            border: '1px solid #e4e4e7',
            borderRadius: '10px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>
      {/* List */}
      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {filtered.map((country) => (
          <button
            key={country.name}
            type="button"
            onClick={() => handleCountrySelect(country)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 16px',
              fontSize: '13px',
              background: selectedCountry.name === country.name ? '#f4f4f5' : 'transparent',
              fontWeight: selectedCountry.name === country.name ? '600' : '400',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s'
            }}
            onMouseEnter={e => { if (selectedCountry.name !== country.name) e.currentTarget.style.background = '#fafafa'; }}
            onMouseLeave={e => { if (selectedCountry.name !== country.name) e.currentTarget.style.background = 'transparent'; }}
          >
            <FlagImg code={country.code} />
            <span style={{ flex: 1, color: '#27272a' }}>{country.name}</span>
            <span style={{ fontFamily: 'monospace', color: '#a1a1aa', fontSize: '12px' }}>{country.dial}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#a1a1aa', padding: '16px' }}>No results</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex gap-2">
      {/* Country Code Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="control-surface flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink outline-none whitespace-nowrap disabled:opacity-65 hover:bg-white/60 transition-colors min-w-[100px]"
      >
        <FlagImg code={selectedCountry.code} />
        <span className="font-mono text-ink/70">{selectedCountry.dial}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {/* Number Input */}
      <input
        type="tel"
        disabled={disabled}
        value={localNumber}
        onChange={handleNumberChange}
        placeholder="Enter phone number"
        className="control-surface w-full rounded-xl px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/35 disabled:cursor-not-allowed disabled:opacity-65"
      />

      {/* Portal at body — position:absolute + page coords = immune to parent transforms */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return 'control-surface w-full rounded-xl px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/35 disabled:cursor-not-allowed disabled:bg-white/35 disabled:opacity-65';
}

export function OperationsPanel({
  clients,
  projects,
  selectedProject,
  onSelectProject,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  isSaving
}) {
  const [mode, setMode] = useState('project');
  const [clientMode, setClientMode] = useState('create');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [statusClientId, setStatusClientId] = useState('');
  const [deleteByCode, setDeleteByCode] = useState('');
  
  const [clientForm, setClientForm] = useState({
    name: '',
    brandName: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [clientEditForm, setClientEditForm] = useState({
    name: '',
    brandName: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [projectForm, setProjectForm] = useState({
    clientId: '',
    projectCode: '',
    title: '',
    status: 'EDITING',
    requiresFollowUp: false,
    driveFolderLink: '',
    deliveryTemplateTone: 'FORMAL',
    notes: '',
    sendImmediately: false
  });
  const [updateForm, setUpdateForm] = useState({
    status: selectedProject?.status ?? 'EDITING',
    driveFolderLink: selectedProject?.driveFolderLink ?? '',
    requiresFollowUp: selectedProject?.requiresFollowUp ?? false,
    followUpSentAt: ''
  });

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const statusClientProjects = projects.filter(p => p.clientId === statusClientId);

  useEffect(() => {
    setSelectedClientId((current) => {
      if (current && clients.some((client) => client.id === current)) {
        return current;
      }
      return clients[0]?.id ?? '';
    });
  }, [clients]);

  useEffect(() => {
    setClientEditForm({
      name: selectedClient?.name ?? '',
      brandName: selectedClient?.brandName ?? '',
      email: selectedClient?.email ?? '',
      phone: selectedClient?.phone ?? '',
      notes: selectedClient?.notes ?? ''
    });
  }, [selectedClient]);

  useEffect(() => {
    setProjectForm((current) => ({
      ...current,
      clientId: current.clientId || clients[0]?.id || ''
    }));
  }, [clients]);

  useEffect(() => {
    setUpdateForm({
      status: selectedProject?.status ?? 'EDITING',
      driveFolderLink: selectedProject?.driveFolderLink ?? '',
      requiresFollowUp: selectedProject?.requiresFollowUp ?? false,
      followUpSentAt: selectedProject?.followUpSentAt ? selectedProject.followUpSentAt.slice(0, 16) : ''
    });
    if (selectedProject?.clientId) {
      setStatusClientId(selectedProject.clientId);
    }
  }, [selectedProject]);

  async function submitClient(event) {
    event.preventDefault();
    const saved = await onCreateClient({
      ...clientForm,
      phone: clientForm.phone || undefined,
      notes: clientForm.notes || undefined
    });
    if (saved) {
      setClientForm({ name: '', brandName: '', email: '', phone: '', notes: '' });
    }
  }

  async function submitClientEdit(event) {
    event.preventDefault();
    if (!selectedClient) return;
    await onUpdateClient(selectedClient.id, {
      ...clientEditForm,
      phone: clientEditForm.phone || null,
      notes: clientEditForm.notes || null
    });
  }

  async function submitProject(event) {
    event.preventDefault();
    const { sendImmediately, ...projectInput } = projectForm;
    const saved = await onCreateProject({
      ...projectInput,
      status: sendImmediately ? 'COMPLETED' : projectInput.status,
      requiresFollowUp: sendImmediately ? false : projectInput.requiresFollowUp,
      notes: projectInput.notes || undefined,
      sendImmediately
    });
    if (saved) {
      setProjectForm({
        clientId: clients[0]?.id || '',
        projectCode: '',
        title: '',
        status: 'EDITING',
        requiresFollowUp: false,
        driveFolderLink: '',
        deliveryTemplateTone: 'FORMAL',
        notes: '',
        sendImmediately: false
      });
    }
  }

  async function submitUpdate(event) {
    event.preventDefault();
    if (!selectedProject) return;
    await onUpdateProject(selectedProject.id, {
      status: updateForm.status,
      driveFolderLink: updateForm.driveFolderLink,
      requiresFollowUp: updateForm.requiresFollowUp,
      followUpSentAt: updateForm.followUpSentAt ? new Date(updateForm.followUpSentAt).toISOString() : undefined
    });
  }

  const handleDeleteByCode = () => {
    const project = projects.find(p => p.projectCode.toLowerCase() === deleteByCode.toLowerCase());
    if (!project) {
      alert(`No project found with code: ${deleteByCode}`);
      return;
    }
    onDeleteProject(project.id);
    setDeleteByCode('');
  };

  return (
    <div className="glass-panel motion-enter rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative z-10">
          <h2 className="text-xl font-semibold text-ink">Studio Operations</h2>
          <p className="mt-1 text-sm text-ink/60">Manage your clients and project lifecycle.</p>
        </div>
        <div className="glass-inner relative z-10 flex rounded-2xl p-1 text-sm">
          {[
            ['client', 'Client'],
            ['project', 'Project'],
            ['status', 'Status'],
            ['delete', 'Delete']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-xl px-3 py-2 font-semibold transition ${mode === key ? 'bg-ink text-white shadow-sm' : 'text-ink/55 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'client' && (
        <div className="relative z-10 mt-5">
          <div className="glass-inner inline-flex rounded-2xl p-1 text-sm">
            {[ ['create', 'Add Client'], ['edit', 'Edit Existing'] ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setClientMode(key)} className={`rounded-xl px-3 py-2 font-semibold transition ${clientMode === key ? 'bg-ink text-white shadow-sm' : 'text-ink/55 hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          {clientMode === 'create' ? (
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitClient}>
              <Field label="Client Name"><input className={inputClass()} required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} /></Field>
              <Field label="Brand Name"><input className={inputClass()} required value={clientForm.brandName} onChange={(e) => setClientForm({ ...clientForm, brandName: e.target.value })} /></Field>
              <Field label="Client Email"><input className={inputClass()} required type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></Field>
              <Field label="Phone"><PhoneInput disabled={isSaving} value={clientForm.phone} onChange={(v) => setClientForm({ ...clientForm, phone: v })} /></Field>
              <div className="md:col-span-2"><Field label="Notes"><textarea className={`${inputClass()} min-h-20`} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} /></Field></div>
              <div className="md:col-span-2"><button disabled={isSaving} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? 'Saving...' : 'Add Client'}</button></div>
            </form>
          ) : (
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitClientEdit}>
              <div className="md:col-span-2"><Field label="Existing Client"><select className={inputClass()} value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}><option value="" disabled>Select client</option>{clients.map((c) => (<option key={c.id} value={c.id}>{c.brandName} - {c.name}</option>))}</select></Field></div>
              <Field label="Client Name"><input className={inputClass()} required disabled={!selectedClient} value={clientEditForm.name} onChange={(e) => setClientEditForm({ ...clientEditForm, name: e.target.value })} /></Field>
              <Field label="Brand Name"><input className={inputClass()} required disabled={!selectedClient} value={clientEditForm.brandName} onChange={(e) => setClientEditForm({ ...clientEditForm, brandName: e.target.value })} /></Field>
              <Field label="Client Email"><input className={inputClass()} required disabled={!selectedClient} type="email" value={clientEditForm.email} onChange={(e) => setClientEditForm({ ...clientEditForm, email: e.target.value })} /></Field>
              <Field label="Phone"><PhoneInput disabled={!selectedClient} value={clientEditForm.phone} onChange={(v) => setClientEditForm({ ...clientEditForm, phone: v })} /></Field>
              <div className="md:col-span-2"><Field label="Notes"><textarea className={`${inputClass()} min-h-20`} disabled={!selectedClient} value={clientEditForm.notes} onChange={(e) => setClientEditForm({ ...clientEditForm, notes: e.target.value })} /></Field></div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button disabled={isSaving || !selectedClient} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? 'Updating...' : 'Update Client'}</button>
                <button type="button" disabled={isSaving || !selectedClient} onClick={() => onDeleteClient(selectedClient.id)} className="px-4 py-2.5 text-sm font-semibold text-coral hover:bg-coral/10 rounded-xl transition-colors disabled:opacity-50">Delete Client</button>
              </div>
            </form>
          )}
        </div>
      )}

      {mode === 'project' && (
        <form className="relative z-10 mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitProject}>
          <Field label="Client"><select className={inputClass()} required value={projectForm.clientId} onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })}><option value="" disabled>Select client</option>{clients.map((c) => (<option key={c.id} value={c.id}>{c.brandName} - {c.name}</option>))}</select></Field>
          <Field label="Project Code"><input className={inputClass()} required placeholder="APR-TEST-002" value={projectForm.projectCode} onChange={(e) => setProjectForm({ ...projectForm, projectCode: e.target.value })} /></Field>
          <Field label="Project Title"><input className={inputClass()} required value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} /></Field>
          <Field label="Status"><select className={inputClass()} disabled={projectForm.sendImmediately} value={projectForm.sendImmediately ? 'COMPLETED' : projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Template Tone"><select className={inputClass()} value={projectForm.deliveryTemplateTone} onChange={(e) => setProjectForm({ ...projectForm, deliveryTemplateTone: e.target.value })}>{toneOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
          <Field label="Drive Folder Link"><input className={inputClass()} required value={projectForm.driveFolderLink} onChange={(e) => setProjectForm({ ...projectForm, driveFolderLink: e.target.value })} /></Field>
          <label className="glass-inner flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/75"><input type="checkbox" className="h-4 w-4 accent-coral" disabled={projectForm.sendImmediately} checked={projectForm.requiresFollowUp} onChange={(e) => setProjectForm({ ...projectForm, requiresFollowUp: e.target.checked })} />Require client check-in</label>
          <label className="glass-inner flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink"><input type="checkbox" className="h-4 w-4 accent-coral" checked={projectForm.sendImmediately} onChange={(e) => setProjectForm({...projectForm, sendImmediately: e.target.checked, status: e.target.checked ? 'COMPLETED' : projectForm.status, requiresFollowUp: e.target.checked ? false : projectForm.requiresFollowUp})} />Send delivery email immediately</label>
          <Field label="Notes"><input className={inputClass()} value={projectForm.notes} onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })} /></Field>
          <div className="md:col-span-2"><button disabled={isSaving || !clients.length} className={`${projectForm.sendImmediately ? 'btn-accent' : 'btn-primary'} rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60`}>{isSaving ? 'Saving...' : 'Add Project'}</button></div>
        </form>
      )}

      {mode === 'status' && (
        <form className="relative z-10 mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitUpdate}>
          <Field label="Step 1: Focus on Client">
            <select className={inputClass()} value={statusClientId} onChange={(e) => setStatusClientId(e.target.value)}>
              <option value="">Select a client</option>
              {clients.map((c) => (<option key={c.id} value={c.id}>{c.brandName}</option>))}
            </select>
          </Field>
          <Field label="Step 2: Select Project">
            <select className={inputClass()} disabled={!statusClientId} value={selectedProject?.id ?? ''} onChange={(e) => onSelectProject(e.target.value)}>
              <option value="" disabled>Select a project</option>
              {statusClientProjects.map((p) => (<option key={p.id} value={p.id}>{p.projectCode} - {p.title}</option>))}
              {statusClientId && statusClientProjects.length === 0 && <option disabled>No projects found</option>}
            </select>
          </Field>
          <Field label="Current Status"><select className={inputClass()} disabled={!selectedProject} value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          <div className="md:col-span-2"><Field label="Drive Folder Link"><input className={inputClass()} disabled={!selectedProject} value={updateForm.driveFolderLink} onChange={(e) => setUpdateForm({ ...updateForm, driveFolderLink: e.target.value })} /></Field></div>
          <Field label="Check-in Completed At"><input className={inputClass()} disabled={!selectedProject} type="datetime-local" value={updateForm.followUpSentAt} onChange={(e) => setUpdateForm({ ...updateForm, followUpSentAt: e.target.value })} /></Field>
          <label className="glass-inner flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/75"><input type="checkbox" className="h-4 w-4 accent-coral" disabled={!selectedProject} checked={updateForm.requiresFollowUp} onChange={(e) => setUpdateForm({ ...updateForm, requiresFollowUp: e.target.checked })} />Require client check-in</label>
          <div className="md:col-span-2"><button disabled={isSaving || !selectedProject} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? 'Updating...' : 'Update Project'}</button></div>
        </form>
      )}

      {mode === 'delete' && (
        <div className="relative z-10 mt-5 space-y-8 animate-in fade-in duration-300">
          {/* Delete by Code */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-coral">Option 1: Delete by Project Code</h3>
            <div className="flex gap-3">
              <input 
                className={inputClass()} 
                placeholder="Enter Project Code (e.g. APR-001)" 
                value={deleteByCode} 
                onChange={(e) => setDeleteByCode(e.target.value)} 
              />
              <button 
                onClick={handleDeleteByCode}
                disabled={!deleteByCode || isSaving}
                className="bg-coral text-white px-6 rounded-xl font-bold text-sm hover:brightness-110 transition disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="h-px bg-zinc-200/50 w-full" />

          {/* Delete by Client Focus */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-coral">Option 2: Client-Focused Delete</h3>
            <Field label="Select Client to view projects">
              <select className={inputClass()} value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                <option value="" disabled>Select client</option>
                {clients.map((c) => (<option key={c.id} value={c.id}>{c.brandName}</option>))}
              </select>
            </Field>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {projects.filter(p => p.clientId === selectedClientId).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 glass-inner rounded-xl border border-coral/10 hover:border-coral/30 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-zinc-800">{p.projectCode}</p>
                    <p className="text-xs text-zinc-500">{p.title}</p>
                  </div>
                  <button 
                    onClick={() => onDeleteProject(p.id)}
                    className="p-2 text-coral hover:bg-coral/10 rounded-lg transition-colors"
                    title="Permanently Delete"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              ))}
              {selectedClientId && projects.filter(p => p.clientId === selectedClientId).length === 0 && (
                <p className="text-zinc-400 text-sm italic py-4 text-center">No projects found for this client.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

