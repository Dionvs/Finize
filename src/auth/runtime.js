/*
THESIS: Inloggen is een rustige drempel voor dezelfde vertrouwde Finize-app, geen nieuwe productwereld.
OWN-WORLD: Bestaande lichte blauwtinten, afgeronde Finize-kaarten, heldere velden en één blauwe hoofdactie.
STORY: De gebruiker kiest een inlogroute, bevestigt zo nodig het adres en ziet daarna pas de financiële app.
FIRST VIEWPORT: Logo en korte belofte links, compact inlogformulier rechts; mobiel wordt dit één directe kolom.
FORM: Geërfde Operate-interface; lokaal uitgebreid zonder wijziging van het bestaande dashboard.
*/

import { AUTH_RELEASE_ENABLED, DEFAULT_FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from '../config/firebase.js';
import { accountLinkDocumentId, authAccessState, memberProfileSeed, normalizeAssignment, persistenceMode } from './contracts.mjs';

const localPreview = ['localhost','127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).get('auth-preview') === '1';
const enabled = globalThis.__FINIZE_AUTH_ENABLED__ === true || localPreview || AUTH_RELEASE_ENABLED;
const root = document.getElementById('authRoot');
let resolveGate;
let currentUser = null;
let currentAssignment = null;
let mode = 'login';
let busy = false;
let driver = null;

const gate = new Promise(resolve=>{ resolveGate = resolve; });
globalThis.__finizeAuthGate = gate;

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function authErrorMessage(error){
  const code = String(error?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Het e-mailadres of wachtwoord klopt niet.';
  if (code.includes('email-already-in-use')) return 'Voor dit e-mailadres bestaat al een account. Log in of herstel je wachtwoord.';
  if (code.includes('weak-password')) return 'Kies een wachtwoord van minimaal zes tekens.';
  if (code.includes('invalid-email')) return 'Vul een geldig e-mailadres in.';
  if (code.includes('popup-closed')) return 'Google-inloggen is gesloten voordat het klaar was.';
  if (code.includes('network-request-failed')) return 'Er is geen verbinding. Controleer je internet en probeer opnieuw.';
  if (code.includes('too-many-requests')) return 'Er zijn te veel pogingen gedaan. Wacht even en probeer daarna opnieuw.';
  return String(error?.message || 'Inloggen is niet gelukt. Probeer het opnieuw.');
}

function setFeedback(message='', tone='neutral'){
  const target = root?.querySelector('[data-auth-feedback]');
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
  target.hidden = !message;
}

function setBusy(nextBusy){
  busy = !!nextBusy;
  root?.querySelectorAll('button,input').forEach(element=>{
    if (element.matches('[data-auth-stay]')) return;
    element.disabled = busy;
  });
  root?.setAttribute('aria-busy', String(busy));
}

function signInMarkup(){
  const creating = mode === 'register';
  return `
    <section class="auth-layout" aria-labelledby="authTitle">
      <div class="auth-intro">
        <img src="finize-logo.png" alt="Finize" class="auth-logo">
        <div>
          <p class="auth-kicker">Jullie financiën, vertrouwd bij elkaar</p>
          <h1 id="authTitle">${creating ? 'Maak je persoonlijke account' : 'Welkom terug'}</h1>
          <p>Log in voor je eigen overzicht en hetzelfde gezamenlijke huishouden dat je al kent.</p>
        </div>
        <ul class="auth-assurances" aria-label="Wat je kunt verwachten">
          <li><span aria-hidden="true">✓</span> Dezelfde bedragen en verdelingen</li>
          <li><span aria-hidden="true">✓</span> Je persoonlijke tab blijft van jou</li>
          <li><span aria-hidden="true">✓</span> Veilig synchroniseren tussen apparaten</li>
        </ul>
      </div>
      <div class="auth-panel">
        <div class="auth-panel-head">
          <h2>${creating ? 'Account aanmaken' : 'Inloggen'}</h2>
          <p>${creating ? 'Gebruik het e-mailadres dat aan Finize is gekoppeld.' : 'Ga verder met Google of je e-mailadres.'}</p>
        </div>
        <button type="button" class="auth-google" data-auth-google>
          <span class="auth-google-mark" aria-hidden="true">G</span>
          Doorgaan met Google
        </button>
        <div class="auth-divider"><span>of met e-mail</span></div>
        <form data-auth-form novalidate>
          <label>E-mailadres
            <input name="email" type="email" inputmode="email" autocomplete="email" required>
          </label>
          <label>Wachtwoord
            <input name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" minlength="6" required>
          </label>
          <label class="auth-stay">
            <input data-auth-stay name="staySignedIn" type="checkbox" checked>
            <span><strong>Ingelogd blijven</strong><small>Handig op je eigen telefoon of computer.</small></span>
          </label>
          <div class="auth-feedback" data-auth-feedback role="status" aria-live="polite" hidden></div>
          <button type="submit" class="primary auth-submit">${creating ? 'Account aanmaken' : 'Inloggen'}</button>
        </form>
        <div class="auth-secondary-actions">
          ${creating ? '' : '<button type="button" class="auth-text-button" data-auth-reset>Wachtwoord vergeten?</button>'}
          <button type="button" class="auth-text-button" data-auth-toggle>${creating ? 'Ik heb al een account' : 'Nieuw account aanmaken'}</button>
        </div>
      </div>
    </section>`;
}

function verificationMarkup(){
  return `
    <section class="auth-state-card" aria-labelledby="authTitle">
      <div class="auth-state-icon" aria-hidden="true">@</div>
      <p class="auth-kicker">Nog één stap</p>
      <h1 id="authTitle">Bevestig je e-mailadres</h1>
      <p>We hebben een bevestigingslink gestuurd naar <strong>${escapeHtml(currentUser?.email)}</strong>. Open de link en controleer daarna opnieuw.</p>
      <div class="auth-feedback" data-auth-feedback role="status" aria-live="polite" hidden></div>
      <div class="auth-state-actions">
        <button type="button" class="primary" data-auth-check>Ik heb mijn e-mail bevestigd</button>
        <button type="button" class="ghost" data-auth-resend>Link opnieuw sturen</button>
        <button type="button" class="auth-text-button" data-auth-signout>Met een ander account inloggen</button>
      </div>
    </section>`;
}

function unassignedMarkup(){
  return `
    <section class="auth-state-card" aria-labelledby="authTitle">
      <div class="auth-state-icon" aria-hidden="true">⌛</div>
      <p class="auth-kicker">Account bevestigd</p>
      <h1 id="authTitle">Je Finize-koppeling wordt voorbereid</h1>
      <p><strong>${escapeHtml(currentUser?.email)}</strong> is veilig ingelogd, maar nog niet aan Dion of Dara gekoppeld. Probeer opnieuw nadat de huishoudkoppeling is gepubliceerd.</p>
      <div class="auth-feedback" data-auth-feedback role="status" aria-live="polite" hidden></div>
      <div class="auth-state-actions">
        <button type="button" class="primary" data-auth-check>Opnieuw controleren</button>
        <button type="button" class="auth-text-button" data-auth-signout>Uitloggen</button>
      </div>
    </section>`;
}

function bindCommonActions(){
  root.querySelector('[data-auth-signout]')?.addEventListener('click', ()=>runAction(()=>driver.signOut()));
  root.querySelector('[data-auth-check]')?.addEventListener('click', ()=>runAction(async()=>{
    currentUser = await driver.reloadUser(currentUser);
    currentAssignment = currentUser?.emailVerified ? normalizeAssignment(await driver.loadAssignment(currentUser)) : null;
    render();
  }));
  root.querySelector('[data-auth-resend]')?.addEventListener('click', ()=>runAction(async()=>{
    await driver.sendVerification(currentUser);
    setFeedback('Een nieuwe bevestigingslink is verstuurd.', 'success');
  }));
}

function bindSignInActions(){
  root.querySelector('[data-auth-toggle]')?.addEventListener('click', ()=>{
    mode = mode === 'login' ? 'register' : 'login';
    render();
  });
  root.querySelector('[data-auth-google]')?.addEventListener('click', ()=>runAction(async()=>{
    const stay = root.querySelector('[data-auth-stay]')?.checked !== false;
    await driver.setPersistence(persistenceMode(stay));
    await driver.signInGoogle({redirect:matchMedia('(max-width: 767px)').matches || matchMedia('(display-mode: standalone)').matches});
  }));
  root.querySelector('[data-auth-reset]')?.addEventListener('click', ()=>{
    const email = root.querySelector('input[name="email"]')?.value.trim();
    if (!email){ setFeedback('Vul eerst je e-mailadres in.', 'error'); return; }
    runAction(async()=>{
      await driver.sendPasswordReset(email);
      setFeedback('Als dit adres bekend is, ontvang je een herstelmail.', 'success');
    });
  });
  root.querySelector('[data-auth-form]')?.addEventListener('submit', event=>{
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    runAction(async()=>{
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      await driver.setPersistence(persistenceMode(form.elements.staySignedIn.checked));
      if (mode === 'register'){
        const credential = await driver.registerEmail(email, password);
        await driver.sendVerification(credential?.user || currentUser);
      }else{
        await driver.signInEmail(email, password);
      }
    });
  });
}

function render(){
  if (!root) return;
  const access = authAccessState(currentUser, currentAssignment);
  if (access === 'ready'){
    root.hidden = true;
    document.body.classList.remove('auth-pending');
    document.body.dataset.authRole = currentAssignment.role;
    globalThis.dispatchEvent(new CustomEvent('finize:auth-ready',{detail:{user:currentUser,assignment:currentAssignment}}));
    resolveGate?.({status:'ready',user:currentUser,assignment:currentAssignment});
    resolveGate = null;
    return;
  }
  document.body.classList.add('auth-pending');
  root.hidden = false;
  root.innerHTML = access === 'unverified' ? verificationMarkup() : access === 'unassigned' ? unassignedMarkup() : signInMarkup();
  bindCommonActions();
  if (access === 'signed-out') bindSignInActions();
}

async function runAction(action){
  if (busy) return;
  setBusy(true);
  setFeedback('Even bezig…');
  try{ await action(); }
  catch(error){ setFeedback(authErrorMessage(error), 'error'); }
  finally{ setBusy(false); }
}

async function createFirebaseDriver(){
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`)
  ]);
  const app = appModule.getApps().length ? appModule.getApps()[0] : appModule.initializeApp(DEFAULT_FIREBASE_CONFIG);
  const auth = authModule.getAuth(app);
  const database = firestoreModule.getFirestore(app);

  async function ensureMemberProfile(user, assignment){
    const seed = memberProfileSeed(user, assignment);
    if (!seed) return null;
    const reference = firestoreModule.doc(database,'households',seed.householdId,'members',seed.uid);
    const snapshot = await firestoreModule.getDoc(reference);
    if (snapshot.exists()) return snapshot.data();
    const now = firestoreModule.serverTimestamp();
    await firestoreModule.setDoc(reference,{...seed,joinedAt:now,updatedAt:now});
    return seed;
  }

  return {
    initialize(onUser){ return authModule.onAuthStateChanged(auth, async user=>{
      currentUser = user;
      currentAssignment = user?.emailVerified ? normalizeAssignment(await this.loadAssignment(user)) : null;
      onUser();
    }); },
    setPersistence(modeName){ return authModule.setPersistence(auth, modeName === 'local' ? authModule.browserLocalPersistence : authModule.browserSessionPersistence); },
    signInEmail(email,password){ return authModule.signInWithEmailAndPassword(auth,email,password); },
    registerEmail(email,password){ return authModule.createUserWithEmailAndPassword(auth,email,password); },
    async signInGoogle({redirect}){
      const provider = new authModule.GoogleAuthProvider();
      return redirect ? authModule.signInWithRedirect(auth,provider) : authModule.signInWithPopup(auth,provider);
    },
    sendPasswordReset(email){ return authModule.sendPasswordResetEmail(auth,email); },
    sendVerification(user){ return authModule.sendEmailVerification(user); },
    async reloadUser(user){ await authModule.reload(user); return auth.currentUser; },
    signOut(){ return authModule.signOut(auth); },
    async loadAssignment(user){
      const documentId = accountLinkDocumentId(user?.email);
      if (!user?.emailVerified || !documentId) return null;
      const snapshot = await firestoreModule.getDoc(firestoreModule.doc(database,'accountLinks',documentId));
      if (!snapshot.exists()) return null;
      const assignment = normalizeAssignment(snapshot.data());
      if (!assignment) return null;
      await ensureMemberProfile(user,assignment);
      return assignment;
    }
  };
}

async function initialize(){
  if (!enabled){
    root?.setAttribute('hidden','');
    document.body.classList.remove('auth-pending');
    resolveGate?.({status:'disabled'});
    resolveGate = null;
    return;
  }
  try{
    driver = globalThis.__FINIZE_AUTH_TEST_DRIVER__ || await createFirebaseDriver();
    driver.initialize(()=>render());
  }catch(error){
    document.body.classList.add('auth-pending');
    root.hidden = false;
    root.innerHTML = `<section class="auth-state-card"><div class="auth-state-icon" aria-hidden="true">!</div><h1>Inloggen kon niet worden gestart</h1><p>${escapeHtml(authErrorMessage(error))}</p><button type="button" class="primary" onclick="location.reload()">Opnieuw proberen</button></section>`;
  }
}

globalThis.FinizeAuth = {
  get enabled(){ return enabled; },
  get user(){ return currentUser; },
  get assignment(){ return currentAssignment; },
  signOut:()=>driver?.signOut()
};

initialize();
