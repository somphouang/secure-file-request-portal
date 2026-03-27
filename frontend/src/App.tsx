import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { loginRequest } from './authConfig';
import { useLanguage, t } from './i18n';

import RequestorDashboard from './RequestorDashboard';
import UploaderView from './UploaderView';

export default function App() {
  const { instance, accounts } = useMsal();
  const { lang, setLang } = useLanguage();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch(e => console.error(e));
  };

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: "/" }).catch(e => console.error(e));
  };

  const toggleLang = (e: React.MouseEvent) => {
    e.preventDefault();
    setLang(lang === 'en' ? 'fr' : 'en');
  };

  const activeAccount = accounts[0] || null;

  return (
    <BrowserRouter>
      {/* GoC Header Shell */}
      <header>
        <div className="goc-header-top">
          <div className="container" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ marginRight: '15px' }}>
              {activeAccount && (
                <span style={{ fontSize: '0.9em', color: '#333' }}>
                  {t('logged_in_as', lang)} <strong>{activeAccount.username}</strong>
                  <button 
                    onClick={handleLogout} 
                    className="btn btn-default" 
                    style={{ padding: '0.2em 0.8em', marginLeft: '10px', fontSize: '0.85em', fontWeight: 'bold' }}
                  >
                    {t('logout', lang)}
                  </button>
                </span>
              )}
            </div>
            <a href="#" lang={lang === 'en' ? 'fr' : 'en'} onClick={toggleLang} style={{ color: '#284162', fontSize: '1em', textDecoration: 'underline' }}>
              {t('lang_toggle', lang)}
            </a>
          </div>
        </div>
        
        <div className="container goc-brand-bar">
          <a href="/" className="goc-logo" aria-label={t('goc', lang)}>
            <img 
              src={lang === 'fr' 
                ? 'https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/sig-blk-fr.svg' 
                : 'https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/sig-blk-en.svg'} 
              alt={t('goc', lang)}
              style={{ height: '32px', width: 'auto' }}
            />
          </a>
        </div>
        
        <nav className="goc-navbar" aria-label="Site menu">
          <div className="container">
            {t('app_title', lang)}
          </div>
        </nav>
        
        <nav className="goc-breadcrumbs" aria-label="Breadcrumb">
          <div className="container">
            <a href="#">{t('canada_ca', lang)}</a> &gt; <span>{t('app_title', lang)}</span>
          </div>
        </nav>
      </header>

      <main className="container main-content">
        <Routes>
          <Route path="/" element={
            <>
              <AuthenticatedTemplate>
                <RequestorDashboard />
              </AuthenticatedTemplate>
              <UnauthenticatedTemplate>
                <div style={{ padding: '4em 0', textAlign: 'center' }}>
                  <h1 id="main-content" style={{border: 'none'}}>{t('login_req', lang)}</h1>
                  <p style={{fontSize: '1.2em'}}>{t('login_desc', lang)}</p>
                  <button className="btn btn-primary" onClick={handleLogin} style={{ marginTop: '2em', fontSize: '1.2em', padding: '10px 30px' }}>
                    {t('sign_in', lang)}
                  </button>
                </div>
              </UnauthenticatedTemplate>
            </>
          } />
          <Route path="/upload/:token" element={<UploaderView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer style={{ backgroundColor: '#26374a', color: 'white', padding: '4em 0 2em 0', marginTop: '4em' }}>
        <div className="container">
          <nav aria-label="Footer menu">
            <h2 style={{fontSize: '1.2em', margin: '0 0 15px 0', border: 'none', color: 'white'}}>{t('about', lang)}</h2>
            <ul style={{ listStyle: 'none', display: 'flex', gap: '30px', margin: 0, padding: 0, borderBottom: '1px solid #4d5d6c', paddingBottom: '2em', marginBottom: '2em', flexWrap: 'wrap' }}>
              <li><a href="#" style={{ color: 'white', textDecoration: 'none' }}>{t('contact', lang)}</a></li>
              <li><a href="#" style={{ color: 'white', textDecoration: 'none' }}>{t('departments', lang)}</a></li>
              <li><a href="#" style={{ color: 'white', textDecoration: 'none' }}>{t('public_service', lang)}</a></li>
            </ul>
          </nav>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <nav aria-label="Terms menu">
              <ul style={{ listStyle: 'none', display: 'flex', gap: '30px', margin: 0, padding: 0, flexWrap: 'wrap' }}>
                <li><a href="#" style={{ color: '#fff', textDecoration: 'none' }}>{t('social', lang)}</a></li>
                <li><a href="#" style={{ color: '#fff', textDecoration: 'none' }}>{t('mobile', lang)}</a></li>
                <li><a href="#" style={{ color: '#fff', textDecoration: 'none' }}>{t('about_site', lang)}</a></li>
                <li><a href="#" style={{ color: '#fff', textDecoration: 'none' }}>{t('terms', lang)}</a></li>
                <li><a href="#" style={{ color: '#fff', textDecoration: 'none' }}>{t('privacy', lang)}</a></li>
              </ul>
            </nav>
            <div style={{ marginLeft: 'auto' }}>
              <img 
                src="https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/wmms-blk.svg" 
                alt="Symbol of the Government of Canada" 
                style={{ height: '35px', filter: 'brightness(0) invert(1)' }} 
              />
            </div>
          </div>
        </div>
      </footer>
    </BrowserRouter>
  );
}
