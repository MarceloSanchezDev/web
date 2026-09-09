import { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { AccountWorkspace, PlayerWorkspace, StaffWorkspace, TeamWorkspace } from './operations.jsx';
import LineWaves from './LineWaves.jsx';
import { userFacingAuthError } from './authErrors.js';
import StrokeText from './StrokeText.jsx';
import BlurText from './BlurText.jsx';
import { apiErrorMessage } from './apiErrors.js';
import CountUp from './CountUp.jsx';
import { buildCoachDashboard } from './coachDashboard.js';
import { buildDirectorDashboard } from './directorDashboard.js';

const configuredApi = import.meta.env.VITE_API_URL;
const API = ((import.meta.env.PROD && (!configuredApi || configuredApi === '/api' || configuredApi === 'https://backend-ios-nu.vercel.app'))
  ? '/api'
  : (configuredApi || '/api')).replace(/\/$/, '');
const SESSION = 'basketstaff.session';
const role = { DIRECTOR: 'Director', SUBDIRECTOR: 'Subdirector', COACH: 'Entrenador', PHYSICAL_TRAINER: 'Preparador físico', MONITOR: 'Monitor' };
const initials = (name = '') => name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const age = date => { const d = new Date(date), n = new Date(); return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())); };
function Icon({ children, filled = false }) { return <span className={`material-symbols-rounded${filled ? ' icon-filled' : ''}`}>{children}</span>; }

function currentRoute() {
  const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [page = 'inicio', id, tab] = parts;
  return { page, id, tab };
}

function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = (path, { replace = false } = {}) => {
    const next = path.startsWith('/') ? path : `/${path}`;
    if (next !== window.location.pathname) window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    setRoute(currentRoute());
  };
  return { route, navigate };
}

function App() {
  const [session, setSession] = useState(undefined);
  const { route, navigate } = useRoute();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const save = data => { localStorage.removeItem(SESSION); setSession(data); };
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); navigate('/login', { replace: true }); };
  const notify = (text, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), type === 'error' ? 6000 : 3000);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const handleUnhandled = event => {
      if (event.reason?.reportedToUser) return;
      const message = event.reason?.message || 'Ocurrió un error inesperado al realizar la acción.';
      notify(message, 'error');
    };
    window.addEventListener('unhandledrejection', handleUnhandled);
    return () => window.removeEventListener('unhandledrejection', handleUnhandled);
  }, []);
  useEffect(() => {
    let active = true;
    let legacyRefreshToken;
    try { legacyRefreshToken = JSON.parse(localStorage.getItem(SESSION) || 'null')?.refreshToken; } catch { /* sesión antigua inválida */ }
    localStorage.removeItem(SESSION);
    fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' },
      body: JSON.stringify(legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {})
    }).then(async response => response.ok ? response.json() : null)
      .then(data => { if (active) setSession(data); })
      .catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (session && ['login', 'register'].includes(route.page)) navigate('/', { replace: true });
  }, [session, route.page]);
  async function api(path, options = {}, retry = true) {
    const headers = { Accept: 'application/json', 'X-Client-Platform': 'web', ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    let response;
    try {
      response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers });
    } catch {
      const connectionError = new Error('No se pudo conectar con la API. Revisá tu conexión e intentá nuevamente.');
      connectionError.code = 'NETWORK_ERROR';
      connectionError.reportedToUser = true;
      notify(connectionError.message, 'error');
      throw connectionError;
    }
    if (response.status === 401 && retry && session) {
      const refresh = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' }, body: '{}' });
      if (refresh.ok) {
        const next = await refresh.json();
        save(next);
        response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { ...headers, Authorization: `Bearer ${next.token}` } });
      } else {
        logout(); throw new Error('Tu sesión venció. Iniciá sesión nuevamente.');
      }
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const requestError = new Error(apiErrorMessage(data, response.status));
      requestError.code = data.error;
      requestError.status = response.status;
      requestError.reportedToUser = true;
      notify(requestError.message, 'error');
      throw requestError;
    }
    return response.status === 204 ? null : response.json();
  }
  if (session === undefined) return <><div className="app-line-waves"><LineWaves /></div><Loading /></>;
  if (!session) return <><div className="app-line-waves"><LineWaves /></div><Auth api={api} save={save} register={route.page === 'register'} navigate={navigate} /><Toast notice={toast} /></>;
  const handleSignOut = async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally { logout(); } };
  const page = route.page === 'inicio' ? 'inicio' : route.page;
  const pagePath = key => key === 'inicio' ? '/' : `/${key}`;
  return <><div className="app-line-waves"><LineWaves /></div><Shell user={session.user} page={page} setPage={key => navigate(pagePath(key))} logout={handleSignOut}>
    {page === 'inicio' && <Home api={api} user={session.user} navigate={navigate} />}
    {page === 'equipos' && <TeamWorkspace api={api} director={['DIRECTOR', 'SUBDIRECTOR'].includes(session.user.role)} userRole={session.user.role} readOnly={session.user.role === 'MONITOR'} notify={notify} teamId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'jugadores' && <PlayerWorkspace api={api} userRole={session.user.role} readOnly={session.user.role === 'MONITOR'} notify={notify} playerId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'personal' && <StaffWorkspace api={api} notify={notify} canInvite={session.user.role === 'DIRECTOR'} currentUserId={session.user.id} />}
    {page === 'actividad' && <Directory api={api} kind="activity" />}
    {page === 'perfil' && <AccountWorkspace api={api} user={session.user} signOut={logout} />}
  </Shell><Toast notice={toast} /></>;
}

