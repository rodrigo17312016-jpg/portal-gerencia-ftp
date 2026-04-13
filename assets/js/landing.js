/* ════════════════════════════════════════════════════════
   LANDING.JS - Pagina Web Corporativa
   Frutos Tropicales Peru Export S.A.C.
   ════════════════════════════════════════════════════════ */

/* ── PRELOADER ── */
!function(){
  var bar=document.getElementById('preloaderBar'),
      pct=document.getElementById('preloaderPercent'),
      preloader=document.getElementById('preloader'),
      pageContent=document.getElementById('pageContent'),
      duration=5000, start=performance.now();

  var plColors=['gold','green','orange','white'];
  var plBg=preloader.querySelector('.preloader-bg');
  for(var i=0;i<50;i++){
    var p=document.createElement('div');
    p.className='pl-particle '+plColors[Math.floor(Math.random()*plColors.length)];
    var sz=Math.random()*4+1;
    p.style.cssText='left:'+Math.random()*100+'%;animation-duration:'+(Math.random()*5+3)+'s;animation-delay:-'+Math.random()*6+'s;width:'+sz+'px;height:'+sz+'px';
    plBg.appendChild(p);
  }

  for(var i=0;i<16;i++){
    var s=document.createElement('div');
    s.className='preloader-sparkle';
    var angle=(i/16)*360, radius=200+Math.random()*80;
    var cx=50+Math.cos(angle*Math.PI/180)*(radius/window.innerWidth*100);
    var cy=50+Math.sin(angle*Math.PI/180)*(radius/window.innerHeight*100);
    s.style.cssText='left:'+cx+'%;top:'+cy+'%;animation-delay:'+(Math.random()*2)+'s;animation-duration:'+(Math.random()*1.5+1.5)+'s;width:'+(Math.random()*3+2)+'px;height:'+(Math.random()*3+2)+'px';
    preloader.appendChild(s);
  }

  function tick(now){
    var elapsed=now-start;
    var eased=1-Math.pow(1-Math.min(elapsed/duration,1),3);
    var visual=Math.round(eased*100);
    bar.style.width=visual+'%';
    pct.textContent=visual+'%';
    if(elapsed<duration){ requestAnimationFrame(tick); }
    else{
      bar.style.width='100%'; pct.textContent='100%';
      setTimeout(function(){
        preloader.classList.add('fade-out');
        document.body.classList.remove('loading');
        setTimeout(function(){
          preloader.style.display='none';
          pageContent.classList.add('visible');
          setTimeout(function(){
            document.querySelectorAll('.hero-content .reveal').forEach(function(el){el.classList.add('revealed')});
          },200);
        },800);
      },400);
    }
  }
  requestAnimationFrame(tick);
}();

/* ── FLOATING FRUITS ── */
!function(){
  var fruits=['&#127827;','&#129389;','&#127821;','&#127820;','&#129361;','&#127815;','&#129388;','&#127819;'],
      container=document.getElementById('floatingFruits');
  for(var i=0;i<12;i++){
    var el=document.createElement('div');
    el.className='float-fruit';
    el.innerHTML=fruits[i%fruits.length];
    el.style.cssText='left:'+Math.random()*100+'%;font-size:'+(Math.random()*20+16)+'px;animation-duration:'+(Math.random()*20+15)+'s;animation-delay:-'+Math.random()*20+'s';
    container.appendChild(el);
  }
}();

/* ── HERO PARTICLES ── */
!function(){
  var c=document.getElementById('heroParticles');
  for(var i=0;i<18;i++){
    var p=document.createElement('div'); p.className='particle';
    var s=Math.random()*18+5;
    p.style.cssText='width:'+s+'px;height:'+s+'px;left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;--dur:'+(Math.random()*5+4)+'s;animation-delay:-'+Math.random()*5+'s;opacity:'+(Math.random()*.12+.03);
    c.appendChild(p);
  }
}();

/* ── VIDEO ── */
function toggleVideoSound(){
  var v=document.getElementById('heroVideo'), b=document.querySelector('#videoCtrl i');
  v.muted=!v.muted;
  b.className=v.muted?'fas fa-volume-mute':'fas fa-volume-up';
}
window.toggleVideoSound = toggleVideoSound;

new IntersectionObserver(function(e){
  e.forEach(function(en){ en.isIntersecting ? en.target.play().catch(function(){}) : en.target.pause() });
},{threshold:.3}).observe(document.getElementById('heroVideo'));

/* ── DARK MODE ── */
function toggleDark(){
  document.body.classList.toggle('dark');
  var isDark=document.body.classList.contains('dark');
  document.getElementById('themeIcon').className=isDark?'fas fa-sun':'fas fa-moon';
  localStorage.setItem('ftpDark',isDark?'1':'0');
}
window.toggleDark = toggleDark;
if(localStorage.getItem('ftpDark')==='1'){
  document.body.classList.add('dark');
  document.getElementById('themeIcon').className='fas fa-sun';
}

