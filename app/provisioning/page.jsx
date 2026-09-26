'use client';

import { useState } from 'react';
import { api, formatDateTime, formatRelative } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Modal, Panel, useResource, useToast } from '../components/ui';

export default function ProvisioningPage() {
  const [form, setForm] = useState({ name: '', screenLabel: '', serialNumber: '', timezone: 'Africa/Lagos', ttlHours: 168, notes: '' });
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toastNode, notify] = useToast();
  const { loading, data, error, reload } = useResource(() => api.provisioningCodes());

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  async function issue(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.createProvisioningCode({
        ...form,
        serialNumber: form.serialNumber.trim() || undefined,
        ttlHours: Number(form.ttlHours)
      });
      setIssued(result.token);
      setForm((previous) => ({ ...previous, name: '', screenLabel: '', serialNumber: '', notes: '' }));
      reload();
    } catch (issueError) {
      notify(issueError.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    try {
      await api.deleteProvisioningCode(id);
      notify('Code revoked.');
      reload();
    } catch (revokeError) {
      notify(revokeError.message, true);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>Provisioning</h1>
          <p>
            A fresh Pi has no REGISTERED_BOX_NUMBER. Issue a single-use code here, hand it to the installer, and the
            device exchanges it for its box number and API key on first contact — over the internet or over Ethernet
            from a LAN copy of this server.
          </p>
        </div>
        <button className="btn" onClick={reload}>
          Refresh
        </button>
      </header>

      <div className="grid two">
        <Panel eyebrow="Step 1" title="Issue a provisioning code">
          <form onSubmit={issue}>
            <div className="form-grid">
              <label className="field">
                Box name
                <input value={form.name} onChange={update('name')} placeholder="Lagos Van 01" required />
              </label>
              <label className="field">
                Screen label
                <input value={form.screenLabel} onChange={update('screenLabel')} placeholder="Roof LED — left" />
              </label>
              <label className="field">
                Timezone
                <input value={form.timezone} onChange={update('timezone')} />
              </label>
              <label className="field">
                Valid for (hours)
                <input type="number" min="1" max="8760" value={form.ttlHours} onChange={update('ttlHours')} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                Pre-assign a box number (optional)
                <input
                  value={form.serialNumber}
                  onChange={update('serialNumber')}
                  placeholder="Leave blank to generate ADBOX-XXXX-XXXX automatically"
                />
              </label>
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              Notes
              <textarea value={form.notes} onChange={update('notes')} placeholder="Vehicle, contact, install date…" />
            </label>
            <div className="form-actions">
              <button className="btn primary" disabled={busy || !form.name.trim()}>
                {busy ? 'Issuing…' : 'Issue code'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel eyebrow="Step 2" title="Run the installer on the Pi">
          <p style={{ color: '#6f796e', fontSize: 12, lineHeight: 1.6 }}>
            Copy the <span className="mono">adboxpitest</span> folder to the Raspberry Pi, then run the installer with
            the code. It installs mpv and Node, wires up the NEO GPS UART, registers the box and starts the agent.
          </p>
          <pre className="code">{`# On the Raspberry Pi 4B
scp -r adboxpitest pi@<pi-ip>:~/adbox-install
ssh pi@<pi-ip>
cd ~/adbox-install
sudo ./install.sh \\
  --server https://adbox.example.com \\
  --fallback-server http://192.168.1.50:8788 \\
  --code <PROVISIONING-CODE> \\
  --timezone Africa/Lagos

# Already installed? Just claim the identity:
sudo adbox-provision <PROVISIONING-CODE>

# No internet on site? Point at the LAN server explicitly:
sudo adbox-provision <PROVISIONING-CODE> --server http://192.168.1.50:8788`}</pre>
          <div className="notice" style={{ marginTop: 14 }}>
            Codes are single-use and expire. Once redeemed the box keeps its number permanently — reinstalling the agent
            does not require a new code.
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Ledger" title="Issued codes" description="Revoke anything that was not used.">
        {loading && <Loading label="Loading codes…" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data &&
          (data.tokens.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Intended box</th>
                    <th>State</th>
                    <th>Expires</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.tokens.map((token) => (
                    <tr key={token.id}>
                      <td className="mono">{token.state === 'available' ? token.code : '••••-••••-••••'}</td>
                      <td>
                        <strong>{token.name || 'Unnamed'}</strong>
                        <small>{token.serialNumber || 'box number generated on first contact'}</small>
                      </td>
                      <td>
                        <Badge state={token.state === 'available' ? 'pending' : token.state === 'used' ? 'ok' : 'bad'}>
                          {token.state}
                        </Badge>
                      </td>
                      <td title={formatDateTime(token.expiresAt)}>{formatRelative(token.expiresAt)}</td>
                      <td>{formatDateTime(token.createdAt)}</td>
                      <td>
                        {token.state === 'available' && (
                          <button className="btn tiny danger" onClick={() => revoke(token.id)}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="⌁" title="No codes issued yet">
              Issue one above to onboard your first Raspberry Pi.
            </Empty>
          ))}
      </Panel>

      {issued && (
        <Modal
          title="Provisioning code ready"
          description="Single use. Give this to whoever is installing the box — it is masked in the ledger afterwards."
          onClose={() => setIssued(null)}
        >
          <div className="copy-box">
            <code>{issued.code}</code>
            <button
              className="btn tiny"
              onClick={() => {
                navigator.clipboard?.writeText(issued.code);
                notify('Code copied.');
              }}
            >
              Copy
            </button>
          </div>
          <pre className="code">{`sudo ./install.sh --server <SERVER-URL> --code ${issued.code}`}</pre>
          <p style={{ color: '#6f796e', fontSize: 11 }}>
            Expires {formatDateTime(issued.expiresAt)}
            {issued.serialNumber ? ` · will register as ${issued.serialNumber}` : ''}
          </p>
          <div className="form-actions">
            <button className="btn primary" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {toastNode}
    </>
  );
}
