import { render, screen } from '@testing-library/react';
import App from './App';

test('renders landing page actions', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /willkommen/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ich habe mich bereits registriert/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ich möchte mich registrieren/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /teilnehmer anzeigen/i })).toBeInTheDocument();
});
