import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { AccountWorkspace, PlayerWorkspace, StaffWorkspace, TeamWorkspace } from './operations.jsx';

// En local usamos el proxy de Vite. En producción nunca debe apuntar a /api,
// porque la SPA se sirve desde ese mismo dominio y respondería 405 al hacer POST.
const configuredApi = import.meta.env.VITE_API_URL;
const API = ((import.meta.env.PROD && (!configuredApi || configuredApi === '/api'))
  ? 'https://backend-ios-nu.vercel.app'
  : (configuredApi || '/api')).replace(/\/$/, '');
const SESSION = 'basketstaff.session';
const role = { DIRECTOR: 'Director', COACH: 'Entrenador', MONITOR: 'Monitor' };
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
  if (!session) return <><Auth api={api} save={save} /><Toast text={toast} /></>;
  const handleSignOut = async () => { try { await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }) }); } finally { logout(); } };
  const page = route.page === 'inicio' ? 'inicio' : route.page;
  const pagePath = key => key === 'inicio' ? '/' : `/${key}`;
  return <><Shell user={session.user} page={page} setPage={key => navigate(pagePath(key))} logout={handleSignOut}>
    {page === 'inicio' && <Home api={api} user={session.user} />}
    {page === 'equipos' && <TeamWorkspace api={api} director={session.user.role === 'DIRECTOR'} notify={notify} teamId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'jugadores' && <PlayerWorkspace api={api} notify={notify} playerId={route.id} tab={route.tab} navigate={navigate} />}
    {page === 'personal' && <StaffWorkspace api={api} notify={notify} />}
    {page === 'actividad' && <Directory api={api} kind="activity" />}
    {page === 'perfil' && <AccountWorkspace api={api} user={session.user} signOut={logout} />}
  </Shell><Toast text={toast} /></>;
}

function Auth({ api, save }) {
  const [register, setRegister] = useState(false), [error, setError] = useState(''), [modal, setModal] = useState('');
  async function submit(event) { event.preventDefault(); setError(''); try { save(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })); } catch (err) { setError(err.message); } }
  return <main className="auth-shell"><div className="auth-content"><header className="brand-header"><div className="brand-icon"><Icon filled>sports_basketball</Icon></div><h1>{register ? 'Creá tu cuenta' : 'BasketStaff'}</h1><p className="subtitle">{register ? 'Unite a la comunidad de entrenadores.' : 'Bienvenido de nuevo'}</p></header><form className="card form-card" onSubmit={submit}>{register && <><Field title="NOMBRE COMPLETO"><input required name="name" placeholder="Ej. Carlos Martínez" /></Field><Field title="NOMBRE DE LA COMPAÑÍA"><input required name="organizationName" placeholder="Ej. Club Central" /></Field></>}<Field title="CORREO ELECTRÓNICO"><input required type="email" name="email" placeholder="entrenador@equipo.com" /></Field><Field title="CONTRASEÑA"><input required minLength="10" type="password" name="password" placeholder="••••••••" /></Field>{!register && <button className="link-button" type="button" onClick={() => setModal('recover')}>¿Olvidaste tu contraseña?</button>}{error && <p className="error">{error}</p>}<button className="primary">{register ? 'Crear cuenta' : 'Iniciar sesión'}</button></form><div className="auth-actions"><button className="link-button" onClick={() => setRegister(!register)}>{register ? '¿Ya tenés una cuenta? Iniciá sesión' : '¿No tenés una cuenta? Crear cuenta'}</button><button className="link-button" onClick={() => setModal('invite')}>Tengo una invitación</button></div></div>{modal === 'recover' && <Recover api={api} close={() => setModal('')} />}{modal === 'invite' && <Invite api={api} save={save} close={() => setModal('')} />}</main>;
}