function Auth({ api, save, register, navigate }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      save(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }));
      navigate('/', { replace: true });
    } catch (err) {
      setError(userFacingAuthError(err, register ? 'register' : 'login'));
    } finally {
      setBusy(false);
    }
  }
  const changeMode = () => { setError(''); navigate(register ? '/login' : '/register'); };
  return <main className="auth-shell"><div className="auth-content"><header className="brand-header"><div className="brand-icon"><Icon filled>sports_basketball</Icon></div><h1><StrokeText text={register ? 'Creá tu cuenta' : 'BasketStaff'} /></h1><p className="subtitle">{register ? 'Unite a la comunidad de entrenadores.' : 'Bienvenido de nuevo'}</p></header><form className="card form-card" onSubmit={submit}>{register && <><Field title="NOMBRE COMPLETO"><input required name="name" minLength="2" placeholder="Ej. Carlos Martínez" autoComplete="name" /></Field><Field title="NOMBRE DE LA COMPAÑÍA"><input required name="organizationName" minLength="2" placeholder="Ej. Club Central" autoComplete="organization" /></Field></>}<Field title="CORREO ELECTRÓNICO"><input required type="email" name="email" placeholder="entrenador@equipo.com" autoComplete="email" /></Field><Field title="CONTRASEÑA"><input required minLength="10" type="password" name="password" placeholder="••••••••" autoComplete={register ? 'new-password' : 'current-password'} /></Field>{!register && <button className="link-button" type="button" onClick={() => setModal('recover')}>¿Olvidaste tu contraseña?</button>}{error && <div className="auth-error" role="alert" aria-live="assertive"><Icon>error</Icon><div><strong>{register ? 'No pudimos crear la cuenta' : 'No pudimos iniciar sesión'}</strong><span>{error}</span></div></div>}<button className="primary" disabled={busy} aria-busy={busy}>{busy ? (register ? 'Creando cuenta…' : 'Ingresando…') : (register ? 'Crear cuenta' : 'Iniciar sesión')}</button></form><div className="auth-actions"><button className="link-button" type="button" onClick={changeMode}>{register ? '¿Ya tenés una cuenta? Iniciá sesión' : '¿No tenés una cuenta? Crear cuenta'}</button><button className="link-button" type="button" onClick={() => setModal('invite')}>Tengo una invitación</button></div></div>{modal === 'recover' && <Recover api={api} close={() => setModal('')} />}{modal === 'invite' && <Invite api={api} save={save} close={() => setModal('')} />}</main>;
}

