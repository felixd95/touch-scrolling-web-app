import { useState, useEffect, useCallback } from 'react';
import outputs from './backend_config.json';
import ScrollList from './ScrollList';
import { FLING_PHYSICS_BOUNDS } from './scrollPhysics/overScrollerPhysics';
import './App.css';

const RUNS_PER_BLOCK = 10;
const DEFAULT_DECELERATION_RATE = Math.log(0.78) / Math.log(0.9);

const getRandomParameterInRange = (min, max) => min + Math.random() * (max - min);

const createRandomParameterSet = (attemptCount = 0) => ({
  scrollFriction: Number(getRandomParameterInRange(
    FLING_PHYSICS_BOUNDS.scrollFriction.min,
    FLING_PHYSICS_BOUNDS.scrollFriction.max,
  ).toFixed(5)),
  decelerationRate: Number(getRandomParameterInRange(
    FLING_PHYSICS_BOUNDS.decelerationRate.min,
    FLING_PHYSICS_BOUNDS.decelerationRate.max,
  ).toFixed(3)),
  inflexion: Number(getRandomParameterInRange(
    FLING_PHYSICS_BOUNDS.inflexion.min,
    FLING_PHYSICS_BOUNDS.inflexion.max,
  ).toFixed(3)),
  blockSize: RUNS_PER_BLOCK,
  status: 'ready',
  source: 'random-initial-parameter-set',
  generatedFromAttemptCount: attemptCount,
  completedBlockCount: Math.floor(attemptCount / RUNS_PER_BLOCK),
});

const DEFAULT_NEXT_PARAMETER_SET = {
  scrollFriction: 0.015,
  decelerationRate: DEFAULT_DECELERATION_RATE,
  inflexion: 0.35,
  blockSize: RUNS_PER_BLOCK,
  flickDistanceThreshold: 6,
  status: 'ready',
  source: 'terraform-participant-create-default',
  generatedFromAttemptCount: 0,
};

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const normalizeParameterSet = (raw) => {
  if (!raw) return null;

  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const source = parsed.parameters && typeof parsed.parameters === 'object'
    ? parsed.parameters
    : parsed;

  let decelerationRate = Number(source.decelerationRate);
  if (!Number.isFinite(decelerationRate)) {
    const x1 = Number(source.x1 ?? source.a);
    const x2 = Number(source.x2 ?? source.b);
    if (Number.isFinite(x1) && Number.isFinite(x2) && x1 > 0 && x2 > 0 && x2 !== 1) {
      decelerationRate = Math.log(x1) / Math.log(x2);
    }
  }
  if (!(Number.isFinite(decelerationRate) && decelerationRate > 1)) {
    decelerationRate = DEFAULT_NEXT_PARAMETER_SET.decelerationRate;
  }

  return {
    ...parsed,
    scrollFriction: Number(source.scrollFriction ?? DEFAULT_NEXT_PARAMETER_SET.scrollFriction),
    inflexion: Number(source.inflexion ?? DEFAULT_NEXT_PARAMETER_SET.inflexion),
    decelerationRate,
    flickDistanceThreshold: Number(
      source.flickDistanceThreshold ?? DEFAULT_NEXT_PARAMETER_SET.flickDistanceThreshold
    ),
  };
};

const parseParameterBlockMetrics = (raw) => {
  if (!raw) return [];

  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return [];
    }
  }

  return Array.isArray(parsed) ? parsed : [];
};

