import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Hospedex page error', error, info);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6 text-ink dark:bg-slate-950 dark:text-white">
        <section className="w-full max-w-md rounded-md border border-red-200 bg-white p-6 text-center shadow-soft dark:border-red-400/30 dark:bg-slate-900">
          <AlertTriangle className="mx-auto text-red-600 dark:text-red-300" size={42} aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black">Não foi possível carregar esta página.</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-white/65">
            Atualize a página ou volte para a home do Hospedex.
          </p>
          <button
            type="button"
            className="btn-primary-theme mt-5 inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-bold"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Voltar para home
          </button>
        </section>
      </main>
    );
  }
}
