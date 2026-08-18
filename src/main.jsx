import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { AccountWorkspace, PlayerWorkspace, StaffWorkspace, TeamWorkspace } from './operations.jsx';
import LineWaves from './LineWaves.jsx';

// En local usamos el proxy de Vite. En producción nunca debe apuntar a /api,
// porque la SPA se sirve desde ese mismo dominio y respondería 405 al hacer POST.
const configuredApi = import.meta.env.VITE_API_URL;
const API = ((import.meta.env.PROD && (!configuredApi || configuredApi === '/api'))
  ? 'https://backend-ios-nu.vercel.app'
  : (configuredApi || '/api')).replace(/\/$/, '');
const SESSION = 'basketstaff.session';
const role = { DIRECTOR: 'Director', SUBDIRECTOR: 'Subdirector', COACH: 'Entrenador', MONITOR: 'Monitor' };
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
  const navigate = path => {
    const next = path.startsWith('/') ? path : `/${path}`;
    if (next !== window.location.pathname) window.history.pushState({}, '', next);
    setRoute(currentRoute());
  };
  return { route, navigate };
}

function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem(SESSION) || 'null'));
  const { route, navigate } = useRoute();
  const [toast, setToast] = useState('');
  const save = data => { localStorage.setItem(SESSION, JSON.stringify(data)); setSession(data); };
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); navigate('/'); };
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 3000); };
  async function api(path, options = {}, retry = true) {
    const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    let response;
    try { response = await fetch(`${API}${path}`, { ...options, headers }); } catch { throw new Error('No se pudo conectar con la API. Revisá la URL configurada.'); }
    if (response.status === 401 && retry && session?.refreshToken) {
      const refresh = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
      if (refresh.ok) { const next = await refresh.json(); save(next); return api(path, options, false); }
      logout(); throw new Error('Tu sesión venció. Iniciá sesión nuevamente.');
    }
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Ocurrió un error.'); }
    return response.status === 204 ? null : response.json();
  }
  if (!session) return <><div className="app-line-waves"><LineWaves /></div><Auth api={api} save={save} /><Toast text={toast} /></>;
  const handleSignOut = async () => { try { await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }) }); } finally { logout(); } };
  const page = route.page === 'inicio' ? 'inicio' : route.page;
  const pagePath = key => key === 'inicio' ? '/' : `/${key}`;
  return <><div className="app-line-waves"><LineWaves /></div><Shell user={session.user} page={page} setPage={key => navigate(pagePath(key))} logout={handleSignOut}>
    {page === 'inicio' && <Home api={api} user={session.user} navigate={navigate} />}
    {page === 'equipos' && <TeamWorkspace api={api} director={['DIRECTOR', 'SUBDIRECTOR'].includes(session.user.role)} readOnly={session.user.role === 'MONITOR'} notify={notify} teamId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'jugadores' && <PlayerWorkspace api={api} readOnly={session.user.role === 'MONITOR'} notify={notify} playerId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'personal' && <StaffWorkspace api={api} notify={notify} canInvite={session.user.role === 'DIRECTOR'} currentUserId={session.user.id} />}
    {page === 'actividad' && <Directory api={api} kind="activity" />}
    {page === 'perfil' && <AccountWorkspace api={api} user={session.user} signOut={logout} />}
  </Shell><Toast text={toast} /></>;
}

