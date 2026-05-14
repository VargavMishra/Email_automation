'use client';

import { useEffect, useState } from 'react';
import { previewTemplate } from '@/lib/api';

function buildDefaultMessage(project) {
  if (!project) {
    return '';
  }

  return `Hi ${project.client?.name ?? 'there'},\n\nYour final delivery for ${project.title} is ready in Google Drive.\n\nPlease review the assets and reply if you would like revisions, alternate crops, or export changes.\n\nBest,\nStudio Ops`;
}

function buildDefaultSubject(project) {
  if (!project) {
    return '';
  }

  return `Your ${project.client?.brandName ?? 'Studio'} delivery is ready`;
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
    <div className="glass-panel motion-enter rounded-3xl p-5">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Manual Override</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Edit before sending</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            {project
              ? `Selected project: ${project.projectCode} for ${project.client?.brandName ?? 'Unknown Brand'}`
              : 'Select a project from the queue to customize its delivery email.'}
          </p>
        </div>
        <select
          className="control-surface w-full rounded-xl px-4 py-3 text-sm text-ink outline-none sm:w-52"
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

      <div className="relative z-10 mt-6 grid gap-4">
        <input
          className="control-surface rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink/35 outline-none disabled:cursor-not-allowed disabled:bg-white/35 disabled:opacity-70"
          placeholder="Subject line"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={!project || project.deliveryEmailSent}
        />
        <textarea
          className="control-surface min-h-44 rounded-xl px-4 py-3 text-sm leading-7 text-ink placeholder:text-ink/35 outline-none disabled:cursor-not-allowed disabled:bg-white/35 disabled:opacity-70"
          placeholder="Add a custom note, delivery instructions, or revision CTA."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!project || project.deliveryEmailSent}
        />
      </div>

      {error ? (
        <p className="glass-inner relative z-10 mt-4 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="relative z-10 mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={!project || isSending || project.deliveryEmailSent}
          className="btn-accent rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? 'Sending...' : project?.deliveryEmailSent ? 'Already Sent' : 'Send Now'}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={!project || isPreviewPending || project.deliveryEmailSent}
          className="glass-inner rounded-xl px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPreviewPending ? 'Loading Preview...' : 'Preview Template'}
        </button>
      </div>

      {project?.deliveryEmailSent ? (
        <p className="relative z-10 mt-4 text-xs text-ink/55">
          This project is already marked as delivered. Select a pending project to edit and send a live email.
        </p>
      ) : null}

      {previewText ? (
        <div className="glass-inner relative z-10 mt-5 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Rendered Preview</p>
          <p className="mt-3 text-sm font-semibold text-ink">{previewSubject}</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/70">{previewText}</pre>
        </div>
      ) : null}
    </div>
  );
}