function LoginForm({ onSuccess, onUserInteraction }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkEmail = async (e) => {
    e && e.preventDefault();
    onUserInteraction && onUserInteraction();
    setError('');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return setError('Bitte E-Mail eingeben');
    setLoading(true);
    try {
      const resp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
          query: `query ListParticipants { listParticipants { items { id email } } }`,
        }),
      });

      const json = await resp.json();
      const items = json.data?.listParticipants?.items || [];
      const matchingParticipant = items.find((item) => normalizeEmail(item?.email) === normalizedEmail);
      if (matchingParticipant) {
        onSuccess(matchingParticipant.id);
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
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [, setResults] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [deleteError, setDeleteError] = useState('');
  const [deletingRun, setDeletingRun] = useState(false);

  const formatMetric = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return Number(value).toFixed(digits);
  };

  const formatIntegerMetric = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return String(Math.trunc(Number(value)));
  };

  const formatBlockParameterSummary = (parameterSet) => {
    if (!parameterSet || typeof parameterSet !== 'object') return 'Keine Parameter gespeichert';

    return [
      `scrollFriction=${formatMetric(parameterSet.scrollFriction, 4)}`,
      `inflexion=${formatMetric(parameterSet.inflexion, 3)}`,
      `decelerationRate=${formatMetric(parameterSet.decelerationRate, 3)}`,
    ].join(', ');
  };

  const getBlockParameterItems = (parameterSet) => {
    if (!parameterSet || typeof parameterSet !== 'object') return [];

    return [
      { label: 'scrollFriction', value: formatMetric(parameterSet.scrollFriction, 4) },
      { label: 'inflexion', value: formatMetric(parameterSet.inflexion, 3) },
      { label: 'decelerationRate', value: formatMetric(parameterSet.decelerationRate, 3) },
    ];
  };

  const buildRunGroups = (attempts) => {
    if (!Array.isArray(attempts) || attempts.length === 0) return [];

    const hasBlockMetadata = attempts.some((attempt) => Number.isFinite(Number(attempt?.blockIndex)));
    if (hasBlockMetadata) {
      const grouped = new Map();
      for (const attempt of attempts) {
        const blockIndex = Number.isFinite(Number(attempt?.blockIndex))
          ? Math.trunc(Number(attempt.blockIndex))
          : 1;
        if (!grouped.has(blockIndex)) {
          grouped.set(blockIndex, []);
        }
        grouped.get(blockIndex).push(attempt);
      }

      return Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([blockIndex, blockAttempts]) => ({
          multiplier: Number(blockAttempts?.[0]?.multiplierUsed ?? 1),
          blockIndex,
          parameterSet:
            blockAttempts?.[0]?.blockParameterSet && typeof blockAttempts[0].blockParameterSet === 'object'
              ? blockAttempts[0].blockParameterSet
              : null,
          attempts: blockAttempts.sort((a, b) => {
            const ai = Number.isFinite(Number(a?.attemptInBlock)) ? Number(a.attemptInBlock) : 0;
            const bi = Number.isFinite(Number(b?.attemptInBlock)) ? Number(b.attemptInBlock) : 0;
            return ai - bi;
          }),
        }));
    }

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
      const hasRoom = current.attempts.length < RUNS_PER_BLOCK;

      if (sameMultiplier && hasRoom) {
        current.attempts.push(attempt);
      } else {
        groups.push({ multiplier, attempts: [attempt] });
      }
    }

    return groups;
  };

  const getMetricForRunGroup = (participant, group, fallbackIndex) => {
    const metrics = Array.isArray(participant?.parameterBlockMetrics)
      ? participant.parameterBlockMetrics
      : [];
    if (metrics.length === 0) return null;

    const blockIndex = Number.isFinite(Number(group?.blockIndex))
      ? Math.trunc(Number(group.blockIndex))
      : (fallbackIndex + 1);

    return metrics.find((metric) => {
      const metricBlock = Number(metric?.blockNumber);
      return Number.isFinite(metricBlock) && Math.trunc(metricBlock) === blockIndex;
    }) || null;
  };

  const parseAttemptsPayload = (rawAttempts) => {
    if (!rawAttempts) return { blocks: [], flat: [] };

    let parsed = rawAttempts;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (error) {
        return { blocks: [], flat: [] };
      }
    }

    if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
      parsed = Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => parsed[key]);
    }

    if (!Array.isArray(parsed)) return { blocks: [], flat: [] };

    const looksLikeBlocks = parsed.some((entry) =>
      entry && typeof entry === 'object' && Array.isArray(entry.attempts)
    );

    if (!looksLikeBlocks) {
      return { blocks: [], flat: parsed.filter((entry) => entry && typeof entry === 'object') };
    }

    const blocks = parsed
      .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.attempts))
      .map((entry, index) => ({
        runNumber: Number.isFinite(Number(entry.runNumber)) ? Math.trunc(Number(entry.runNumber)) : index + 1,
        parameterSet: entry.parameterSet && typeof entry.parameterSet === 'object' ? entry.parameterSet : null,
        attempts: entry.attempts.filter((attempt) => attempt && typeof attempt === 'object'),
      }));

    const flat = [];
    for (const block of blocks) {
      const runNumber = Number.isFinite(Number(block.runNumber)) ? Math.trunc(Number(block.runNumber)) : 1;
      (block.attempts || []).forEach((attempt, idx) => {
        flat.push({
          ...attempt,
          blockIndex: runNumber,
          attemptInBlock: Number.isFinite(Number(attempt?.attemptInBlock))
            ? Math.trunc(Number(attempt.attemptInBlock))
            : idx + 1,
          blockParameterSet:
            attempt?.blockParameterSet && typeof attempt.blockParameterSet === 'object'
              ? attempt.blockParameterSet
              : block.parameterSet,
        });
      });
    }

    return { blocks, flat };
  };

  const buildAttemptBlocksFromFlat = (attempts) => {
    if (!Array.isArray(attempts) || attempts.length === 0) return [];

    const sorted = [...attempts].sort((a, b) => {
      const blockA = Number.isFinite(Number(a?.blockIndex)) ? Number(a.blockIndex) : 0;
      const blockB = Number.isFinite(Number(b?.blockIndex)) ? Number(b.blockIndex) : 0;
      if (blockA !== blockB) return blockA - blockB;

      const attemptA = Number.isFinite(Number(a?.attemptInBlock)) ? Number(a.attemptInBlock) : 0;
      const attemptB = Number.isFinite(Number(b?.attemptInBlock)) ? Number(b.attemptInBlock) : 0;
      if (attemptA !== attemptB) return attemptA - attemptB;

      const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    const blocks = [];
    sorted.forEach((attempt, index) => {
      const runNumber = Number.isFinite(Number(attempt?.blockIndex))
        ? Math.trunc(Number(attempt.blockIndex))
        : Math.floor(index / RUNS_PER_BLOCK) + 1;
      const attemptInBlock = Number.isFinite(Number(attempt?.attemptInBlock))
        ? Math.trunc(Number(attempt.attemptInBlock))
        : (index % RUNS_PER_BLOCK) + 1;

      let block = blocks.find((entry) => entry.runNumber === runNumber);
      if (!block) {
        block = {
          runNumber,
          parameterSet:
            attempt?.blockParameterSet && typeof attempt.blockParameterSet === 'object'
              ? attempt.blockParameterSet
              : null,
          attempts: [],
        };
        blocks.push(block);
      }

      if (!block.parameterSet && attempt?.blockParameterSet && typeof attempt.blockParameterSet === 'object') {
        block.parameterSet = attempt.blockParameterSet;
      }

      block.attempts.push({
        attemptInBlock,
        targetNumber: Number.isFinite(Number(attempt?.targetNumber)) ? Math.trunc(Number(attempt.targetNumber)) : null,
        timeMs: Number.isFinite(Number(attempt?.timeMs)) ? Number(attempt.timeMs) : attempt?.timeMs,
        scrollDistance: Number.isFinite(Number(attempt?.scrollDistance)) ? Number(attempt.scrollDistance) : attempt?.scrollDistance,
        timestamp: attempt?.timestamp,
      });
    });

    return blocks.sort((a, b) => a.runNumber - b.runNumber);
  };

  const updateLocalParticipantAttempts = (participantId, attempts) => {
    try {
      const localMap = JSON.parse(localStorage.getItem('participantResults') || '{}');
      localMap[participantId] = attempts;
      localStorage.setItem('participantResults', JSON.stringify(localMap));
    } catch (e) {
      // ignore local cache write errors
    }
  };

  const updateParticipantAttemptsInBackend = async (participantId, attempts) => {
    const serializedAttempts = JSON.stringify(buildAttemptBlocksFromFlat(attempts));

    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': outputs.data.api_key,
      },
      body: JSON.stringify({
        query: `mutation UpdateParticipant($input: UpdateParticipantInput!) { updateParticipant(input: $input) { id attempts } }`,
        variables: { input: { id: participantId, attempts: serializedAttempts } },
      }),
    });

    const json = await resp.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || 'Backend update failed');
    }

    return json.data?.updateParticipant;
  };

  const fetchParticipantsFromBackend = useCallback(async () => {
    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': outputs.data.api_key,
      },
      body: JSON.stringify({
        query: `query ListParticipants { listParticipants { items { id firstName lastName email birthDate privateSmartphone screenTimePerDay attempts currentParameterSet nextParameterSet parameterBlockMetrics } } }`,
      }),
    });

    const json = await resp.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || 'Fehler beim Laden der Teilnehmerdaten');
    }

    return (json.data?.listParticipants?.items || []).map((participant) => ({
      ...participant,
      currentParameterSet: normalizeParameterSet(participant.currentParameterSet),
      nextParameterSet: normalizeParameterSet(participant.nextParameterSet),
      parameterBlockMetrics: parseParameterBlockMetrics(participant.parameterBlockMetrics),
    }));
  }, []);

  const handleDeleteSelectedRun = async () => {
    if (!selectedParticipant) return;

    const runGroups = selectedParticipant.runGroups || [];
    const selectedGroup = runGroups[selectedRunIndex];
    if (!selectedGroup) return;

    const shouldDelete = window.confirm(
      `Durchlauf ${selectedGroup.blockIndex ?? (selectedRunIndex + 1)} mit ${selectedGroup.attempts.length} Versuch(en) wirklich loeschen?`
    );
    if (!shouldDelete) return;

    setDeleteError('');
    setDeletingRun(true);

    try {
      const currentAttempts = selectedParticipant.attempts || [];
      const removeIndices = new Set();

      for (const runAttempt of selectedGroup.attempts) {
        const matchIndex = currentAttempts.findIndex(
          (candidate, idx) => !removeIndices.has(idx) && candidate === runAttempt
        );

        if (matchIndex >= 0) {
          removeIndices.add(matchIndex);
        }
      }

      const nextAttempts = currentAttempts.filter((_, idx) => !removeIndices.has(idx));

      await updateParticipantAttemptsInBackend(selectedParticipant.id, nextAttempts);
      updateLocalParticipantAttempts(selectedParticipant.id, nextAttempts);

      const nextRunGroups = buildRunGroups(nextAttempts);

      setItems((prev) =>
        prev.map((p) =>
          p.id === selectedParticipant.id
            ? { ...p, attempts: JSON.stringify(buildAttemptBlocksFromFlat(nextAttempts)) }
            : p
        )
      );

      setResults((prev) => {
        const withoutParticipant = prev.filter((a) => a?.participantId !== selectedParticipant.id);
        return [...withoutParticipant, ...nextAttempts];
      });

      setSelectedParticipant((prev) =>
        prev
          ? { ...prev, attempts: nextAttempts, runGroups: nextRunGroups }
          : prev
      );

      setSelectedRunIndex((prev) => {
        if (nextRunGroups.length === 0) return 0;
        return Math.min(prev, nextRunGroups.length - 1);
      });
    } catch (err) {
      console.error(err);
      setDeleteError('Durchlauf konnte nicht geloescht werden.');
    } finally {
      setDeletingRun(false);
    }
  };

  const handleDownloadAllData = async () => {
    setDownloading(true);
    setError('');
    try {
      const freshItems = await fetchParticipantsFromBackend();
      setItems(freshItems);

      const dataToExport = freshItems.map((p) => {
        const parsedAttempts = parseAttemptsPayload(p.attempts);
        return {
          participantId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          birthDate: p.birthDate,
          privateSmartphone: p.privateSmartphone,
          screenTimePerDay: p.screenTimePerDay,
          currentParameterSet: normalizeParameterSet(p.currentParameterSet),
          nextParameterSet: normalizeParameterSet(p.nextParameterSet),
          parameterBlockMetrics: parseParameterBlockMetrics(p.parameterBlockMetrics),
          attemptBlocks: parsedAttempts.blocks,
          attempts: parsedAttempts.flat,
        };
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `touch-scrolling-data-${timestamp}.json`;
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Download der Daten');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchList = async () => {
      setLoading(true);
      setError('');
      try {
        const itemsWithAttempts = await fetchParticipantsFromBackend();
        if (!mounted) return;
        setItems(itemsWithAttempts);
        // collect all attempts from participants (remote attempts stored in participant.attempts)
        const allAttempts = [];
        for (const p of itemsWithAttempts) {
          if (p.attempts) {
            const parsedAttempts = parseAttemptsPayload(p.attempts);
            for (const a of parsedAttempts.flat) allAttempts.push(a);
          }
        }
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
  }, [fetchParticipantsFromBackend]);

  return (
    <div className="card" style={{ maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto' }}>
      <h2>Teilnehmer</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="nav-button" onClick={onBack}>Zurück</button>
        <button
          className="nav-button"
          onClick={handleDownloadAllData}
          disabled={loading || downloading || items.length === 0}
          style={{ background: '#0066cc' }}
        >
          {downloading ? 'Download laeuft...' : 'Download Daten (JSON)'}
        </button>
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
                    const parsedAttempts = parseAttemptsPayload(p.attempts);
                    const attemptsArr = parsedAttempts.flat;
                    const hasStoredAttempts = parsedAttempts.blocks.length > 0 || attemptsArr.length > 0;
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
                              setSelectedParticipant({
                                ...p,
                                attempts: attemptsArr,
                                attemptBlocks: parsedAttempts.blocks,
                                runGroups,
                              });
                              setSelectedRunIndex(Math.max(0, runGroups.length - 1));
                            }}
                            disabled={!hasStoredAttempts}
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
              {selectedParticipant.currentParameterSet && (
                <div style={{ marginBottom: 6, fontSize: 13, color: '#4c5967' }}>
                  Aktueller Parametersatz: mu={formatMetric(selectedParticipant.currentParameterSet.scrollFriction, 4)}, beta={formatMetric(selectedParticipant.currentParameterSet.inflexion, 3)}, r={formatMetric(selectedParticipant.currentParameterSet.decelerationRate, 3)}
                </div>
              )}
              {selectedParticipant.nextParameterSet && (
                <div style={{ marginBottom: 10, fontSize: 13, color: '#4c5967' }}>
                  Naechster Parametersatz: mu={formatMetric(selectedParticipant.nextParameterSet.scrollFriction, 4)}, beta={formatMetric(selectedParticipant.nextParameterSet.inflexion, 3)}, r={formatMetric(selectedParticipant.nextParameterSet.decelerationRate, 3)}
                </div>
              )}
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {(selectedParticipant.runGroups || []).length === 0 ? (
                  <p>Keine Durchläufe vorhanden.</p>
                ) : (
                  (selectedParticipant.runGroups || []).map((group, i) => {
                    const isOpen = i === selectedRunIndex;
                    const attempts = group.attempts || [];
                    const parameterItems = getBlockParameterItems(group.parameterSet);
                    const linkedMetric = getMetricForRunGroup(selectedParticipant, group, i);

                    return (
                      <div
                        key={`run-group-${group.blockIndex ?? i}`}
                        style={{
                          border: isOpen ? '1px solid #8aa4c0' : '1px solid #ddd',
                          borderRadius: 10,
                          overflow: 'hidden',
                          background: isOpen ? '#f7fbff' : '#fff',
                          boxShadow: isOpen ? '0 4px 14px rgba(71, 98, 130, 0.10)' : 'none',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRunIndex(i)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            padding: 14,
                            cursor: 'pointer',
                            display: 'grid',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <strong style={{ fontSize: 16 }}>Block {group.blockIndex ?? (i + 1)}</strong>
                              <span style={{ fontSize: 12, color: '#66788a' }}>
                                {attempts.length} Versuche
                              </span>
                            </div>
                            <span style={{ fontSize: 18, color: '#476282', lineHeight: 1 }}>
                              {isOpen ? '▾' : '▸'}
                            </span>
                          </div>
                          <span style={{ fontSize: 13, color: '#4c5967', lineHeight: 1.5 }}>
                            {formatBlockParameterSummary(group.parameterSet)}
                          </span>
                          {linkedMetric && (
                            <div style={{ fontSize: 12, color: '#35506b', lineHeight: 1.5 }}>
                              {Number.isFinite(Number(linkedMetric.sagemakerLatencyMs)) && (
                                <span>Generierung: {formatMetric(linkedMetric.sagemakerLatencyMs)} ms · </span>
                              )}
                              {Number.isFinite(Number(linkedMetric.pooledAttemptCount)) && (
                                <span>Datenbasis: {formatIntegerMetric(linkedMetric.pooledAttemptCount)} Versuche / {formatIntegerMetric(linkedMetric.pooledParticipantCount)} Teilnehmer · </span>
                              )}
                              {linkedMetric.model && Number.isFinite(Number(linkedMetric.model.acquisitionValue)) && (
                                <span>Acq: {formatMetric(linkedMetric.model.acquisitionValue, 5)}</span>
                              )}
                            </div>
                          )}
                          {parameterItems.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {parameterItems.map((item) => (
                                <span
                                  key={`${group.blockIndex ?? i}-${item.label}`}
                                  style={{
                                    fontSize: 12,
                                    color: '#35506b',
                                    background: '#eaf3fb',
                                    border: '1px solid #d1e3f2',
                                    borderRadius: 999,
                                    padding: '4px 8px',
                                  }}
                                >
                                  {item.label}: {item.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>

                        {isOpen && (
                          <div style={{ padding: '0 12px 12px' }}>
                            {linkedMetric && (
                              <div
                                style={{
                                  marginBottom: 10,
                                  padding: 10,
                                  border: '1px solid #d1e3f2',
                                  borderRadius: 8,
                                  background: '#f4f9ff',
                                  fontSize: 12,
                                  color: '#4c5967',
                                  lineHeight: 1.6,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: '#35506b' }}>
                                  ML-Metriken zu diesem Block
                                  {linkedMetric.generatedAt ? ` · ${new Date(linkedMetric.generatedAt).toLocaleString()}` : ''}
                                </div>
                                {linkedMetric.completionTimeMs && (
                                  <div>
                                    Zeit: ⌀{formatMetric(linkedMetric.completionTimeMs.mean)} ms (Median {formatMetric(linkedMetric.completionTimeMs.median)} ms, σ {formatMetric(linkedMetric.completionTimeMs.std)})
                                  </div>
                                )}
                                {linkedMetric.overshoots && (
                                  <div>Overshoots: ⌀{formatMetric(linkedMetric.overshoots.mean)} (max {formatMetric(linkedMetric.overshoots.max)})</div>
                                )}
                                {linkedMetric.maxOvershootDistancePx && (
                                  <div>max. Overshoot-Distanz: {formatMetric(linkedMetric.maxOvershootDistancePx.max)} px</div>
                                )}
                                {Number.isFinite(Number(linkedMetric.sagemakerLatencyMs)) && (
                                  <div>Generierung: {formatMetric(linkedMetric.sagemakerLatencyMs)} ms</div>
                                )}
                                {Number.isFinite(Number(linkedMetric.pooledAttemptCount)) && (
                                  <div>Datenbasis: {formatIntegerMetric(linkedMetric.pooledAttemptCount)} Versuche / {formatIntegerMetric(linkedMetric.pooledParticipantCount)} Teilnehmer</div>
                                )}
                                {linkedMetric.model && (
                                  <div>
                                    {Number.isFinite(Number(linkedMetric.model.acquisitionValue)) && (
                                      <span>Acq: {formatMetric(linkedMetric.model.acquisitionValue, 5)} · </span>
                                    )}
                                    {Number.isFinite(Number(linkedMetric.model.candidateRankApprox)) && Number.isFinite(Number(linkedMetric.model.candidateRankProbeCount)) && (
                                      <span>Candidate-Rank: {formatIntegerMetric(linkedMetric.model.candidateRankApprox)}/{formatIntegerMetric(linkedMetric.model.candidateRankProbeCount)} · </span>
                                    )}
                                    {Array.isArray(linkedMetric.model.refPoint) && linkedMetric.model.refPoint.length > 0 && (
                                      <span>ref_point: [{linkedMetric.model.refPoint.map((value) => formatMetric(value, 2)).join(', ')}] · </span>
                                    )}
                                    {linkedMetric.model.strategy && (
                                      <span>Strategie: {linkedMetric.model.strategy} · </span>
                                    )}
                                    {linkedMetric.model.version && (
                                      <span>Version: {linkedMetric.model.version} · </span>
                                    )}
                                    {Number.isFinite(Number(linkedMetric.model.trainingRowCount)) && (
                                      <span>Trainingszeilen: {formatIntegerMetric(linkedMetric.model.trainingRowCount)} · </span>
                                    )}
                                    {Number.isFinite(Number(linkedMetric.model.objectiveCount)) && (
                                      <span>Objectives: {formatIntegerMetric(linkedMetric.model.objectiveCount)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                              <button
                                className="nav-button"
                                onClick={handleDeleteSelectedRun}
                                disabled={deletingRun}
                                style={{ background: '#c62828' }}
                              >
                                {deletingRun ? 'Loesche...' : 'Diesen Durchlauf loeschen'}
                              </button>
                            </div>
                            {parameterItems.length > 0 && (
                              <div
                                style={{
                                  marginBottom: 10,
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                  gap: 8,
                                }}
                              >
                                {parameterItems.map((item) => (
                                  <div
                                    key={`detail-${group.blockIndex ?? i}-${item.label}`}
                                    style={{
                                      background: '#fff',
                                      border: '1px solid #dfe7ee',
                                      borderRadius: 8,
                                      padding: '8px 10px',
                                    }}
                                  >
                                    <div style={{ fontSize: 11, color: '#66788a', marginBottom: 3 }}>{item.label}</div>
                                    <div style={{ fontSize: 14, color: '#1f2f3d', fontWeight: 600 }}>{item.value}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ maxHeight: '40vh', overflow: 'auto' }}>
                              {attempts.length === 0 ? (
                                <p>Keine Ergebnisse für den ausgewählten Durchlauf.</p>
                              ) : (
                                <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #dfe7ee', borderRadius: 8 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left', padding: 8, background: '#eef4f8' }}>Versuch</th>
                                      <th style={{ textAlign: 'left', padding: 8, background: '#eef4f8' }}>Target</th>
                                      <th style={{ textAlign: 'left', padding: 8, background: '#eef4f8' }}>Zeit (ms)</th>
                                      <th style={{ textAlign: 'left', padding: 8, background: '#eef4f8' }}>Scroll-Distanz</th>
                                      <th style={{ textAlign: 'left', padding: 8, background: '#eef4f8' }}>Timestamp</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {attempts.map((attempt, idx) => (
                                      <tr key={`${attempt?.timestamp || 'na'}-${idx}`} style={{ borderTop: '1px solid #e5e5e5' }}>
                                        <td style={{ padding: 8 }}>{attempt?.attemptInBlock ?? (idx + 1)}</td>
                                        <td style={{ padding: 8 }}>{attempt?.targetNumber ?? '-'}</td>
                                        <td style={{ padding: 8 }}>{attempt?.timeMs ?? '-'}</td>
                                        <td style={{ padding: 8 }}>{attempt?.scrollDistance ?? '-'}</td>
                                        <td style={{ padding: 8 }}>{attempt?.timestamp ?? '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                            <div style={{ marginTop: 8, color: '#666' }}>
                              Anzahl Ergebnisse im Durchlauf: {attempts.length}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {deleteError && <p style={{ color: '#c62828', marginTop: 8 }}>{deleteError}</p>}
              <div style={{ marginTop: 8 }}>
                <button className="nav-button" onClick={() => setSelectedParticipant(null)}>Close</button>
              </div>
            </div>
          )}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'form', 'scrolllist', 'test'
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
      const normalizedEmail = normalizeEmail(formData.email);

      if (!normalizedEmail) {
        setStatus('Bitte eine E-Mail eingeben.');
        setLoading(false);
        return;
      }

      // check if email already exists
      const resp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
          query: `query ListParticipants { listParticipants { items { id email } } }`,
        }),
      });

      const json = await resp.json();
      const items = json.data?.listParticipants?.items || [];
      const emailAlreadyExists = items.some((item) => normalizeEmail(item?.email) === normalizedEmail);
      if (emailAlreadyExists) {
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
              email: normalizedEmail,
              birthDate: formData.birthDate,
              privateSmartphone: formData.privateSmartphone.trim(),
              screenTimePerDay: formData.screenTimePerDay,
              attempts: JSON.stringify([]),
              currentParameterSet: JSON.stringify(createRandomParameterSet(0)),
              nextParameterSet: null,
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
        if (newId) {
          setParticipantId(newId);
        }
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
            <button className="nav-button" onClick={() => setCurrentPage('test')} style={{ background: '#455a64' }}>
              Zur Testumgebung
            </button>
          </div>
        </div>
      ) : currentPage === 'login' ? (
        <div className="card">
          <h2>Login</h2>
          <LoginForm
            onSuccess={(id) => {
              setParticipantId(id);
              setCurrentPage('scrolllist');
            }}
          />
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
      ) : currentPage === 'list' ? (
        <ParticipantsList onBack={() => setCurrentPage('landing')} />
      ) : currentPage === 'test' ? (
        <ScrollList mode="test" onExitTestEnvironment={() => setCurrentPage('landing')} />
      ) : (
        <ScrollList participantId={participantId} />
      )}
    </main>
  );
}

export default App;