function Auth({ api, save }) {
  const [register, setRegister] = useState(false), [error, setError] = useState(''), [modal, setModal] = useState('');
  async function submit(event) { event.preventDefault(); setError(''); try { save(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })); } catch (err) { setError(err.message); } }
  return <main className="auth-shell"><div className="auth-content"><header className="brand-header"><div className="brand-icon"><Icon filled>sports_basketball</Icon></div><h1>{register ? 'Creá tu cuenta' : 'BasketStaff'}</h1><p className="subtitle">{register ? 'Unite a la comunidad de entrenadores.' : 'Bienvenido de nuevo'}</p></header><form className="card form-card" onSubmit={submit}>{register && <><Field title="NOMBRE COMPLETO"><input required name="name" placeholder="Ej. Carlos Martínez" /></Field><Field title="NOMBRE DE LA COMPAÑÍA"><input required name="organizationName" placeholder="Ej. Club Central" /></Field></>}<Field title="CORREO ELECTRÓNICO"><input required type="email" name="email" placeholder="entrenador@equipo.com" /></Field><Field title="CONTRASEÑA"><input required minLength="10" type="password" name="password" placeholder="••••••••" /></Field>{!register && <button className="link-button" type="button" onClick={() => setModal('recover')}>¿Olvidaste tu contraseña?</button>}{error && <p className="error">{error}</p>}<button className="primary">{register ? 'Crear cuenta' : 'Iniciar sesión'}</button></form><div className="auth-actions"><button className="link-button" onClick={() => setRegister(!register)}>{register ? '¿Ya tenés una cuenta? Iniciá sesión' : '¿No tenés una cuenta? Crear cuenta'}</button><button className="link-button" onClick={() => setModal('invite')}>Tengo una invitación</button></div></div>{modal === 'recover' && <Recover api={api} close={() => setModal('')} />}{modal === 'invite' && <Invite api={api} save={save} close={() => setModal('')} />}</main>;
}