function Shell({ user, page, setPage, logout, children }) { const nav = user.role === 'MONITOR' ? [['inicio', 'home', 'Inicio']] : [['inicio', 'home', 'Inicio'], ['equipos', 'groups', 'Equipos'], ['jugadores', 'person_search', 'Jugadores']]; if (user.role === 'DIRECTOR') nav.push(['personal', 'manage_accounts', 'Personal'], ['actividad', 'history', 'Actividad']); nav.push(['perfil', 'account_circle', 'Perfil']); return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><nav className="nav">{nav.map(([key, icon, label]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><i className="nav-icon"><Icon filled={page === key}>{icon}</Icon></i>{label}</button>)}</nav><div className="user-chip"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{role[user.role]}</small></div><button className="signout" title="Cerrar sesión" onClick={logout}><Icon>logout</Icon></button></div></aside><main className="main"><header className="mobile-topbar"><div className="sidebar-brand"><span><Icon filled>sports_basketball</Icon></span> BasketStaff</div><div className="avatar">{initials(user.name)}</div></header>{children}</main></div>; }

function Home({ api, user }) { const [data, setData] = useState(), [error, setError] = useState(''); useEffect(() => { (async () => { try { if (user.role === 'MONITOR') return setData({ monitor: await api('/entry-context') }); const teams = await api('/teams'); const info = await Promise.all(teams.map(async team => ({ team, statistics: await api(`/teams/${team.id}/statistics`).catch(() => null), events: await api(`/teams/${team.id}/events`).catch(() => []) }))); setData({ info }); } catch (err) { setError(err.message); } })(); }, []); if (error) return <Error message={error} />; if (!data) return <Loading />; if (data.monitor) return <><Welcome user={user} /><p className="section eyebrow">EQUIPOS ASIGNADOS</p><div className="grid">{data.monitor.map(t => <article className="card team-card" key={t.id}><div className="team-mark">♟</div><strong>{t.name}</strong><p className="muted">{t.players.length} jugadores asignados</p></article>)}</div></>;
  const present = data.info.reduce((n, x) => n + (x.statistics?.summary?.present || 0), 0), total = data.info.reduce((n, x) => n + (x.statistics?.summary?.totalRecords || 0), 0), events = data.info.flatMap(x => x.events.filter(e => new Date(e.startsAt) > new Date()).map(e => ({ ...e, teamName: x.team.name }))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 6);
  return <><Welcome user={user} /><p className="section eyebrow">ASISTENCIA GLOBAL</p>{total ? <div className="card metric-card"><div><div className="metric-value">{Math.round(100 * present / total)}%</div><p className="muted">de asistencia total</p><small className="muted">{present} presentes de {total} registros</small></div><div className="metric-icon">♟</div></div> : <Empty>📅 Planificá los entrenamientos para poder tomar asistencia.</Empty>}<p className="section eyebrow">PRÓXIMOS ENTRENAMIENTOS</p><div className="list">{events.length ? events.map(e => <Event event={e} key={e.id} />) : <Empty>📆 No hay entrenamientos próximos.</Empty>}</div></>;
}
function Welcome({ user }) { return <div className="dashboard-header"><div className="avatar">{initials(user.name)}</div><div><p className="muted">Hola, {user.name}</p><h2>Resumen de tu equipo</h2></div></div>; }

function Teams({ api, director, notify }) { const [teams, setTeams] = useState(), [show, setShow] = useState(''), [error, setError] = useState(''); const load = () => api('/teams').then(setTeams).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!teams) return <Loading />; return <><Header eyebrow="GESTIÓN DEPORTIVA" title="Tus equipos" text="Seleccioná un equipo para gestionar jugadores, asistencia y seguimiento." actions={<><button className="secondary" onClick={() => setShow('birthdays')}>♧ Cumpleaños</button>{director && <button className="secondary" onClick={() => setShow('team')}>＋ Crear equipo</button>}</>} /><div className="grid">{teams.length ? teams.map(t => <article className="card team-card" key={t.id}><div className="team-mark">♟</div><div><strong>{t.name}</strong><p className="muted">{t.category.name}</p></div><footer>{t._count.players} jugadores</footer></article>) : <Empty>Todavía no hay equipos.</Empty>}</div>{show === 'team' && <NewTeam api={api} close={() => setShow('')} done={() => { notify('Equipo creado'); load(); }} />}{show === 'birthdays' && <Birthdays api={api} close={() => setShow('')} />}</>; }

