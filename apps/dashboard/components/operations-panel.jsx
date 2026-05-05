'use client';

import { useEffect, useState } from 'react';

const statusOptions = ['EDITING', 'REVIEW', 'COMPLETED', 'HOLD'];
const toneOptions = [
  { key: 'FORMAL', label: 'Formal' },
  { key: 'FRIENDLY', label: 'Friendly' },
  { key: 'PREMIUM', label: 'Premium' }
];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return 'w-full rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink/30';
}

export function OperationsPanel({
  clients,
  projects,
  selectedProject,
  onSelectProject,
  onCreateClient,
  onCreateProject,
  onUpdateProject,
  isSaving
}) {
  const [mode, setMode] = useState('project');
  const [clientForm, setClientForm] = useState({
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
    notes: ''
  });
  const [updateForm, setUpdateForm] = useState({
    status: selectedProject?.status ?? 'EDITING',
    driveFolderLink: selectedProject?.driveFolderLink ?? '',
    requiresFollowUp: selectedProject?.requiresFollowUp ?? false,
    followUpSentAt: ''
  });

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
  }, [
    selectedProject?.id,
    selectedProject?.status,
    selectedProject?.driveFolderLink,
    selectedProject?.requiresFollowUp,
    selectedProject?.followUpSentAt
  ]);

  async function submitClient(event) {
    event.preventDefault();
    const saved = await onCreateClient({
      ...clientForm,
      phone: clientForm.phone || undefined,
      notes: clientForm.notes || undefined
    });

    if (saved) {
      setClientForm({
        name: '',
        brandName: '',
        email: '',
        phone: '',
        notes: ''
      });
    }
  }

  async function submitProject(event) {
    event.preventDefault();
    const saved = await onCreateProject({
      ...projectForm,
      notes: projectForm.notes || undefined
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
        notes: ''
      });
    }
  }

  async function submitUpdate(event) {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    await onUpdateProject(selectedProject.id, {
      status: updateForm.status,
      driveFolderLink: updateForm.driveFolderLink,
      requiresFollowUp: updateForm.requiresFollowUp,
      followUpSentAt: updateForm.followUpSentAt
        ? new Date(updateForm.followUpSentAt).toISOString()
        : undefined
    });
  }

  return (
    <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Studio Operations</h2>
          <p className="mt-1 text-sm text-ink/60">Create records, update project state, and let the delivery worker send when ready.</p>
        </div>
        <div className="flex rounded-lg border border-ink/10 bg-sand/40 p-1 text-sm">
          {[
            ['client', 'Client'],
            ['project', 'Project'],
            ['status', 'Status']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-md px-3 py-2 font-semibold ${mode === key ? 'bg-white text-ink shadow-sm' : 'text-ink/55'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'client' ? (
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitClient}>
          <Field label="Client Name">
            <input className={inputClass()} required value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
          </Field>
          <Field label="Brand Name">
            <input className={inputClass()} required value={clientForm.brandName} onChange={(event) => setClientForm({ ...clientForm, brandName: event.target.value })} />
          </Field>
          <Field label="Client Email">
            <input className={inputClass()} required type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass()} value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea className={`${inputClass()} min-h-20`} value={clientForm.notes} onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <button disabled={isSaving} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? 'Saving...' : 'Add Client'}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'project' ? (
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitProject}>
          <Field label="Client">
            <select className={inputClass()} required value={projectForm.clientId} onChange={(event) => setProjectForm({ ...projectForm, clientId: event.target.value })}>
              <option value="" disabled>Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.brandName} - {client.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Project Code">
            <input className={inputClass()} required placeholder="APR-TEST-002" value={projectForm.projectCode} onChange={(event) => setProjectForm({ ...projectForm, projectCode: event.target.value })} />
          </Field>
          <Field label="Project Title">
            <input className={inputClass()} required value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} />
          </Field>
          <Field label="Status">
            <select className={inputClass()} value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Template Tone">
            <select className={inputClass()} value={projectForm.deliveryTemplateTone} onChange={(event) => setProjectForm({ ...projectForm, deliveryTemplateTone: event.target.value })}>
              {toneOptions.map((tone) => <option key={tone.key} value={tone.key}>{tone.label}</option>)}
            </select>
          </Field>
          <Field label="Drive Folder Link">
            <input className={inputClass()} required value={projectForm.driveFolderLink} onChange={(event) => setProjectForm({ ...projectForm, driveFolderLink: event.target.value })} />
          </Field>
          <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink/75">
            <input
              type="checkbox"
              checked={projectForm.requiresFollowUp}
              onChange={(event) => setProjectForm({ ...projectForm, requiresFollowUp: event.target.checked })}
            />
            Follow-up required before delivery
          </label>
          <Field label="Notes">
            <input className={inputClass()} value={projectForm.notes} onChange={(event) => setProjectForm({ ...projectForm, notes: event.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <button disabled={isSaving || !clients.length} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? 'Saving...' : 'Add Project'}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'status' ? (
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitUpdate}>
          <Field label="Selected Project">
            <select className={inputClass()} value={selectedProject?.id ?? ''} onChange={(event) => {
              const project = projects.find((item) => item.id === event.target.value);
              if (project) {
                onSelectProject(project.id);
                setUpdateForm({
                  status: project.status,
                  driveFolderLink: project.driveFolderLink,
                  requiresFollowUp: project.requiresFollowUp,
                  followUpSentAt: project.followUpSentAt ? project.followUpSentAt.slice(0, 16) : ''
                });
              }
            }}>
              <option value="" disabled>Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectCode} - {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass()} disabled={!selectedProject} value={updateForm.status} onChange={(event) => setUpdateForm({ ...updateForm, status: event.target.value })}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Drive Folder Link">
              <input className={inputClass()} disabled={!selectedProject} value={updateForm.driveFolderLink} onChange={(event) => setUpdateForm({ ...updateForm, driveFolderLink: event.target.value })} />
            </Field>
          </div>
          <Field label="Follow-up Sent At">
            <input className={inputClass()} disabled={!selectedProject} type="datetime-local" value={updateForm.followUpSentAt} onChange={(event) => setUpdateForm({ ...updateForm, followUpSentAt: event.target.value })} />
          </Field>
          <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink/75">
            <input
              type="checkbox"
              disabled={!selectedProject}
              checked={updateForm.requiresFollowUp}
              onChange={(event) => setUpdateForm({ ...updateForm, requiresFollowUp: event.target.checked })}
            />
            Follow-up required before delivery
          </label>
          <div className="flex items-end">
            <button disabled={isSaving || !selectedProject} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
