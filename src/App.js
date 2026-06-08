import { useState } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './amplify_outputs.json';
import './App.css';

Amplify.configure(outputs);

const client = generateClient();

function App() {
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
      await client.models.Participant.create(
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          birthDate: formData.birthDate,
          privateSmartphone: formData.privateSmartphone.trim(),
          screenTimePerDay: formData.screenTimePerDay,
        },
        {
          authMode: 'apiKey',
        }
      );

      setStatus('Data saved successfully.');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        birthDate: '',
        privateSmartphone: '',
        screenTimePerDay: '',
      });
    } catch (error) {
      setStatus('Saving failed.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="card">
        <h1>Participant information</h1>
        <p>Please enter your personal information before starting the study.</p>

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
              type="email"
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
    </main>
  );
}

export default App;