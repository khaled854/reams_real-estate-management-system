import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-6xl font-bold text-dark-200">404</h1>
        <p className="mt-2 text-xl font-semibold text-dark-700">{t('errors.notFound')}</p>
        <p className="mt-2 text-sm text-dark-400">{t('errors.notFoundMessage')}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-8 inline-flex">
          {t('errors.backToDashboard')}
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
