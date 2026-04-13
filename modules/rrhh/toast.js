/* ============================================================
   TOAST & CONFIRM — Notificaciones no-bloqueantes
   ============================================================ */

function toast(msg, type='success', duration=3500) {
    const icons = {success:'&#9989;',error:'&#10060;',warning:'&#9888;&#65039;',info:'&#8505;&#65039;'};
    const titles = {success:'Correcto',error:'Error',warning:'Atención',info:'Información'};
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast toast-'+type;
    t.innerHTML = `<div class="toast-icon">${icons[type]}</div><div class="toast-content"><div class="toast-title">${titles[type]}</div><div class="toast-msg">${msg}</div></div><button class="toast-close" onclick="this.parentElement.classList.add('removing');setTimeout(()=>this.parentElement.remove(),300)">&times;</button><div class="toast-progress" style="width:100%"></div>`;
    container.appendChild(t);
    const bar = t.querySelector('.toast-progress');
    bar.style.transitionDuration = duration+'ms';
    requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.width='0%'));
    setTimeout(()=>{t.classList.add('removing');setTimeout(()=>t.remove(),300)},duration);
}

function showConfirm(msg, onYes, onNo) {
    const ov = document.createElement('div');
    ov.className = 'confirm-overlay';
    ov.innerHTML = `<div class="confirm-box"><div class="confirm-icon">&#9888;&#65039;</div><div class="confirm-title">Confirmar acción</div><div class="confirm-msg">${msg}</div><div class="confirm-btns"><button class="btn btn-secondary" id="cfmNo">Cancelar</button><button class="btn btn-primary" id="cfmYes">Aceptar</button></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));
    ov.querySelector('#cfmYes').onclick = ()=>{ov.classList.remove('show');setTimeout(()=>ov.remove(),200);if(onYes)onYes();};
    ov.querySelector('#cfmNo').onclick = ()=>{ov.classList.remove('show');setTimeout(()=>ov.remove(),200);if(onNo)onNo();};
    ov.addEventListener('click',e=>{if(e.target===ov){ov.classList.remove('show');setTimeout(()=>ov.remove(),200);if(onNo)onNo();}});
}
