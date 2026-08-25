import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { AccountWorkspace, PlayerWorkspace, StaffWorkspace, TeamWorkspace } from './operations.jsx';
import LineWaves from './LineWaves.jsx';
import { userFacingAuthError } from './authErrors.js';
import StrokeText from './StrokeText.jsx';
import BlurText from './BlurText.jsx';

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
  const [toast, setToast] = useState('');
  const save = data => { localStorage.removeItem(SESSION); setSession(data); };
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); navigate('/login', { replace: true }); };
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 3000); };
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
    try { response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers }); } catch { throw new Error('No se pudo conectar con la API. Revisá la URL configurada.'); }
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
      const requestError = new Error(data.message || 'Ocurrió un error.');
      requestError.code = data.error;
      requestError.status = response.status;
      throw requestError;
    }
    return response.status === 204 ? null : response.json();
  }
  if (session === undefined) return <><div className="app-line-waves"><LineWaves /></div><Loading /></>;
  if (!session) return <><div className="app-line-waves"><LineWaves /></div><Auth api={api} save={save} register={route.page === 'register'} navigate={navigate} /><Toast text={toast} /></>;
  const handleSignOut = async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally { logout(); } };
  const page = route.page === 'inicio' ? 'inicio' : route.page;
  const pagePath = key => key === 'inicio' ? '/' : `/${key}`;
  return <><div className="app-line-waves"><LineWaves /></div><Shell user={session.user} page={page} setPage={key => navigate(pagePath(key))} logout={handleSignOut}>
    {page === 'inicio' && <Home api={api} user={session.user} navigate={navigate} />}
    {page === 'equipos' && <TeamWorkspace api={api} director={['DIRECTOR', 'SUBDIRECTOR'].includes(session.user.role)} readOnly={session.user.role === 'MONITOR'} notify={notify} teamId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'jugadores' && <PlayerWorkspace api={api} userRole={session.user.role} readOnly={session.user.role === 'MONITOR'} notify={notify} playerId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'personal' && <StaffWorkspace api={api} notify={notify} canInvite={session.user.role === 'DIRECTOR'} currentUserId={session.user.id} />}
    {page === 'actividad' && <Directory api={api} kind="activity" />}
    {page === 'perfil' && <AccountWorkspace api={api} user={session.user} signOut={logout} />}
  </Shell><Toast text={toast} /></>;
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
    const [teams, players, activity] = await Promise.all([api('/teams'), api('/players'), ['DIRECTOR', 'SUBDIRECTOR'].includes(user.role) ? api('/audit-logs?limit=4').catch(() => []) : Promise.resolve([])]);
    const info = await Promise.all(teams.map(async team => ({ team, events: await api(`/teams/${team.id}/events`).catch(() => []) })));
    setData({ info, players, activity });
  } catch (err) { setError(err.message); } })(); }, []);
  if (error) return <Error message={error} />;
  if (!data) return <Loading />;
  if (data.monitor) return <><Welcome user={user} /><p className="section eyebrow">MIS EQUIPOS</p><div className="grid">{data.monitor.map(team => <button className="card team-card interactive-card" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><div><strong>{team.name}</strong><p className="muted">{team.players.length} jugadores asignados</p></div><Icon>chevron_right</Icon></button>)}</div></>;
  if (user.role === 'COACH') return <CoachHome data={data} user={user} navigate={navigate} />;
  if (user.role === 'PHYSICAL_TRAINER') return <PhysicalTrainerHome data={data} user={user} navigate={navigate} />;
  const now = new Date();
  const allEvents = data.info.flatMap(({ team, events }) => events.map(event => ({ ...event, teamName: team.name, teamId: team.id }))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const writableTeamIds = new Set(data.info.filter(({ team }) => team.canWrite === true).map(({ team }) => team.id));
  const actionableEvents = allEvents.filter(event => writableTeamIds.has(event.teamId));
  const today = allEvents.filter(event => new Date(event.startsAt).toDateString() === now.toDateString());
  const pendingAttendance = actionableEvents.filter(event => new Date(event.startsAt) < now && !event.attendanceSession).length;
  const pendingPlans = actionableEvents.filter(event => new Date(event.startsAt) >= now && (event.type || 'TRAINING') === 'TRAINING' && !event.trainingPlan).length;
  const incompletePlayers = data.players.filter(player => player.teams.some(membership => writableTeamIds.has(membership.teamId)) && (!player.position || !player.currentClub)).length;
  const firstTeam = data.info.find(({ team }) => team.canWrite === true)?.team;
  return <><Welcome user={user} /><section className="home-quick-actions"><button className="card quick-action" onClick={() => navigate('/equipos')}><Icon>groups</Icon><span><strong>Equipos</strong><small>Gestionar equipos</small></span></button><button className="card quick-action" onClick={() => navigate('/jugadores')}><Icon>person_add</Icon><span><strong>Jugadores</strong><small>Plantel y fichas</small></span></button>{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/agenda`)}><Icon>sports_basketball</Icon><span><strong>Agendar partido</strong><small>{firstTeam.name}</small></span></button>}{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/asistencia`)}><Icon>fact_check</Icon><span><strong>Asistencia</strong><small>{firstTeam.name}</small></span></button>}</section><p className="section eyebrow">HOY</p><section className="card home-today">{today.length ? today.map(event => <HomeEvent event={event} key={event.id} />) : <div className="home-empty"><Icon>event_available</Icon><span><strong>No hay actividades para hoy</strong><small>La agenda de hoy está libre.</small></span></div>}</section><p className="section eyebrow">PENDIENTES</p><section className="home-pending">{[["fact_check", pendingAttendance, "Asistencias por completar", "Actividades pasadas sin asistencia"], ["event_note", pendingPlans, "Planificaciones pendientes", "Entrenamientos futuros sin planificación"], ["person_search", incompletePlayers, "Fichas por completar", "Jugadores sin posición o club"]].map(([icon, amount, title, description]) => <article className="card pending-card" key={title}><Icon>{icon}</Icon><div><strong>{amount}</strong><span>{title}</span><small>{description}</small></div></article>)}</section><p className="section eyebrow">MIS EQUIPOS</p><div className="home-teams">{data.info.map(({ team, events }) => { const next = events.find(event => new Date(event.startsAt) >= now); return <button className="card team-card interactive-card" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><div><strong>{team.name}</strong><p className="muted">{team.category.name} · {next ? `${next.type === 'MATCH' ? 'Partido' : 'Entrenamiento'} ${new Date(next.startsAt).toLocaleDateString('es-AR', { day:'2-digit', month:'short' })}` : 'Sin próxima actividad'}</p></div><footer>{team._count.players} jugadores</footer></button>; })}</div>{data.activity.length > 0 && <><p className="section eyebrow">ACTIVIDAD RECIENTE</p><section className="card home-activity">{data.activity.map(item => <div className="activity-row" key={item.id}><span className="avatar">{initials(item.actorUser?.name || '?')}</span><span><strong>{item.actorUser?.name || 'Usuario'}</strong><small>{item.action.replaceAll('_', ' ').toLowerCase()} · {new Date(item.createdAt).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</small></span></div>)}</section></>}</>;
}

