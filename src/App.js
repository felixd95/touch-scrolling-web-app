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
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    <div className="card">
      <h2>Teilnehmer</h2>
      <div style={{ marginBottom: 12 }}>
        <button className="nav-button" onClick={onBack}>Zurück</button>
      </div>
      {loading && <p>Lade...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
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
                          <button className="nav-button" onClick={() => { setSelectedParticipant({ ...p, attempts: attemptsArr }); setSelectedIndex(attemptsArr.length - 1); }} disabled={attemptsArr.length===0}>
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
                Select index:
                <select value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))} style={{ marginLeft: 8 }}>
                  {Array.from({ length: selectedParticipant.attempts.length }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </label>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, background: '#f7f7f7', padding: 8 }}>{JSON.stringify(selectedParticipant.attempts[selectedIndex], null, 2)}</pre>
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