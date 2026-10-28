import { useState, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import './App.css';

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function App() {
  const { packets, status, stats, clearPackets } = useWebSocket();
  const [filter, setFilter] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [paused, setPaused] = useState(false);

  const filteredPackets = useMemo(() => {
    let result = packets;

    if (protocolFilter !== 'ALL') {
      result = result.filter((p) => p.protocol === protocolFilter);
    }

    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(
        (p) =>
          p.src_ip?.toLowerCase().includes(q) ||
          p.dst_ip?.toLowerCase().includes(q) ||
          p.src_mac?.toLowerCase().includes(q) ||
          p.dst_mac?.toLowerCase().includes(q) ||
          String(p.src_port).includes(q) ||
          String(p.dst_port).includes(q)
      );
    }

    return result;
  }, [packets, filter, protocolFilter]);

  const displayPackets = paused ? [] : filteredPackets;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">🔍</div>
          <div className="header-title">
            <h1>NetWorld</h1>
            <span>Real-time Packet Analyzer</span>
          </div>
        </div>
        <div className="header-actions">
          <div className={`status-badge ${status}`}>
            <span className="status-dot" />
            {status}
          </div>
          <button
            className="btn"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume capture display' : 'Pause capture display'}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn btn-clear" onClick={clearPackets}>
            ✕ Clear
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon total">📊</div>
          <div className="stat-info">
            <span className="stat-label">Total</span>
            <span className="stat-value total-val">{stats.total.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon tcp">🔗</div>
          <div className="stat-info">
            <span className="stat-label">TCP</span>
            <span className="stat-value tcp-val">{stats.tcp.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon udp">📡</div>
          <div className="stat-info">
            <span className="stat-label">UDP</span>
            <span className="stat-value udp-val">{stats.udp.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon other">🔶</div>
          <div className="stat-info">
            <span className="stat-label">Other</span>
            <span className="stat-value other-val">{stats.other.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          className="filter-input"
          type="text"
          placeholder="Filter by IP, MAC, or port..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {['ALL', 'TCP', 'UDP', 'OTHER'].map((p) => (
          <button
            key={p}
            className={`filter-chip ${protocolFilter === p ? 'active' : ''}`}
            onClick={() => setProtocolFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Packet Table */}
      <div className="table-container">
        {displayPackets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>{paused ? 'Capture Paused' : 'Waiting for Packets'}</h3>
            <p>
              {paused
                ? 'Click Resume to see incoming packets.'
                : status === 'connected'
                ? 'Packets will appear here in real-time as they are captured by the sniffer.'
                : 'Connect to the WebSocket server to start receiving packets.'}
            </p>
          </div>
        ) : (
          <table className="packet-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Protocol</th>
                <th>Source IP</th>
                <th>Src Port</th>
                <th>Destination IP</th>
                <th>Dst Port</th>
                <th>Src MAC</th>
                <th>Dst MAC</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {displayPackets.map((pkt) => (
                <tr key={pkt.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{pkt.id}</td>
                  <td className="timestamp">{formatTime(pkt.timestamp)}</td>
                  <td>
                    <span className={`protocol-badge ${pkt.protocol}`}>{pkt.protocol}</span>
                  </td>
                  <td className="ip">{pkt.src_ip || '—'}</td>
                  <td className="port">{pkt.src_port || '—'}</td>
                  <td className="ip">{pkt.dst_ip || '—'}</td>
                  <td className="port">{pkt.dst_port || '—'}</td>
                  <td className="mac">{pkt.src_mac}</td>
                  <td className="mac">{pkt.dst_mac}</td>
                  <td className="packet-length">{pkt.length} B</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