function Shell({ user, page, setPage, logout, children }) { const [mobileMenuOpen, setMobileMenuOpen] = useState(false); const nav = [['inicio', 'home', 'Inicio'], ['equipos', 'groups', 'Equipos'], ['jugadores', 'person_search', 'Jugadores']]; if (['DIRECTOR', 'SUBDIRECTOR'].includes(user.role)) nav.push(['personal', 'manage_accounts', 'Personal'], ['actividad', 'history', 'Actividad']); nav.push(['perfil', 'account_circle', 'Perfil']); const closeMobileMenu = () => setMobileMenuOpen(false); const signOut = () => { closeMobileMenu(); logout(); }; return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><nav className="nav">{nav.map(([key, icon, label]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><i className="nav-icon"><Icon filled={page === key}>{icon}</Icon></i>{label}</button>)}</nav><div className="user-chip"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{role[user.role]}</small></div><button className="signout" title="Cerrar sesión" onClick={logout}><Icon>logout</Icon></button></div></aside><main className="main"><header className="mobile-topbar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><div className="mobile-user-menu"><button className="avatar mobile-avatar-button" type="button" aria-label="Abrir menú de usuario" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(value => !value)}>{initials(user.name)}</button>{mobileMenuOpen && <div className="mobile-user-dropdown"><span className="mobile-user-name">{user.name}</span><button type="button" onClick={signOut}><Icon>logout</Icon> Cerrar sesión</button></div>}</div></header>{children}</main></div>; }

function Home({ api, user, navigate }) {
  const [data, setData] = useState(), [error, setError] = useState('');
  useEffect(() => { (async () => { try {
    if (user.role === 'MONITOR') return setData({ monitor: await api('/entry-context') });
    const leadership = ['DIRECTOR', 'SUBDIRECTOR'].includes(user.role);
    const [teams, players, activity, invitations] = await Promise.all([api('/teams'), api('/players'), leadership ? api('/audit-logs?limit=4').catch(() => []) : Promise.resolve([]), leadership ? api('/users/invitations').catch(() => []) : Promise.resolve([])]);
    const isCoach = user.role === 'COACH';
    const year = new Date().getFullYear();
    const coachEventRange = `?from=${encodeURIComponent(`${year}-01-01`)}&to=${encodeURIComponent(`${year + 1}-01-01`)}`;
    const loadEvents = async team => {
      if (isCoach && !team.canWrite) return [];
      if (!isCoach) return api(`/teams/${team.id}/events`).catch(() => []);
      const [yearEvents, upcomingEvents] = await Promise.all([
        api(`/teams/${team.id}/events${coachEventRange}`).catch(() => []),
        api(`/teams/${team.id}/events`).catch(() => [])
      ]);
      return [...new Map([...yearEvents, ...upcomingEvents].map(event => [event.id, event])).values()];
    };
    const info = await Promise.all(teams.map(async team => ({
      team,
      events: await loadEvents(team),
      statistics: (leadership || (isCoach && team.canWrite))
        ? await api(`/teams/${team.id}/statistics?months=${isCoach ? 12 : 6}`).catch(() => null)
        : null
    })));
    setData({ info, players, activity, invitations });
  } catch (err) { setError(err.message); } })(); }, []);
  if (error) return <Error message={error} />;
  if (!data) return <Loading />;
  if (data.monitor) return <><Welcome user={user} /><p className="section eyebrow">MIS EQUIPOS</p><div className="grid">{data.monitor.map(team => <button className="card team-card interactive-card" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><div><strong>{team.name}</strong><p className="muted">{team.players.length} jugadores asignados</p></div><Icon>chevron_right</Icon></button>)}</div></>;
  if (user.role === 'COACH') return <CoachHome data={data} user={user} navigate={navigate} />;
  if (user.role === 'PHYSICAL_TRAINER') return <PhysicalTrainerHome data={data} user={user} navigate={navigate} />;
  return <DirectorHome data={data} user={user} navigate={navigate} />;
}

function DirectorHome({ data, user, navigate }) {
  const dashboard = buildDirectorDashboard(data, new Date());
  const metrics = [
    ['groups', dashboard.teamCount, '', 'Equipos activos', 'Toda la organización'],
    ['group', dashboard.playerCount, '', 'Jugadores activos', 'Plantel registrado'],
    ['monitoring', dashboard.attendanceRate, '%', 'Asistencia', 'Últimos 6 meses'],
    ['calendar_month', dashboard.activityCount, '', 'Próximos 7 días', 'Entrenamientos y partidos']
  ];
  const monthName = value => new Date(`${value}-02T00:00:00Z`).toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  const activityName = event => event.type === 'MATCH' ? 'Partido' : event.type === 'PHYSICAL_TRAINING' ? 'Entrenamiento físico' : 'Entrenamiento';
  return <><Welcome user={user} title="Centro de control" /><section className="director-dashboard" aria-label="Resumen de la organización"><header className="director-command-bar"><div><span className="eyebrow">PANORAMA GENERAL</span><p>Información actualizada de todos tus equipos.</p></div><div className="director-actions"><button onClick={() => navigate('/equipos')}><Icon>add_circle</Icon><span>Gestionar equipos</span></button><button onClick={() => navigate('/jugadores')}><Icon>person_add</Icon><span>Agregar jugador</span></button><button onClick={() => navigate('/personal')}><Icon>{user.role === 'DIRECTOR' ? 'forward_to_inbox' : 'manage_accounts'}</Icon><span>{user.role === 'DIRECTOR' ? 'Invitar personal' : 'Ver personal'}</span></button></div></header><section className="director-metrics">{metrics.map(([icon, value, suffix, title, detail], index) => <button className="card director-metric" key={title} onClick={() => navigate(index === 1 ? '/jugadores' : '/equipos')}><span><Icon>{icon}</Icon>{title}</span><strong><CountUp from={0} to={value} suffix={suffix} duration={1} delay={index * .08} /></strong><small>{detail}</small></button>)}</section><div className="director-primary-grid"><section className="card director-alerts"><div className="director-section-head"><div><span className="eyebrow">REQUIERE ATENCIÓN</span><h3>Prioridades</h3></div><span className="director-count">{dashboard.alerts.length}</span></div>{dashboard.alerts.length ? <div className="director-alert-list">{dashboard.alerts.slice(0, 5).map((alert, index) => <button key={`${alert.title}-${index}`} onClick={() => navigate(alert.path)}><span className={`director-alert-icon ${alert.tone}`}><Icon>{alert.icon}</Icon></span><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><Icon>chevron_right</Icon></button>)}</div> : <div className="director-empty"><Icon>task_alt</Icon><strong>Todo está al día</strong><span>No hay pendientes importantes en este momento.</span></div>}</section><section className="card director-agenda"><div className="director-section-head"><div><span className="eyebrow">PRÓXIMOS 7 DÍAS</span><h3>Agenda</h3></div><button className="text-action" onClick={() => navigate('/equipos')}>Ver equipos</button></div>{dashboard.upcoming.length ? <div className="director-agenda-list">{dashboard.upcoming.map(event => { const date = new Date(event.startsAt); return <button key={event.id} onClick={() => navigate(`/equipos/${event.teamId}/agenda`)}><span className="director-date"><strong>{date.getDate()}</strong><small>{date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small></span><span><strong>{event.title}</strong><small>{event.teamName} · {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></span><em>{activityName(event)}</em></button>; })}</div> : <div className="director-empty"><Icon>event_available</Icon><strong>Agenda libre</strong><span>No hay próximas actividades programadas.</span></div>}</section></div><section className="card director-chart-card"><div className="director-section-head"><div><span className="eyebrow">ÚLTIMOS 6 MESES</span><h3>Evolución de asistencia</h3></div><strong>{dashboard.attendanceRate}% global</strong></div>{dashboard.monthly.some(month => month.totalRecords) ? <div className="director-chart" role="img" aria-label="Asistencia mensual de la organización">{dashboard.monthly.map(month => <div key={month.month}><span className="director-chart-value">{month.totalRecords ? `${month.attendanceRate}%` : '—'}</span><span className="director-chart-track"><i style={{ height: `${Math.max(month.attendanceRate, month.totalRecords ? 6 : 0)}%` }} /></span><small>{monthName(month.month)}</small></div>)}</div> : <div className="director-empty compact"><Icon>bar_chart</Icon><strong>Aún no hay datos de asistencia</strong><span>El gráfico aparecerá cuando se registren las primeras listas.</span></div>}</section><section className="card director-teams"><div className="director-section-head"><div><span className="eyebrow">COMPARACIÓN</span><h3>Estado de los equipos</h3></div><button className="text-action" onClick={() => navigate('/equipos')}>Ver todos</button></div><div className="director-team-head"><span>Equipo</span><span>Jugadores</span><span>Asistencia</span><span>Próxima actividad</span></div>{dashboard.teams.map(team => <button className="director-team-row" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><span><strong>{team.name}</strong><small>{team.category}</small></span><span>{team.players}</span><span className="director-attendance"><span><i style={{ width: `${team.attendanceRate || 0}%` }} /></span><strong>{team.attendanceRate === null ? 'Sin datos' : `${team.attendanceRate}%`}</strong></span><span>{team.nextEvent ? <><strong>{activityName(team.nextEvent)}</strong><small>{new Date(team.nextEvent.startsAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</small></> : <small>Sin actividad</small>}</span><Icon>chevron_right</Icon></button>)}</section></section></>;
}

function CoachHome({ data, user, navigate }) {
  const assigned = data.info.filter(({ team }) => team.canWrite === true);
  const [selectedTeamId, setSelectedTeamId] = useState(assigned[0]?.team.id || '');
  const dashboard = buildCoachDashboard(data, new Date(), selectedTeamId);
  const next = dashboard.nextTraining;
  const nextDate = next ? new Date(next.startsAt) : null;
  const metrics = [['group', dashboard.activePlayers, '', 'Jugadores activos'], ['trending_up', dashboard.attendanceRate, '%', 'Asistencia'], ['calendar_month', dashboard.trainingCount, '', 'Entrenamientos']];
  return <><Welcome user={user} title="Resumen de tu equipo" /><section className="coach-dashboard" aria-label="Resumen del entrenador">{dashboard.assignedTeams.length > 0 && <label className="card coach-team-selector"><div className="coach-team-mark"><Icon>sports_basketball</Icon></div><span><small>EQUIPO SELECCIONADO</small><strong>{dashboard.selectedTeam?.name}</strong></span>{dashboard.assignedTeams.length > 1 ? <select aria-label="Seleccionar equipo" value={dashboard.selectedTeam?.id || ''} onChange={event => setSelectedTeamId(event.target.value)}>{dashboard.assignedTeams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}</select> : <Icon>groups</Icon>}</label>}<div className="coach-dashboard-bento"><div>{next ? <section className="coach-next-training" aria-label="Próximo entrenamiento"><span className="coach-next-label">Próximo entrenamiento</span><div className="coach-next-head"><div className="coach-training-info"><strong>{next.title}</strong><small><Icon>groups</Icon> {next.teamName}</small></div><div className="coach-training-time"><span>{nextDate.toDateString() === new Date().toDateString() ? 'HOY' : nextDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()}</span><strong>{nextDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</strong></div></div><button onClick={() => navigate(`/equipos/${next.teamId}/agenda`)}>Ver detalle</button></section> : <section className="coach-next-training coach-next-empty"><span className="coach-next-label">Próximo entrenamiento</span><div className="coach-training-info"><strong>Sin próximos entrenamientos</strong><small>Este equipo todavía no tiene otro entrenamiento programado.</small></div><button onClick={() => dashboard.selectedTeam && navigate(`/equipos/${dashboard.selectedTeam.id}/agenda`)}>Ir a la agenda</button></section>}</div><section className="coach-dashboard-metrics" aria-label="Métricas del equipo">{metrics.map(([icon, value, suffix, title], index) => <article className="card coach-dashboard-metric" key={title}><span>{title}</span><div><strong><CountUp from={0} to={value} suffix={suffix} duration={1} delay={index * 0.08} /></strong><Icon>{icon}</Icon></div></article>)}</section></div>{!dashboard.selectedTeam && <div className="card empty">No tenés equipos asignados todavía.</div>}</section></>;
}

const physicalFields = [['heightCm', 'altura'], ['weightKg', 'peso'], ['speedKmh', 'velocidad'], ['physicalPerformance', 'desempeño']];
const missingPhysicalFields = player => physicalFields.filter(([field]) => player[field] === null || player[field] === undefined).map(([, label]) => label);

function PhysicalTrainerHome({ data, user, navigate }) {
  const assigned = data.info.filter(({ team }) => team.canEditPhysical === true);
  const teamIds = new Set(assigned.map(({ team }) => team.id));
  const players = data.players.filter(player => player.teams.some(membership => teamIds.has(membership.teamId)));
  const pending = players.map(player => ({ player, missing: missingPhysicalFields(player) })).filter(item => item.missing.length).sort((a, b) => b.missing.length - a.missing.length);
  const completeness = players.length ? Math.round(((players.length - pending.length) / players.length) * 100) : 0;
  const firstPending = pending[0]?.player;
  return <><Welcome user={user} title="Control físico del plantel" /><section className="home-pending role-metrics">{[["groups", assigned.length, "Equipos asignados", "Equipos bajo tu seguimiento"], ["group", players.length, "Jugadores", "Total para evaluar"], ["monitor_weight", pending.length, "Mediciones pendientes", "Fichas físicas incompletas"], ["task_alt", `${completeness}%`, "Fichas completas", "Altura, peso, velocidad y desempeño"]].map(([icon, amount, title, description]) => <article className="card pending-card" key={title}><Icon>{icon}</Icon><div><strong>{amount}</strong><span>{title}</span><small>{description}</small></div></article>)}</section><section className="card physical-progress" aria-label={`${completeness}% de fichas físicas completas`}><div><strong>Progreso de mediciones</strong><span>{players.length - pending.length} de {players.length} jugadores completos</span></div><div className="physical-progress-track"><span style={{ width: `${completeness}%` }} /></div></section><p className="section eyebrow">ACCIONES FÍSICAS</p><section className="home-quick-actions"><button className="card quick-action" onClick={() => navigate('/jugadores')}><Icon>monitor_weight</Icon><span><strong>Cargar mediciones</strong><small>Buscar un jugador</small></span></button><button className="card quick-action" onClick={() => navigate('/equipos')}><Icon>groups</Icon><span><strong>Equipos asignados</strong><small>Ver planteles</small></span></button>{firstPending && <button className="card quick-action" onClick={() => navigate(`/jugadores/${firstPending.id}`)}><Icon>speed</Icon><span><strong>Continuar mediciones</strong><small>{firstPending.name}</small></span></button>}</section><p className="section eyebrow">MEDICIONES PENDIENTES</p><section className="card physical-priority">{pending.length ? pending.slice(0, 8).map(({ player, missing }) => <button className="physical-player-row" key={player.id} onClick={() => navigate(`/jugadores/${player.id}`)}><span className="avatar">{initials(player.name)}</span><span><strong>{player.name}</strong><small>Falta: {missing.join(', ')}</small></span><Icon>chevron_right</Icon></button>) : <div className="home-empty"><Icon>task_alt</Icon><span><strong>Las fichas físicas están completas</strong><small>No hay mediciones pendientes en tus equipos.</small></span></div>}</section><p className="section eyebrow">MIS EQUIPOS ASIGNADOS</p><div className="home-teams">{assigned.length ? assigned.map(({ team }) => { const teamPlayers = players.filter(player => player.teams.some(membership => membership.teamId === team.id)); const teamComplete = teamPlayers.filter(player => missingPhysicalFields(player).length === 0).length; return <button className="card team-card interactive-card" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><div><strong>{team.name}</strong><p className="muted">{teamComplete} de {teamPlayers.length} fichas físicas completas</p></div><footer>{team._count.players} jugadores</footer></button>; }) : <Empty>No tenés equipos asignados todavía.</Empty>}</div></>;
}
function HomeEvent({ event }) { const date = new Date(event.startsAt); const isMatch = event.type === 'MATCH'; const isPhysical = event.type === 'PHYSICAL_TRAINING'; return <div className="home-event"><div className={`home-event-icon${isMatch ? ' match' : ''}`}><Icon>{isMatch ? 'sports_basketball' : isPhysical ? 'exercise' : 'fitness_center'}</Icon></div><div><strong>{event.title}</strong><small>{event.teamName} · {date.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</small></div><span className="event-kind">{isMatch ? 'Partido' : isPhysical ? 'Entrenamiento físico' : 'Entrenamiento'}</span></div>; }
function Welcome({ user, title = 'Tu jornada deportiva' }) { return <div className="dashboard-header"><div className="avatar">{initials(user.name)}</div><div><p className="muted"><BlurText text={`Hola, ${user.name}`} delay={60} /></p><h2><StrokeText text={title} /></h2></div></div>; }

function Teams({ api, director, notify }) { const [teams, setTeams] = useState(), [show, setShow] = useState(''), [error, setError] = useState(''); const load = () => api('/teams').then(setTeams).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!teams) return <Loading />; return <><Header eyebrow="GESTIÓN DEPORTIVA" title="Tus equipos" text="Seleccioná un equipo para gestionar jugadores, asistencia y seguimiento." actions={<><button className="secondary" onClick={() => setShow('birthdays')}>♧ Cumpleaños</button>{director && <button className="secondary" onClick={() => setShow('team')}>＋ Crear equipo</button>}</>} /><div className="grid">{teams.length ? teams.map(t => <article className="card team-card" key={t.id}><div className="team-mark">♟</div><div><strong>{t.name}</strong><p className="muted">{t.category.name}</p></div><footer>{t._count.players} jugadores</footer></article>) : <Empty>Todavía no hay equipos.</Empty>}</div>{show === 'team' && <NewTeam api={api} close={() => setShow('')} done={() => { notify('Equipo creado'); load(); }} />}{show === 'birthdays' && <Birthdays api={api} close={() => setShow('')} />}</>; }

function Players({ api, notify }) { const [data, setData] = useState(), [filter, setFilter] = useState(''), [newPlayer, setNewPlayer] = useState(false), [error, setError] = useState(''); const load = () => Promise.all([api('/players'), api('/teams')]).then(setData).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!data) return <Loading />; const [players, teams] = data, shown = players.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())); return <><Header eyebrow="PLANTEL" title="Jugadores" text="Directorio deportivo de tu organización." actions={<><input className="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre" /><button className="secondary" onClick={() => setNewPlayer(true)}>＋ Crear jugador</button></>} /><div className="list">{shown.map(p => <article className="card player-row" key={p.id}><div className="avatar">{initials(p.name)}</div><div className="row-content"><strong>{p.name}</strong><span>{age(p.birthDate)} años · {p.teams.length ? `${p.teams.length} equipo(s)` : 'Sin equipo'}</span></div><span className="chevron">›</span></article>)}{!shown.length && <Empty>No encontramos jugadores.</Empty>}</div>{newPlayer && <NewPlayer api={api} teams={teams} close={() => setNewPlayer(false)} done={() => { notify('Jugador creado'); load(); }} />}</>; }

function Directory({ api, kind }) { const [items, setItems] = useState(), [error, setError] = useState(''); const path = kind === 'staff' ? '/users' : '/audit-logs'; useEffect(() => { api(path).then(setItems).catch(e => setError(e.message)); }, []); if (error) return <Error message={error} />; if (!items) return <Loading />; const staff = kind === 'staff'; return <><Header eyebrow="ORGANIZACIÓN" title={staff ? 'Personal' : 'Actividad'} text={staff ? 'Miembros que forman parte de tu organización.' : 'Historial reciente de operaciones.'} /><div className="list">{items.map(x => staff ? <article className="card player-row" key={x.id}><div className="avatar">{initials(x.name)}</div><div className="row-content"><strong>{x.name}</strong><span>{x.email}</span></div><span className="role-label">{role[x.role]}</span></article> : <article className="card player-row" key={x.id}><div className="metric-icon">◷</div><div className="row-content"><strong>{x.action.replaceAll('_', ' ')}</strong><span>{new Date(x.createdAt).toLocaleString('es-AR')}</span></div></article>)}</div></>; }
function Profile({ user }) { return <><Header eyebrow="CUENTA" title="Perfil" text="Tu sesión y preferencias de BasketStaff." /><section className="card profile-card"><div className="player-row"><div className="avatar avatar-large">{initials(user.name)}</div><div className="row-content"><strong>{user.name}</strong><span>{user.email}</span><span className="role-label">{role[user.role]}</span></div></div></section></>; }

function Header({ eyebrow, title, text, actions }) { return <header className="page-head"><div><span className="eyebrow"><BlurText text={eyebrow} delay={55} /></span><h1><StrokeText text={title} /></h1><p className="subtitle"><BlurText text={text} delay={55} /></p></div>{actions && <div className="toolbar">{actions}</div>}</header>; }
const formSlug = title => title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function useFormPage(title, close) {
  const slug = formSlug(title);
  useEffect(() => {
    const current = new URL(window.location.href);
    if (current.searchParams.get('form') === slug) return;
    const returnTo = `${current.pathname}${current.search}${current.hash}`;
    current.searchParams.set('form', slug);
    window.history.pushState({ basketstaffForm: slug, basketstaffReturnTo: returnTo }, '', current);
    const handleBack = () => {
      if (new URL(window.location.href).searchParams.get('form') !== slug) close();
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);
  return () => {
    const state = window.history.state;
    if (state?.basketstaffForm === slug && state.basketstaffReturnTo) window.history.replaceState({}, '', state.basketstaffReturnTo);
    close();
  };
}

function Modal({ title, close, children }) {
  const dismiss = useFormPage(title, close);
  return <div className="modal-backdrop form-page" onMouseDown={e => e.target === e.currentTarget && dismiss()}><section className="card modal"><div className="modal-head"><div><span className="eyebrow"><BlurText text="BASKETSTAFF" delay={45} /></span><h2><StrokeText text={title} /></h2></div><button className="icon-close" aria-label="Volver" onClick={dismiss}><Icon>arrow_back</Icon></button></div>{children}</section></div>;
}
function Field({ title, children }) { return <label className="field"><span className="eyebrow"><BlurText text={title} delay={35} /></span><span className="input-wrap">{children}</span></label>; }
function Form({ fields, button, submit }) { const [error, setError] = useState(''), [busy, setBusy] = useState(false); return <form className="modal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await submit(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget); } catch (err) { setError(err.message); } setBusy(false); }}>{fields.map(([title, name, type, options]) => <Field key={name} title={title}>{type === 'select' ? <select required name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : type === 'multi' ? <select multiple size="3" name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : <input required name={name} type={type || 'text'} minLength={type === 'password' ? 10 : undefined} />}</Field>)}{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Guardando…' : button}</button></form>; }
function Recover({ api, close }) { const [requested, setRequested] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''); return <Modal title="Recuperar acceso" close={close}><form className="modal-form" onSubmit={async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { if (!requested) { const result = await api('/auth/forgot-password', { method:'POST', body:JSON.stringify({ email:data.email }) }); setMessage(result.message); if (result.resetToken) { event.currentTarget.resetToken.value = result.resetToken; } setRequested(true); } else { await api('/auth/reset-password', { method:'POST', body:JSON.stringify({ resetToken:data.resetToken, newPassword:data.newPassword }) }); setMessage('Contraseña actualizada. Ya podés iniciar sesión.'); } } catch (err) { setError(err.message); } }}><Field title="CORREO ELECTRÓNICO"><input required name="email" type="email" disabled={requested} /></Field>{requested && <><Field title="CÓDIGO DE RECUPERACIÓN"><input required name="resetToken" minLength="32" /></Field><Field title="NUEVA CONTRASEÑA"><input required name="newPassword" type="password" minLength="10" /></Field></>}<p className="notice">{message}</p>{error && <p className="error">{error}</p>}<button className="primary">{requested ? 'Cambiar contraseña' : 'Solicitar código'}</button></form></Modal>; }
function Invite({ api, save, close }) { return <Modal title="Aceptar invitación" close={close}><Form fields={[["CÓDIGO DE INVITACIÓN", 'invitationToken'], ['EMAIL INVITADO', 'email', 'email'], ['NOMBRE', 'name'], ['CONTRASEÑA', 'password', 'password']]} button="Crear cuenta" submit={async data => { save(await api('/auth/accept-invitation', { method: 'POST', body: JSON.stringify(data) })); close(); }} /></Modal>; }
function NewTeam({ api, close, done }) { const [categories, setCategories] = useState(); useEffect(() => { api('/categories').then(setCategories); }, []); return <Modal title="Crear equipo" close={close}>{categories ? <Form fields={[["NOMBRE DEL EQUIPO", 'name'], ['CATEGORÍA', 'categoryId', 'select', categories]]} button="Crear equipo" submit={async data => { await api('/teams', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /> : <Loading />}</Modal>; }
function NewPlayer({ api, teams, close, done }) { return <Modal title="Crear jugador" close={close}><Form fields={[["NOMBRE COMPLETO", 'name'], ['FECHA DE NACIMIENTO', 'birthDate', 'date'], ['EQUIPOS (OPCIONAL)', 'teamIds', 'multi', teams]]} button="Crear jugador" submit={async (data, form) => { data.teamIds = [...form.elements.teamIds.selectedOptions].map(x => x.value); await api('/players', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /></Modal>; }
function Birthdays({ api, close }) { const [items, setItems] = useState(); useEffect(() => { api('/birthdays?days=30').then(setItems); }, []); return <Modal title="Próximos cumpleaños" close={close}>{!items ? <Loading /> : <div className="list">{items.map(b => { const d = new Date(b.nextBirthday); return <article className="card event" key={b.id}><div className="date-badge"><b>{d.getUTCDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</div><div className="event-content"><strong>{b.name}</strong><span>{b.daysUntil === 0 ? `Cumple hoy · ${b.turningAge} años` : `En ${b.daysUntil} días · cumple ${b.turningAge}`}</span></div></article>; })}</div>}</Modal>; }
function Event({ event }) { const d = new Date(event.startsAt); return <article className="card event"><div className="date-badge"><b>{d.getDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}</div><div className="event-content"><strong>{event.title}</strong><span className="role-label">{event.teamName}</span><span>{d.toLocaleString('es-AR')}</span></div><span className="chevron">›</span></article>; }
function Loading({ rows = 4 }) { return <section className="skeleton-page" aria-busy="true" aria-label="Cargando contenido"><div className="skeleton skeleton-kicker" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-subtitle" /><div className="skeleton-list">{Array.from({ length: rows }, (_, index) => <div className="card skeleton-card" key={index}><div className="skeleton skeleton-avatar" /><div className="skeleton-card-copy"><div className="skeleton skeleton-line skeleton-line-long" /><div className="skeleton skeleton-line skeleton-line-short" /></div></div>)}</div><span className="sr-only">Cargando contenido</span></section>; } function Empty({ children }) { return <div className="card empty"><BlurText text={children} delay={45} /></div>; } function Error({ message }) { return <Header eyebrow="BASKETSTAFF" title="No pudimos cargar esta vista" text={message} />; } function Toast({ notice }) { return notice ? <div className={`toast toast-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'} aria-live={notice.type === 'error' ? 'assertive' : 'polite'}><Icon>{notice.type === 'error' ? 'error' : 'check_circle'}</Icon><span><strong>{notice.type === 'error' ? 'No pudimos completar la acción' : 'Acción completada'}</strong><BlurText text={notice.text} delay={35} /></span></div> : null; }

class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal-error"><div className="card"><Icon>error</Icon><h1>La interfaz encontró un problema</h1><p>No se perdió la información guardada. Recargá la página para continuar.</p><button className="primary" onClick={() => window.location.reload()}>Recargar BasketStaff</button></div></main>;
  }
}

createRoot(document.getElementById('app')).render(<AppErrorBoundary><App /></AppErrorBoundary>);