function Shell({ user, page, setPage, logout, children }) { const nav = [['inicio', 'home', 'Inicio'], ['equipos', 'groups', 'Equipos'], ['jugadores', 'person_search', 'Jugadores']]; if (['DIRECTOR', 'SUBDIRECTOR'].includes(user.role)) nav.push(['personal', 'manage_accounts', 'Personal'], ['actividad', 'history', 'Actividad']); nav.push(['perfil', 'account_circle', 'Perfil']); return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><nav className="nav">{nav.map(([key, icon, label]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><i className="nav-icon"><Icon filled={page === key}>{icon}</Icon></i>{label}</button>)}</nav><div className="user-chip"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{role[user.role]}</small></div><button className="signout" title="Cerrar sesión" onClick={logout}><Icon>logout</Icon></button></div></aside><main className="main"><header className="mobile-topbar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><div className="avatar">{initials(user.name)}</div></header>{children}</main></div>; }

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
  const now = new Date();
  const allEvents = data.info.flatMap(({ team, events }) => events.map(event => ({ ...event, teamName: team.name, teamId: team.id }))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const today = allEvents.filter(event => new Date(event.startsAt).toDateString() === now.toDateString());
  const pendingAttendance = allEvents.filter(event => new Date(event.startsAt) < now && !event.attendanceSession).length;
  const pendingPlans = allEvents.filter(event => new Date(event.startsAt) >= now && (event.type || 'TRAINING') === 'TRAINING' && !event.trainingPlan).length;
  const incompletePlayers = data.players.filter(player => !player.position || !player.currentClub).length;
  const firstTeam = data.info[0]?.team;
  return <><Welcome user={user} /><section className="home-quick-actions"><button className="card quick-action" onClick={() => navigate('/equipos')}><Icon>groups</Icon><span><strong>Equipos</strong><small>Gestionar equipos</small></span></button><button className="card quick-action" onClick={() => navigate('/jugadores')}><Icon>person_add</Icon><span><strong>Jugadores</strong><small>Plantel y fichas</small></span></button>{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/agenda`)}><Icon>sports_basketball</Icon><span><strong>Agendar partido</strong><small>{firstTeam.name}</small></span></button>}{firstTeam && <button className="card quick-action" onClick={() => navigate(`/equipos/${firstTeam.id}/asistencia`)}><Icon>fact_check</Icon><span><strong>Asistencia</strong><small>{firstTeam.name}</small></span></button>}</section><p className="section eyebrow">HOY</p><section className="card home-today">{today.length ? today.map(event => <HomeEvent event={event} key={event.id} />) : <div className="home-empty"><Icon>event_available</Icon><span><strong>No hay actividades para hoy</strong><small>La agenda de hoy está libre.</small></span></div>}</section><p className="section eyebrow">PENDIENTES</p><section className="home-pending">{[["fact_check", pendingAttendance, "Asistencias por completar", "Actividades pasadas sin asistencia"], ["event_note", pendingPlans, "Planificaciones pendientes", "Entrenamientos futuros sin planificación"], ["person_search", incompletePlayers, "Fichas por completar", "Jugadores sin posición o club"]].map(([icon, amount, title, description]) => <article className="card pending-card" key={title}><Icon>{icon}</Icon><div><strong>{amount}</strong><span>{title}</span><small>{description}</small></div></article>)}</section><p className="section eyebrow">MIS EQUIPOS</p><div className="home-teams">{data.info.map(({ team, events }) => { const next = events.find(event => new Date(event.startsAt) >= now); return <button className="card team-card interactive-card" key={team.id} onClick={() => navigate(`/equipos/${team.id}`)}><div className="team-mark"><Icon>groups</Icon></div><div><strong>{team.name}</strong><p className="muted">{team.category.name} · {next ? `${next.type === 'MATCH' ? 'Partido' : 'Entrenamiento'} ${new Date(next.startsAt).toLocaleDateString('es-AR', { day:'2-digit', month:'short' })}` : 'Sin próxima actividad'}</p></div><footer>{team._count.players} jugadores</footer></button>; })}</div>{data.activity.length > 0 && <><p className="section eyebrow">ACTIVIDAD RECIENTE</p><section className="card home-activity">{data.activity.map(item => <div className="activity-row" key={item.id}><span className="avatar">{initials(item.actorUser?.name || '?')}</span><span><strong>{item.actorUser?.name || 'Usuario'}</strong><small>{item.action.replaceAll('_', ' ').toLowerCase()} · {new Date(item.createdAt).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</small></span></div>)}</section></>}</>;
}
function HomeEvent({ event }) { const date = new Date(event.startsAt); const isMatch = event.type === 'MATCH'; return <div className="home-event"><div className={`home-event-icon${isMatch ? ' match' : ''}`}><Icon>{isMatch ? 'sports_basketball' : 'fitness_center'}</Icon></div><div><strong>{event.title}</strong><small>{event.teamName} · {date.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</small></div><span className="event-kind">{isMatch ? 'Partido' : 'Entrenamiento'}</span></div>; }
function Welcome({ user }) { return <div className="dashboard-header"><div className="avatar">{initials(user.name)}</div><div><p className="muted">Hola, {user.name}</p><h2>Tu jornada deportiva</h2></div></div>; }

function Teams({ api, director, notify }) { const [teams, setTeams] = useState(), [show, setShow] = useState(''), [error, setError] = useState(''); const load = () => api('/teams').then(setTeams).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!teams) return <Loading />; return <><Header eyebrow="GESTIÓN DEPORTIVA" title="Tus equipos" text="Seleccioná un equipo para gestionar jugadores, asistencia y seguimiento." actions={<><button className="secondary" onClick={() => setShow('birthdays')}>♧ Cumpleaños</button>{director && <button className="secondary" onClick={() => setShow('team')}>＋ Crear equipo</button>}</>} /><div className="grid">{teams.length ? teams.map(t => <article className="card team-card" key={t.id}><div className="team-mark">♟</div><div><strong>{t.name}</strong><p className="muted">{t.category.name}</p></div><footer>{t._count.players} jugadores</footer></article>) : <Empty>Todavía no hay equipos.</Empty>}</div>{show === 'team' && <NewTeam api={api} close={() => setShow('')} done={() => { notify('Equipo creado'); load(); }} />}{show === 'birthdays' && <Birthdays api={api} close={() => setShow('')} />}</>; }

function Players({ api, notify }) { const [data, setData] = useState(), [filter, setFilter] = useState(''), [newPlayer, setNewPlayer] = useState(false), [error, setError] = useState(''); const load = () => Promise.all([api('/players'), api('/teams')]).then(setData).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!data) return <Loading />; const [players, teams] = data, shown = players.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())); return <><Header eyebrow="PLANTEL" title="Jugadores" text="Directorio deportivo de tu organización." actions={<><input className="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre" /><button className="secondary" onClick={() => setNewPlayer(true)}>＋ Crear jugador</button></>} /><div className="list">{shown.map(p => <article className="card player-row" key={p.id}><div className="avatar">{initials(p.name)}</div><div className="row-content"><strong>{p.name}</strong><span>{age(p.birthDate)} años · {p.teams.length ? `${p.teams.length} equipo(s)` : 'Sin equipo'}</span></div><span className="chevron">›</span></article>)}{!shown.length && <Empty>No encontramos jugadores.</Empty>}</div>{newPlayer && <NewPlayer api={api} teams={teams} close={() => setNewPlayer(false)} done={() => { notify('Jugador creado'); load(); }} />}</>; }

function Directory({ api, kind }) { const [items, setItems] = useState(), [error, setError] = useState(''); const path = kind === 'staff' ? '/users' : '/audit-logs'; useEffect(() => { api(path).then(setItems).catch(e => setError(e.message)); }, []); if (error) return <Error message={error} />; if (!items) return <Loading />; const staff = kind === 'staff'; return <><Header eyebrow="ORGANIZACIÓN" title={staff ? 'Personal' : 'Actividad'} text={staff ? 'Miembros que forman parte de tu organización.' : 'Historial reciente de operaciones.'} /><div className="list">{items.map(x => staff ? <article className="card player-row" key={x.id}><div className="avatar">{initials(x.name)}</div><div className="row-content"><strong>{x.name}</strong><span>{x.email}</span></div><span className="role-label">{role[x.role]}</span></article> : <article className="card player-row" key={x.id}><div className="metric-icon">◷</div><div className="row-content"><strong>{x.action.replaceAll('_', ' ')}</strong><span>{new Date(x.createdAt).toLocaleString('es-AR')}</span></div></article>)}</div></>; }
function Profile({ user }) { return <><Header eyebrow="CUENTA" title="Perfil" text="Tu sesión y preferencias de BasketStaff." /><section className="card profile-card"><div className="player-row"><div className="avatar avatar-large">{initials(user.name)}</div><div className="row-content"><strong>{user.name}</strong><span>{user.email}</span><span className="role-label">{role[user.role]}</span></div></div></section></>; }

function Header({ eyebrow, title, text, actions }) { return <header className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="subtitle">{text}</p></div>{actions && <div className="toolbar">{actions}</div>}</header>; }
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
  return <div className="modal-backdrop form-page" onMouseDown={e => e.target === e.currentTarget && dismiss()}><section className="card modal"><div className="modal-head"><div><span className="eyebrow">BASKETSTAFF</span><h2>{title}</h2></div><button className="icon-close" aria-label="Volver" onClick={dismiss}><Icon>arrow_back</Icon></button></div>{children}</section></div>;
}
function Field({ title, children }) { return <label className="field"><span className="eyebrow">{title}</span><span className="input-wrap">{children}</span></label>; }
function Form({ fields, button, submit }) { const [error, setError] = useState(''), [busy, setBusy] = useState(false); return <form className="modal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await submit(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget); } catch (err) { setError(err.message); } setBusy(false); }}>{fields.map(([title, name, type, options]) => <Field key={name} title={title}>{type === 'select' ? <select required name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : type === 'multi' ? <select multiple size="3" name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : <input required name={name} type={type || 'text'} minLength={type === 'password' ? 10 : undefined} />}</Field>)}{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Guardando…' : button}</button></form>; }
function Recover({ api, close }) { const [requested, setRequested] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''); return <Modal title="Recuperar acceso" close={close}><form className="modal-form" onSubmit={async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { if (!requested) { const result = await api('/auth/forgot-password', { method:'POST', body:JSON.stringify({ email:data.email }) }); setMessage(result.message); if (result.resetToken) { event.currentTarget.resetToken.value = result.resetToken; } setRequested(true); } else { await api('/auth/reset-password', { method:'POST', body:JSON.stringify({ resetToken:data.resetToken, newPassword:data.newPassword }) }); setMessage('Contraseña actualizada. Ya podés iniciar sesión.'); } } catch (err) { setError(err.message); } }}><Field title="CORREO ELECTRÓNICO"><input required name="email" type="email" disabled={requested} /></Field>{requested && <><Field title="CÓDIGO DE RECUPERACIÓN"><input required name="resetToken" minLength="32" /></Field><Field title="NUEVA CONTRASEÑA"><input required name="newPassword" type="password" minLength="10" /></Field></>}<p className="notice">{message}</p>{error && <p className="error">{error}</p>}<button className="primary">{requested ? 'Cambiar contraseña' : 'Solicitar código'}</button></form></Modal>; }
function Invite({ api, save, close }) { return <Modal title="Aceptar invitación" close={close}><Form fields={[["CÓDIGO DE INVITACIÓN", 'invitationToken'], ['EMAIL INVITADO', 'email', 'email'], ['NOMBRE', 'name'], ['CONTRASEÑA', 'password', 'password']]} button="Crear cuenta" submit={async data => { save(await api('/auth/accept-invitation', { method: 'POST', body: JSON.stringify(data) })); close(); }} /></Modal>; }
function NewTeam({ api, close, done }) { const [categories, setCategories] = useState(); useEffect(() => { api('/categories').then(setCategories); }, []); return <Modal title="Crear equipo" close={close}>{categories ? <Form fields={[["NOMBRE DEL EQUIPO", 'name'], ['CATEGORÍA', 'categoryId', 'select', categories]]} button="Crear equipo" submit={async data => { await api('/teams', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /> : <Loading />}</Modal>; }
function NewPlayer({ api, teams, close, done }) { return <Modal title="Crear jugador" close={close}><Form fields={[["NOMBRE COMPLETO", 'name'], ['FECHA DE NACIMIENTO', 'birthDate', 'date'], ['EQUIPOS (OPCIONAL)', 'teamIds', 'multi', teams]]} button="Crear jugador" submit={async (data, form) => { data.teamIds = [...form.elements.teamIds.selectedOptions].map(x => x.value); await api('/players', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /></Modal>; }
function Birthdays({ api, close }) { const [items, setItems] = useState(); useEffect(() => { api('/birthdays?days=30').then(setItems); }, []); return <Modal title="Próximos cumpleaños" close={close}>{!items ? <Loading /> : <div className="list">{items.map(b => { const d = new Date(b.nextBirthday); return <article className="card event" key={b.id}><div className="date-badge"><b>{d.getUTCDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</div><div className="event-content"><strong>{b.name}</strong><span>{b.daysUntil === 0 ? `Cumple hoy · ${b.turningAge} años` : `En ${b.daysUntil} días · cumple ${b.turningAge}`}</span></div></article>; })}</div>}</Modal>; }
function Event({ event }) { const d = new Date(event.startsAt); return <article className="card event"><div className="date-badge"><b>{d.getDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}</div><div className="event-content"><strong>{event.title}</strong><span className="role-label">{event.teamName}</span><span>{d.toLocaleString('es-AR')}</span></div><span className="chevron">›</span></article>; }
function Loading({ rows = 4 }) { return <section className="skeleton-page" aria-busy="true" aria-label="Cargando contenido"><div className="skeleton skeleton-kicker" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-subtitle" /><div className="skeleton-list">{Array.from({ length: rows }, (_, index) => <div className="card skeleton-card" key={index}><div className="skeleton skeleton-avatar" /><div className="skeleton-card-copy"><div className="skeleton skeleton-line skeleton-line-long" /><div className="skeleton skeleton-line skeleton-line-short" /></div></div>)}</div><span className="sr-only">Cargando contenido</span></section>; } function Empty({ children }) { return <div className="card empty">{children}</div>; } function Error({ message }) { return <Header eyebrow="BASKETSTAFF" title="No pudimos cargar esta vista" text={message} />; } function Toast({ text }) { return text ? <div className="toast">{text}</div> : null; }
createRoot(document.getElementById('app')).render(<App />);
