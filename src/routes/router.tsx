import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LoginView } from '../views/LoginView/LoginView';
import { HomeView } from '../views/HomeView/HomeView';
import { ProgressView } from '../views/ProgressView/ProgressView';
import { ReportView } from '../views/ReportView/ReportView';

/**
 * 全画面の構成は UI 仕様書 §1「画面一覧」に対応:
 *   #/login    → SCR-001-login
 *   #/         → SCR-002-home
 *   #/progress → SCR-003-progress
 *   #/report   → SCR-004-report
 */
export function AppRouter() {
  return (
    <HashRouter>
      <DevNavBar />
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/progress" element={<ProgressView />} />
        <Route path="/report" element={<ReportView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

/**
 * 開発用ナビゲーション。Phase G の手動確認まで残し、Phase H 直前に削除する。
 * 本来のヘッダーは Header コンポーネント（src/components/Header/）。
 */
function DevNavBar() {
  const style = {
    padding: '0.5rem 1rem',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    fontSize: '0.875rem',
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  };
  return (
    <nav aria-label="開発用ナビゲーション" style={style}>
      <strong style={{ color: 'var(--color-text-muted)' }}>[dev]</strong>
      <Link to="/login">#/login</Link>
      <Link to="/">#/</Link>
      <Link to="/progress">#/progress</Link>
      <Link to="/report">#/report</Link>
    </nav>
  );
}
