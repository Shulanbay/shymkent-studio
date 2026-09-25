'use client';

// Last-resort error page (the root layout itself failed). Plain HTML, no providers.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#FFFCF8', color: '#171717', margin: 0 }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '96px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>Что-то пошло не так</h1>
          <p style={{ color: '#65605B', marginBottom: 8 }}>Страница не загрузилась. Попробуйте ещё раз через минуту.</p>
          <p style={{ color: '#65605B', marginBottom: 32 }}>Бет жүктелмеді. Бір минуттан кейін қайталап көріңіз.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#C84A12', color: '#fff', border: 0, borderRadius: 12, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          >
            Попробовать снова · Қайталау
          </button>
        </main>
      </body>
    </html>
  );
}