function Players({ api, notify }) { const [data, setData] = useState(), [filter, setFilter] = useState(''), [newPlayer, setNewPlayer] = useState(false), [error, setError] = useState(''); const load = () => Promise.all([api('/players'), api('/teams')]).then(setData).catch(e => setError(e.message)); useEffect(() => { void load(); }, []); if (error) return <Error message={error} />; if (!data) return <Loading />; const [players, teams] = data, shown = players.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())); return <><Header eyebrow="PLANTEL" title="Jugadores" text="Directorio deportivo de tu organización." actions={<><input className="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre" /><button className="secondary" onClick={() => setNewPlayer(true)}>＋ Crear jugador</button></>} /><div className="list">{shown.map(p => <article className="card player-row" key={p.id}><div className="avatar">{initials(p.name)}</div><div className="row-content"><strong>{p.name}</strong><span>{age(p.birthDate)} años · {p.teams.length ? `${p.teams.length} equipo(s)` : 'Sin equipo'}</span></div><span className="chevron">›</span></article>)}{!shown.length && <Empty>No encontramos jugadores.</Empty>}</div>{newPlayer && <NewPlayer api={api} teams={teams} close={() => setNewPlayer(false)} done={() => { notify('Jugador creado'); load(); }} />}</>; }

function Directory({ api, kind }) { const [items, setItems] = useState(), [error, setError] = useState(''); const path = kind === 'staff' ? '/users' : '/audit-logs'; useEffect(() => { api(path).then(setItems).catch(e => setError(e.message)); }, []); if (error) return <Error message={error} />; if (!items) return <Loading />; const staff = kind === 'staff'; return <><Header eyebrow="ORGANIZACIÓN" title={staff ? 'Personal' : 'Actividad'} text={staff ? 'Miembros que forman parte de tu organización.' : 'Historial reciente de operaciones.'} /><div className="list">{items.map(x => staff ? <article className="card player-row" key={x.id}><div className="avatar">{initials(x.name)}</div><div className="row-content"><strong>{x.name}</strong><span>{x.email}</span></div><span className="role-label">{role[x.role]}</span></article> : <article className="card player-row" key={x.id}><div className="metric-icon">◷</div><div className="row-content"><strong>{x.action.replaceAll('_', ' ')}</strong><span>{new Date(x.createdAt).toLocaleString('es-AR')}</span></div></article>)}</div></>; }
function Profile({ user }) { return <><Header eyebrow="CUENTA" title="Perfil" text="Tu sesión y preferencias de BasketStaff." /><section className="card profile-card"><div className="player-row"><div className="avatar avatar-large">{initials(user.name)}</div><div className="row-content"><strong>{user.name}</strong><span>{user.email}</span><span className="role-label">{role[user.role]}</span></div></div></section></>; }