function CoachHome({ data, user, navigate }) {
  const now = new Date();
  const assigned = data.info.filter(({ team }) => team.canWrite === true);
  const teamIds = new Set(assigned.map(({ team }) => team.id));
  const players = data.players.filter(player => player.teams.some(membership => teamIds.has(membership.teamId)));
  const trainings = assigned.flatMap(({ team, events }) => events.filter(event => (event.type || 'TRAINING') === 'TRAINING' && new Date(event.startsAt) >= now).map(event => ({ ...event, teamName: team.name, teamId: team.id }))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const matches = assigned.flatMap(({ events }) => events.filter(event => event.type === 'MATCH' && new Date(event.startsAt) >= now)).length;
  const firstTeam = assigned[0]?.team;
  return <><Welcome user={user} title="Tus equipos hoy" /><section className="home-pending role-metrics">{[["groups", assigned.length, "Equipos asignados", "Equipos que podés gestionar"], ["group", players.length, "Jugadores", "Plantel de tus equipos"], ["fitness_center", trainings.length, "Entrenamientos próximos", "De tus equipos asignados"], ["sports_basketball", matches, "Partidos próximos", "Agenda competitiva"]].map(([icon, amount, title, description]) => <article className="card pending-card" key={title}><Icon>{icon}</Icon><div><strong>{amount}</strong><span>{title}</span><small>{description}</small></div></article>)}</section><p className="section eyebrow">ACCIONES CON TUS EQUIPOS</p><section className="home-quick-actions">{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/asistencia`)}><Icon>fact_check</Icon><span><strong>Tomar asistencia</strong><small>{firstTeam.name}</small></span></button>}{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/agenda`)}><Icon>calendar_month</Icon><span><strong>Agenda</strong><small>Entrenamientos y partidos</small></span></button>}<button className="card quick-action" onClick={() => navigate('/jugadores')}><Icon>groups</Icon><span><strong>Jugadores</strong><small>Ver fichas del plantel</small></span></button><button className="card quick-action" onClick={() => navigate('/equipos')}><Icon>sports</Icon><span><strong>Todos mis equipos</strong><small>Gestión deportiva</small></span></button></section><p className="section eyebrow">PRÓXIMOS ENTRENAMIENTOS</p><section className="card home-today">{trainings.length ? trainings.slice(0, 5).map(event => <HomeEvent event={event} key={event.id} />) : <div className="home-empty"><Icon>event_available</Icon><span><strong>No hay entrenamientos próximos</strong><small>Podés agregar uno desde la agenda de un equipo.</small></span></div>}</section><p className="section eyebrow">MIS EQUIPOS ASIGNADOS</p><div className="home-teams coach-teams">{assigned.length ? assigned.map(({ team, events }) => { const nextTraining = events.filter(event => (event.type || 'TRAINING') === 'TRAINING' && new Date(event.startsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0]; return <article className="card coach-team-card" key={team.id}><button className="coach-team-main" onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><span><strong>{team.name}</strong><small>{team._count.players} jugadores · {nextTraining ? `Próximo entrenamiento ${new Date(nextTraining.startsAt).toLocaleDateString('es-AR', { day:'2-digit', month:'short' })}` : 'Sin entrenamiento próximo'}</small></span><Icon>chevron_right</Icon></button><div className="coach-team-actions"><button onClick={() => navigate(`/equipos/${team.id}/asistencia`)}><Icon>fact_check</Icon> Asistencia</button><button onClick={() => navigate(`/equipos/${team.id}/agenda`)}><Icon>calendar_month</Icon> Agenda</button><button onClick={() => navigate(`/equipos/${team.id}/plantel`)}><Icon>group</Icon> Plantel</button></div></article>; }) : <Empty>No tenés equipos asignados todavía.</Empty>}</div></>;
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
function HomeEvent({ event }) { const date = new Date(event.startsAt); const isMatch = event.type === 'MATCH'; return <div className="home-event"><div className={`home-event-icon${isMatch ? ' match' : ''}`}><Icon>{isMatch ? 'sports_basketball' : 'fitness_center'}</Icon></div><div><strong>{event.title}</strong><small>{event.teamName} · {date.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</small></div><span className="event-kind">{isMatch ? 'Partido' : 'Entrenamiento'}</span></div>; }
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
function Loading({ rows = 4 }) { return <section className="skeleton-page" aria-busy="true" aria-label="Cargando contenido"><div className="skeleton skeleton-kicker" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-subtitle" /><div className="skeleton-list">{Array.from({ length: rows }, (_, index) => <div className="card skeleton-card" key={index}><div className="skeleton skeleton-avatar" /><div className="skeleton-card-copy"><div className="skeleton skeleton-line skeleton-line-long" /><div className="skeleton skeleton-line skeleton-line-short" /></div></div>)}</div><span className="sr-only">Cargando contenido</span></section>; } function Empty({ children }) { return <div className="card empty"><BlurText text={children} delay={45} /></div>; } function Error({ message }) { return <Header eyebrow="BASKETSTAFF" title="No pudimos cargar esta vista" text={message} />; } function Toast({ text }) { return text ? <div className="toast"><BlurText text={text} delay={35} /></div> : null; }
createRoot(document.getElementById('app')).render(<App />);
