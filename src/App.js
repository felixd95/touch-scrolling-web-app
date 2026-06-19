import { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './amplify_outputs.json';
import ScrollList from './ScrollList';
import './App.css';

Amplify.configure(outputs);

const client = generateClient();

function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkEmail = async (e) => {
    e && e.preventDefault();
    setError('');
    if (!email) return setError('Bitte E-Mail eingeben');
    setLoading(true);
    try {
      const resp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
          query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id email } } }`,
          variables: { filter: { email: { eq: email } } },
        }),
      });

      const json = await resp.json();
      const items = json.data?.listParticipants?.items || [];
      if (items.length > 0) {
        onSuccess(items[0].id);
      } else {
        setError('E-Mail nicht gefunden');
      }
    } catch (err) {
      console.error(err);
      setError('Fehler beim Prüfen der E-Mail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={checkEmail} className="form">
      <label>
        E-Mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <button type="submit" disabled={loading}>{loading ? 'Prüfe...' : 'Weiter'}</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}

function ParticipantsList({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);

  const formatMetric = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return Number(value).toFixed(digits);
  };

  const buildRunGroups = (attempts) => {
    if (!Array.isArray(attempts) || attempts.length === 0) return [];

    const sorted = [...attempts].sort((a, b) => {
      const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    const groups = [];
    for (const attempt of sorted) {
      const multiplier = Number(attempt?.multiplierUsed ?? 1);
      const current = groups[groups.length - 1];

      if (!current) {
        groups.push({ multiplier, attempts: [attempt] });
        continue;
      }

      const sameMultiplier = Number(current.multiplier) === multiplier;
      const hasRoom = current.attempts.length < 10;

      if (sameMultiplier && hasRoom) {
        current.attempts.push(attempt);
      } else {
        groups.push({ multiplier, attempts: [attempt] });
      }
    }

    return groups;
  };

  useEffect(() => {
    let mounted = true;
    const fetchList = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(outputs.data.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': outputs.data.api_key,
          },
          body: JSON.stringify({
            query: `query ListParticipants { listParticipants { items { id firstName lastName email birthDate privateSmartphone screenTimePerDay attempts } } }`,
          }),
        });
        const json = await resp.json();
        if (!mounted) return;
        const itemsWithAttempts = json.data?.listParticipants?.items || [];
        setItems(itemsWithAttempts);
        // collect all attempts from participants (remote attempts stored in participant.attempts or localStorage fallback)
        const allAttempts = [];
        for (const p of itemsWithAttempts) {
          if (p.attempts) {
            try {
              const arr = JSON.parse(p.attempts || '[]');
              for (const a of arr) allAttempts.push(a);
            } catch (e) {
              // ignore parse errors
            }
          }
        }
        // merge with local fallback (participantResults)
        try {
          const localMap = JSON.parse(localStorage.getItem('participantResults') || '{}');
          for (const pid of Object.keys(localMap)) {
            const arr = localMap[pid] || [];
            for (const a of arr) allAttempts.push(a);
          }
        } catch (e) {}
        setResults(allAttempts);
      } catch (err) {
        console.error(err);
        if (mounted) setError('Fehler beim Laden der Einträge');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchList();
    return () => { mounted = false };
  }, []);

  return (
    <div className="card" style={{ maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto' }}>
      <h2>Teilnehmer</h2>
      <div style={{ marginBottom: 12 }}>
        <button className="nav-button" onClick={onBack}>Zurück</button>
      </div>
      {loading && <p>Lade...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <div style={{ maxHeight: '40vh', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>ID</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Name</th>
                <th style={{ textAlign: 'left', padding: 6 }}>E-Mail</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Geburtstag</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Device</th>
                <th style={{ textAlign: 'left', padding: 6 }}>ScreenTime</th>
              </tr>
            </thead>
            <tbody>
                  {items.map((p) => {
                    // parse attempts array for this participant
                    let attemptsArr = [];
                    if (p.attempts) {
                      try { attemptsArr = JSON.parse(p.attempts); } catch (e) { attemptsArr = []; }
                    }
                    // also include local fallback for this participant
                    try {
                      const localMap = JSON.parse(localStorage.getItem('participantResults') || '{}');
                      if (localMap[p.id]) attemptsArr = (attemptsArr || []).concat(localMap[p.id]);
                    } catch (e) {}

                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                        <td style={{ padding: 6 }}>{p.id}</td>
                        <td style={{ padding: 6 }}>{(p.firstName || '') + ' ' + (p.lastName || '')}</td>
                        <td style={{ padding: 6 }}>{p.email}</td>
                        <td style={{ padding: 6 }}>{p.birthDate}</td>
                        <td style={{ padding: 6 }}>{p.privateSmartphone}</td>
                        <td style={{ padding: 6 }}>{p.screenTimePerDay}</td>
                        <td style={{ padding: 6 }}>
                          <button
                            className="nav-button"
                            onClick={() => {
                              const runGroups = buildRunGroups(attemptsArr);
                              setSelectedParticipant({ ...p, attempts: attemptsArr, runGroups });
                              setSelectedRunIndex(Math.max(0, runGroups.length - 1));
                            }}
                            disabled={attemptsArr.length===0}
                          >
                            View Attempts
                          </button>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}
          {selectedParticipant && (
            <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
              <h3>Attempts for {selectedParticipant.firstName} {selectedParticipant.lastName} (ID: {selectedParticipant.id})</h3>
              <label>
                Durchlauf wählen:
                <select
                  value={selectedRunIndex}
                  onChange={(e) => setSelectedRunIndex(Number(e.target.value))}
                  style={{ marginLeft: 8 }}
                >
                  {(selectedParticipant.runGroups || []).map((group, i) => (
                    <option key={i} value={i}>
                      Durchlauf {i + 1} (Multiplier: {group.multiplier})
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ marginTop: 12, maxHeight: '40vh', overflow: 'auto' }}>
                {(selectedParticipant.runGroups?.[selectedRunIndex]?.attempts || []).length === 0 ? (
                  <p>Keine Ergebnisse für den ausgewählten Durchlauf.</p>
                ) : (
                  <table style={{ minWidth: 1400, width: '100%', borderCollapse: 'collapse', background: '#f7f7f7' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 6 }}>#</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Target</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Zeit (ms)</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Scroll-Distanz</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Multiplier</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Flicks</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Switchbacks</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Overshoot</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Overshoot Count</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Max Overshoot (px)</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Startdistanz (px)</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Startdistanz (Items)</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Flick-Details</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedParticipant.runGroups?.[selectedRunIndex]?.attempts || []).map((attempt, idx) => (
                        <tr key={`${attempt?.timestamp || 'na'}-${idx}`} style={{ borderTop: '1px solid #e5e5e5' }}>
                          <td style={{ padding: 6 }}>{idx + 1}</td>
                          <td style={{ padding: 6 }}>{attempt?.targetNumber ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.timeMs ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.scrollDistance ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.multiplierUsed ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.flickCount ?? attempt?.clutchCount ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.switchbackCount ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.overshoot?.didOvershoot ? 'Ja' : 'Nein'}</td>
                          <td style={{ padding: 6 }}>{attempt?.overshoot?.count ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.overshoot?.maxDistancePx ?? '-'}</td>
                          <td style={{ padding: 6 }}>{attempt?.startDistancePx ?? '-'}</td>
                          <td style={{ padding: 6 }}>{formatMetric(attempt?.startDistanceItems)}</td>
                          <td style={{ padding: 6 }}>
                            {Array.isArray(attempt?.flicks) && attempt.flicks.length > 0 ? (
                              <details>
                                <summary>{attempt.flicks.length} Flicks anzeigen</summary>
                                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                                  {attempt.flicks.map((flick, flickIdx) => (
                                    <div key={flickIdx} style={{ fontSize: 12, lineHeight: 1.4, background: '#fff', padding: 6, borderRadius: 4, border: '1px solid #e2e2e2' }}>
                                      <strong>Flick {flickIdx + 1}:</strong>{' '}
                                      dir={flick?.direction ?? '-'}, dist(px)={formatMetric(flick?.distancePx, 1)}, dist(items)={formatMetric(flick?.distanceItems, 2)},
                                      dur(ms)={formatMetric(flick?.durationMs, 1)}, avg(px/ms)={formatMetric(flick?.avgSpeedPxMs, 3)}, max(px/ms)={formatMetric(flick?.maxSpeedPxMs, 3)}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td style={{ padding: 6 }}>{attempt?.timestamp ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>
                Anzahl Ergebnisse im Durchlauf: {(selectedParticipant.runGroups?.[selectedRunIndex]?.attempts || []).length}
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="nav-button" onClick={() => setSelectedParticipant(null)}>Close</button>
              </div>
            </div>
          )}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'form' oder 'scrolllist'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    birthDate: '',
    privateSmartphone: '',
    screenTimePerDay: '',
  });

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [participantId, setParticipantId] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      // check if email already exists
      const resp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
          query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id email } } }`,
          variables: { filter: { email: { eq: formData.email.trim() } } },
        }),
      });

      const json = await resp.json();
      const items = json.data?.listParticipants?.items || [];
      if (items.length > 0) {
        setStatus('E-Mail ist bereits vergeben. Bitte andere E-Mail verwenden.');
        setLoading(false);
        return;
      }

      // create participant
      const createResp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
          query: `mutation CreateParticipant($input: CreateParticipantInput!) { createParticipant(input: $input) { id email } }`,
          variables: {
            input: {
              firstName: formData.firstName.trim(),
              lastName: formData.lastName.trim(),
              email: formData.email.trim(),
              birthDate: formData.birthDate,
              privateSmartphone: formData.privateSmartphone.trim(),
              screenTimePerDay: formData.screenTimePerDay,
            },
          },
        }),
      });

      const createJson = await createResp.json();
      if (createJson.errors) {
        console.error(createJson.errors);
        setStatus('Fehler beim Anlegen des Benutzers.');
      } else {
        setStatus('Registrierung erfolgreich. Weiterleitung...');
        // clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          birthDate: '',
          privateSmartphone: '',
          screenTimePerDay: '',
        });
        const newId = createJson.data?.createParticipant?.id;
        if (newId) setParticipantId(newId);
        setCurrentPage('scrolllist');
      }
    } catch (error) {
      setStatus('Saving failed.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      {currentPage === 'landing' ? (
        <div className="card">
          <h1>Willkommen</h1>
          <div style={{ display: 'grid', gap: 12 }}>
            <button className="nav-button" onClick={() => setCurrentPage('login')}>
              Ich habe mich bereits registriert
            </button>
            <button className="nav-button" onClick={() => setCurrentPage('form')}>
              Ich möchte mich registrieren
            </button>
            <button className="nav-button" onClick={() => setCurrentPage('list')}>
              Teilnehmer anzeigen
            </button>
          </div>
        </div>
      ) : currentPage === 'login' ? (
        <div className="card">
          <h2>Login</h2>
          <LoginForm onSuccess={(id) => { setParticipantId(id); setCurrentPage('scrolllist'); }} />
          <div style={{ marginTop: 12 }}>
            <button className="nav-button" onClick={() => setCurrentPage('landing')}>Zurück</button>
          </div>
        </div>
      ) : currentPage === 'form' ? (
        <div className="card">
          <form onSubmit={handleSubmit} className="form">
            <label>
              First name
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Last name
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Email
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Date of birth
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Private smartphone
              <input
                type="text"
                name="privateSmartphone"
                value={formData.privateSmartphone}
                onChange={handleChange}
                placeholder="e.g. iPhone 14, Galaxy S23"
                required
              />
            </label>

            <label>
              Screen time per day
              <select
                name="screenTimePerDay"
                value={formData.screenTimePerDay}
                onChange={handleChange}
                required
              >
                <option value="">Please select</option>
                <option value="<1h">Less than 1 hour</option>
                <option value="1-2h">1–2 hours</option>
                <option value="2-4h">2–4 hours</option>
                <option value="4-6h">4–6 hours</option>
                <option value=">6h">More than 6 hours</option>
              </select>
            </label>

              <button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Start study'}
              </button>

              {status && <p>{status}</p>}
            </form>
        </div>
      ) : (
        currentPage === 'list' ? (
          <ParticipantsList onBack={() => setCurrentPage('landing')} />
          ) : (
          <ScrollList participantId={participantId} />
        )
      )}
    </main>
  );
}

export default App;