function Header({ eyebrow, title, text, actions }) { return <header className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="subtitle">{text}</p></div>{actions && <div className="toolbar">{actions}</div>}</header>; }
function Modal({ title, close, children }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className="card modal"><div className="modal-head"><h2>{title}</h2><button className="icon-close" aria-label="Cerrar" onClick={close}><Icon>close</Icon></button></div>{children}</section></div>; }
function Field({ title, children }) { return <label className="field"><span className="eyebrow">{title}</span><span className="input-wrap">{children}</span></label>; }
function Form({ fields, button, submit }) { const [error, setError] = useState(''), [busy, setBusy] = useState(false); return <form className="modal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await submit(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget); } catch (err) { setError(err.message); } setBusy(false); }}>{fields.map(([title, name, type, options]) => <Field key={name} title={title}>{type === 'select' ? <select required name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : type === 'multi' ? <select multiple size="3" name={name}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : <input required name={name} type={type || 'text'} minLength={type === 'password' ? 10 : undefined} />}</Field>)}{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Guardando…' : button}</button></form>; }
function Recover({ api, close }) { const [requested, setRequested] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''); return <Modal title="Recuperar acceso" close={close}><form className="modal-form" onSubmit={async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { if (!requested) { const result = await api('/auth/forgot-password', { method:'POST', body:JSON.stringify({ email:data.email }) }); setMessage(result.message); if (result.resetToken) { event.currentTarget.resetToken.value = result.resetToken; } setRequested(true); } else { await api('/auth/reset-password', { method:'POST', body:JSON.stringify({ resetToken:data.resetToken, newPassword:data.newPassword }) }); setMessage('Contraseña actualizada. Ya podés iniciar sesión.'); } } catch (err) { setError(err.message); } }}><Field title="CORREO ELECTRÓNICO"><input required name="email" type="email" disabled={requested} /></Field>{requested && <><Field title="CÓDIGO DE RECUPERACIÓN"><input required name="resetToken" minLength="32" /></Field><Field title="NUEVA CONTRASEÑA"><input required name="newPassword" type="password" minLength="10" /></Field></>}<p className="notice">{message}</p>{error && <p className="error">{error}</p>}<button className="primary">{requested ? 'Cambiar contraseña' : 'Solicitar código'}</button></form></Modal>; }
function Invite({ api, save, close }) { return <Modal title="Aceptar invitación" close={close}><Form fields={[["CÓDIGO DE INVITACIÓN", 'invitationToken'], ['EMAIL INVITADO', 'email', 'email'], ['NOMBRE', 'name'], ['CONTRASEÑA', 'password', 'password']]} button="Crear cuenta" submit={async data => { save(await api('/auth/accept-invitation', { method: 'POST', body: JSON.stringify(data) })); close(); }} /></Modal>; }
function NewTeam({ api, close, done }) { const [categories, setCategories] = useState(); useEffect(() => { api('/categories').then(setCategories); }, []); return <Modal title="Crear equipo" close={close}>{categories ? <Form fields={[["NOMBRE DEL EQUIPO", 'name'], ['CATEGORÍA', 'categoryId', 'select', categories]]} button="Crear equipo" submit={async data => { await api('/teams', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /> : <Loading />}</Modal>; }
function NewPlayer({ api, teams, close, done }) { return <Modal title="Crear jugador" close={close}><Form fields={[["NOMBRE COMPLETO", 'name'], ['FECHA DE NACIMIENTO', 'birthDate', 'date'], ['EQUIPOS (OPCIONAL)', 'teamIds', 'multi', teams]]} button="Crear jugador" submit={async (data, form) => { data.teamIds = [...form.elements.teamIds.selectedOptions].map(x => x.value); await api('/players', { method: 'POST', body: JSON.stringify(data) }); close(); done(); }} /></Modal>; }
function Birthdays({ api, close }) { const [items, setItems] = useState(); useEffect(() => { api('/birthdays?days=30').then(setItems); }, []); return <Modal title="Próximos cumpleaños" close={close}>{!items ? <Loading /> : <div className="list">{items.map(b => { const d = new Date(b.nextBirthday); return <article className="card event" key={b.id}><div className="date-badge"><b>{d.getUTCDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</div><div className="event-content"><strong>{b.name}</strong><span>{b.daysUntil === 0 ? `Cumple hoy · ${b.turningAge} años` : `En ${b.daysUntil} días · cumple ${b.turningAge}`}</span></div></article>; })}</div>}</Modal>; }
function Event({ event }) { const d = new Date(event.startsAt); return <article className="card event"><div className="date-badge"><b>{d.getDate()}</b>{d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}</div><div className="event-content"><strong>{event.title}</strong><span className="role-label">{event.teamName}</span><span>{d.toLocaleString('es-AR')}</span></div><span className="chevron">›</span></article>; }
function Loading() { return <div className="loading">Cargando…</div>; } function Empty({ children }) { return <div className="card empty">{children}</div>; } function Error({ message }) { return <Header eyebrow="BASKETSTAFF" title="No pudimos cargar esta vista" text={message} />; } function Toast({ text }) { return text ? <div className="toast">{text}</div> : null; }
createRoot(document.getElementById('app')).render(<App />);
