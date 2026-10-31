import { useNavigate } from 'react-router-dom';
import useAuthStore from '@store/authStore';
import { useI18n } from '../i18n';

function UnauthorizedPage() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const { t }     = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-danger-light flex items-center justify-center">
          <svg className="w-10 h-10 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <p className="text-secondary-500 font-semibold text-sm uppercase tracking-widest mb-2">
          {t('errors.unauthorized')}
        </p>
        <h1 className="text-4xl font-bold text-dark-800 mb-3">403</h1>
        <p className="text-dark-500 mb-1">{t('errors.unauthorizedMessage')}</p>
        {user && (
          <p className="text-sm text-dark-400 mb-8">
            {t('common.role')}:{' '}
            <span className="font-semibold capitalize text-dark-600">{t(`users.roles.${user.role}`)}</span>
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)}        className="btn-white btn-md">{t('errors.goBack')}</button>
          <button onClick={() => navigate('/dashboard')} className="btn-primary btn-md">{t('breadcrumbs.dashboard')}</button>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
