'use client';

import { useEffect, useState } from 'react';

export function Panel({ title, description, eyebrow, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="head-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, note, attention }) {
  return (
    <article className={`stat ${attention ? 'attention' : ''}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small> {unit}</small>}
      </strong>
      {note && <em>{note}</em>}
    </article>
  );
}

export function Badge({ state, children }) {
  return (
    <span className={`badge ${state || ''}`}>
      <i />
      {children ?? state}
    </span>
  );
}

export function Empty({ icon = '◎', title, children }) {
  return (
    <div className="empty">
      <i>{icon}</i>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state">
      <span className="loader" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state error">
      <strong>Something went wrong</strong>
      <span>{error?.message || String(error)}</span>
      {onRetry && (
        <button className="btn tiny" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Modal({ title, description, onClose, className = '', wide = false, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>
  );
}

/** Small transient notification. Returns [node, notify]. */
export function useToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message, bad = false) => setToast({ message, bad });
  const node = toast ? (
    <div className={`toast ${toast.bad ? 'bad' : ''}`} onClick={() => setToast(null)}>
      <strong>{toast.bad ? 'Failed' : 'Done'}</strong>
      <span>{toast.message}</span>
    </div>
  ) : null;

  return [node, notify];
}

/** Standard load/refresh lifecycle shared by every page. */
export function useResource(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const reload = async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, data: await loader(), error: null });
    } catch (error) {
      setState({ loading: false, data: null, error });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loader();
        if (!cancelled) setState({ loading: false, data, error: null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, data: null, error });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload, setData: (data) => setState((previous) => ({ ...previous, data })) };
}
