import { useState, useEffect } from 'react';
import { X, Mail, CheckCircle2, Loader2, AlertCircle, Unplug } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GmailStatus {
  connected: boolean;
  email?: string;
  connected_at?: string;
}

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IntegrationsModal({ isOpen, onClose }: IntegrationsModalProps) {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGmailStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/gmail/status');
      const data = await res.json();
      setGmailStatus(data);
    } catch {
      console.error('Failed to fetch Gmail status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGmailStatus();
      setError(null);
    }
  }, [isOpen]);

  // Check for OAuth callback result in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get('gmail');
    if (gmailResult === 'connected') {
      fetchGmailStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (gmailResult === 'error') {
      setError('Failed to connect Gmail. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnectGmail = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/gmail');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setConnecting(false);
        return;
      }
      if (data.url) {
        // Open Google consent screen in a new tab
        window.open(data.url, '_blank');
      }
    } catch {
      setError('Failed to start Gmail connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/auth/gmail', { method: 'DELETE' });
      setGmailStatus({ connected: false });
    } catch {
      setError('Failed to disconnect Gmail');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="integrations-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="integrations-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="integrations-header">
              <h2 className="integrations-title">Integrations</h2>
              <button className="integrations-close" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="integrations-content">
              <p className="integrations-subtitle">
                Connect external services to expand AgentX's capabilities.
              </p>

              {/* Error banner */}
              {error && (
                <motion.div
                  className="integration-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Gmail Integration Card */}
              <div className={`integration-card ${gmailStatus.connected ? 'connected' : ''}`}>
                <div className="integration-card-header">
                  <div className="integration-icon gmail-icon">
                    <Mail size={22} />
                  </div>
                  <div className="integration-info">
                    <h3 className="integration-name">Gmail</h3>
                    <p className="integration-desc">
                      Read, search, and send emails through your Gmail account.
                    </p>
                  </div>
                  <div className="integration-status-badge">
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : gmailStatus.connected ? (
                      <span className="badge badge-connected">
                        <CheckCircle2 size={14} /> Connected
                      </span>
                    ) : (
                      <span className="badge badge-disconnected">Not Connected</span>
                    )}
                  </div>
                </div>

                {/* Connected details or connect button */}
                <div className="integration-card-body">
                  {gmailStatus.connected ? (
                    <div className="integration-connected-details">
                      <div className="connected-info-row">
                        <span className="connected-label">Account</span>
                        <span className="connected-value">{gmailStatus.email}</span>
                      </div>
                      <div className="connected-info-row">
                        <span className="connected-label">Connected</span>
                        <span className="connected-value">{formatDate(gmailStatus.connected_at)}</span>
                      </div>
                      <button
                        className="disconnect-btn"
                        onClick={handleDisconnectGmail}
                        disabled={disconnecting}
                      >
                        {disconnecting ? (
                          <><Loader2 size={14} className="animate-spin" /> Disconnecting...</>
                        ) : (
                          <><Unplug size={14} /> Disconnect</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="integration-connect-area">
                      <p className="connect-help-text">
                        Click below to sign in with Google and authorize AgentX to access your Gmail.
                        Your credentials are stored locally in the <code>secrets/</code> directory.
                      </p>
                      <button
                        className="connect-btn gmail-connect-btn"
                        onClick={handleConnectGmail}
                        disabled={connecting}
                      >
                        {connecting ? (
                          <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                        ) : (
                          <><Mail size={16} /> Connect Gmail</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Placeholder for future integrations */}
              <div className="integration-card coming-soon">
                <div className="integration-card-header">
                  <div className="integration-icon drive-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 19.5h20L12 2z" />
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h3 className="integration-name">Google Drive</h3>
                    <p className="integration-desc">Access and manage files from Google Drive.</p>
                  </div>
                  <div className="integration-status-badge">
                    <span className="badge badge-coming-soon">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
