import { createFileRoute } from '@tanstack/react-router';
import { LegalTermsContent } from '@/components/LegalTerms';
import { TERMS_TITLE } from '@/lib/legal';

export const Route = createFileRoute('/termini')({
  head: () => ({
    meta: [
      { title: `${TERMS_TITLE} e Privacy · Segnatavolo` },
      { name: 'description', content: 'Condizioni Generali di Servizio e Informativa Privacy di Segnatavolo ai sensi del GDPR e del Codice Privacy italiano.' },
      { property: 'og:title', content: `${TERMS_TITLE} · Segnatavolo` },
      { property: 'og:description', content: 'Ruoli del trattamento, finalità, base giuridica e diritti dell’interessato.' },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: () => <main className="min-h-dvh bg-paper"><div className="mx-auto max-w-3xl px-4 py-8"><h1 className="mb-6 font-display text-3xl">{TERMS_TITLE}</h1><LegalTermsContent /></div></main>,
});