/* ── SCROLL ── */
var ticking=false;
window.addEventListener('scroll',function(){
  if(!ticking){requestAnimationFrame(function(){onScroll();ticking=false});ticking=true}
},{passive:true});

function onScroll(){
  var st=window.scrollY, dh=document.documentElement.scrollHeight-window.innerHeight;
  document.getElementById('scrollProgress').style.transform='scaleX('+(st/dh)+')';
  document.getElementById('navbar').classList.toggle('scrolled',st>50);
  document.getElementById('backTop').classList.toggle('visible',st>400);
  document.querySelectorAll('section[id]').forEach(function(s){
    var l=document.querySelector('.nav-links a[href="#'+s.id+'"]');
    if(l) l.classList.toggle('active',st>=s.offsetTop-200&&st<s.offsetTop+s.offsetHeight-200);
  });
  var proc=document.getElementById('procesoTimeline');
  if(proc){
    var r=proc.getBoundingClientRect();
    var p=Math.min(1,Math.max(0,(window.innerHeight-r.top)/(window.innerHeight+r.height)));
    document.getElementById('procesoLineFill').style.width=(p*100)+'%';
  }
}

/* ── REVEAL ── */
var rObs=new IntersectionObserver(function(e){
  e.forEach(function(en){ if(en.isIntersecting){en.target.classList.add('revealed');rObs.unobserve(en.target)} });
},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.reveal').forEach(function(el){rObs.observe(el)});

/* ── TIMELINE ── */
new IntersectionObserver(function(e){
  e.forEach(function(en){ if(en.isIntersecting) en.target.classList.add('animated') });
},{threshold:.3}).observe(document.getElementById('timeline'));

/* ── COUNTERS ── */
function easeOutElastic(t){return t===0?0:t===1?1:Math.pow(2,-10*t)*Math.sin((t-.1)*5*Math.PI)+1}
var cDone=false;
new IntersectionObserver(function(e){
  e.forEach(function(en){
    if(en.isIntersecting&&!cDone){
      cDone=true;
      document.querySelectorAll('.hero-stat-num[data-target]').forEach(function(el){
        var tgt=parseInt(el.dataset.target), sfx=el.dataset.suffix||'', st=performance.now();
        !function tick(now){
          var t=Math.min(1,(now-st)/2500);
          el.innerHTML=Math.round(easeOutElastic(t)*tgt)+'<span class="suffix'+(t>=1?' show':'')+'">'+sfx+'</span>';
          if(t<1) requestAnimationFrame(tick);
          else el.style.animation='countPop .4s var(--ease-bounce)';
        }(st);
      });
    }
  });
},{threshold:.3}).observe(document.querySelector('.hero-stats'));

/* ── TYPEWRITER ── */
!function(){
  var el=document.getElementById('heroSub'),
      txt='Llevamos la calidad de nuestros campos al mundo mediante dos empresas especializadas: la mejor seleccion de fruta fresca y tecnologia avanzada en congelado IQF.',
      i=0;
  function t(){
    if(i<=txt.length){
      el.innerHTML=txt.slice(0,i)+'<span class="typing-cursor"></span>';
      i++; setTimeout(t,Math.random()*40+20);
    } else setTimeout(function(){ var c=el.querySelector('.typing-cursor'); if(c) c.style.display='none' },2000);
  }
  setTimeout(t,5800);
}();

/* ── RIPPLE ── */
document.querySelectorAll('.btn-primary,.btn-outline').forEach(function(b){
  b.addEventListener('click',function(e){
    var r=b.getBoundingClientRect(), rip=document.createElement('span');
    rip.className='btn-ripple';
    var sz=Math.max(r.width,r.height);
    rip.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(e.clientX-r.left-sz/2)+'px;top:'+(e.clientY-r.top-sz/2)+'px';
    b.appendChild(rip); setTimeout(function(){rip.remove()},600);
  });
});

/* ── MOBILE MENU ── */
function toggleMenu(){document.getElementById('mobileMenu').classList.toggle('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open')}
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;

/* ── PARALLAX ── */
var parallaxSections=document.querySelectorAll('.section');
window.addEventListener('scroll',function(){
  if(window.innerWidth<900) return;
  parallaxSections.forEach(function(s){
    var r=s.getBoundingClientRect(), center=r.top+r.height/2-window.innerHeight/2;
    s.querySelectorAll('.section-header').forEach(function(h){
      h.style.transform='translateY('+(center*-.03)+'px)';
    });
  });
},{passive:true});
