'use client';

import { useEffect, useState } from 'react';
import { previewTemplate } from '@/lib/api';

function buildDefaultMessage(project) {
  if (!project) {
    return '';
  }

  return `Hi ${project.client.name},\n\nYour final delivery for ${project.title} is ready in Google Drive.\n\nPlease review the assets and reply if you would like revisions, alternate crops, or export changes.\n\nBest,\nStudio Ops`;
}

function buildDefaultSubject(project) {
  if (!project) {
    return '';
  }

  return `Your ${project.client.brandName} delivery is ready`;
}

export function EmailEditor({ templates, project, onSend, isSending }) {
  const [tone, setTone] = useState(templates?.[0]?.key ?? 'FORMAL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [error, setError] = useState('');
  const [isPreviewPending, setIsPreviewPending] = useState(false);

  useEffect(() => {
    setTone(project?.deliveryTemplateTone ?? templates?.[0]?.key ?? 'FORMAL');
    setSubject(buildDefaultSubject(project));
    setMessage(buildDefaultMessage(project));
    setPreviewText('');
    setPreviewSubject('');
    setError('');
  }, [project?.id, project?.deliveryTemplateTone, templates]);

  async function handlePreview() {
    if (!project) {
      return;
    }

    setError('');
    setIsPreviewPending(true);

    try {
      const response = await previewTemplate({
        projectId: project.id,
        tone,
        subject,
        message
      });

      setPreviewSubject(response.preview.subject);
      setPreviewText(response.preview.text);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsPreviewPending(false);
    }
  }

  async function handleSend() {
    if (!project) {
      return;
    }

    setError('');

    try {
      await onSend({
        projectId: project.id,
        tone,
        subject,
        message
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="rounded-[32px] border border-white/60 bg-[#132238] p-6 text-white shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Manual Override</p>
          <h2 className="mt-2 text-2xl font-semibold">Edit before sending</h2>
          <p className="mt-2 text-sm text-white/60">
            {project
              ? `Selected project: ${project.projectCode} for ${project.client.brandName}`
              : 'Select a project from the queue to customize its delivery email.'}
          </p>
        </div>
        <select
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm outline-none"
          value={tone}
          onChange={(event) => setTone(event.target.value)}
          disabled={!project}
        >
          {templates?.map((template) => (
            <option key={template.key} value={template.key} className="text-ink">
              {template.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4">
        <input
          className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm placeholder:text-white/35 outline-none disabled:opacity-45"
          placeholder="Subject line"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={!project || project.deliveryEmailSent}
        />
        <textarea
          className="min-h-[220px] rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 placeholder:text-white/35 outline-none disabled:opacity-45"
          placeholder="Add a custom note, delivery instructions, or revision CTA."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!project || project.deliveryEmailSent}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-3xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-[#ffd8cf]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={!project || isSending || project.deliveryEmailSent}
          className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? 'Sending...' : project?.deliveryEmailSent ? 'Already Sent' : 'Send Now'}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={!project || isPreviewPending || project.deliveryEmailSent}
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPreviewPending ? 'Loading Preview...' : 'Preview Template'}
        </button>
      </div>

      {project?.deliveryEmailSent ? (
        <p className="mt-4 text-xs text-white/55">
          This project is already marked as delivered. Select a pending project to edit and send a live email.
        </p>
      ) : null}

      {previewText ? (
        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Rendered Preview</p>
          <p className="mt-3 text-sm font-semibold text-white">{previewSubject}</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/72">{previewText}</pre>
        </div>
      ) : null}
    </div>
  );
}
