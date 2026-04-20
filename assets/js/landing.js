/* ════════════════════════════════════════════════════════════════════
   LANDING PREMIUM - Interacciones cinematograficas
   Frutos Tropicales Peru Export S.A.C.
   v=premium | custom cursor, magnetic, 3D tilt, odometer, sticky scroll
   ════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ════════════════════════════════════════════════════════════════
     1. PRELOADER EJECUTIVO (duration 4500ms, intacto)
     ════════════════════════════════════════════════════════════════ */
  (function initPreloader(){
    var bar = document.getElementById('preloaderBar');
    var pct = document.getElementById('preloaderPercent');
    var preloader = document.getElementById('preloader');
    var pageContent = document.getElementById('pageContent');
    var duration = 4500;
    var start = performance.now();

    function tick(now){
      var elapsed = now - start;
      var eased = 1 - Math.pow(1 - Math.min(elapsed / duration, 1), 3);
      var visual = Math.round(eased * 100);
      if(bar) bar.style.width = visual + '%';
      if(pct) pct.textContent = visual + '%';
      if(elapsed < duration){
        requestAnimationFrame(tick);
      } else {
        if(bar) bar.style.width = '100%';
        if(pct) pct.textContent = '100%';
        setTimeout(function(){
          preloader.classList.add('fade-out');
          document.body.classList.remove('loading');
          setTimeout(function(){
            preloader.style.display = 'none';
            pageContent.classList.add('visible');
            setTimeout(function(){
              document.querySelectorAll('.hero-content .reveal').forEach(function(el){
                el.classList.add('revealed');
              });
            }, 200);
          }, 900);
        }, 300);
      }
    }
    requestAnimationFrame(tick);
  })();

  /* ════════════════════════════════════════════════════════════════
     2. FLOATING FRUITS + HERO PARTICLES
     ════════════════════════════════════════════════════════════════ */
  (function initFloating(){
    var fruits = ['&#127827;','&#129389;','&#127821;','&#127820;','&#129361;','&#127815;','&#129388;','&#127819;'];
    var container = document.getElementById('floatingFruits');
    if(!container) return;
    for(var i = 0; i < 12; i++){
      var el = document.createElement('div');
      el.className = 'float-fruit';
      el.innerHTML = fruits[i % fruits.length];
      el.style.cssText = 'left:' + Math.random() * 100 + '%;font-size:' + (Math.random() * 20 + 16) + 'px;animation-duration:' + (Math.random() * 20 + 15) + 's;animation-delay:-' + Math.random() * 20 + 's';
      container.appendChild(el);
    }
  })();

  (function initHeroParticles(){
    var c = document.getElementById('heroParticles');
    if(!c) return;
    for(var i = 0; i < 22; i++){
      var p = document.createElement('div');
      p.className = 'particle';
      var s = Math.random() * 18 + 5;
      p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;--dur:' + (Math.random() * 5 + 4) + 's;animation-delay:-' + Math.random() * 5 + 's;opacity:' + (Math.random() * .14 + .04);
      c.appendChild(p);
    }
  })();

  /* ════════════════════════════════════════════════════════════════
     3. HERO VIDEO CONTROL + AUTO PAUSE
     ════════════════════════════════════════════════════════════════ */
  window.toggleVideoSound = function(){
    var v = document.getElementById('heroVideo');
    var b = document.querySelector('#videoCtrl i');
    if(!v) return;
    v.muted = !v.muted;
    b.className = v.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
  };

  (function videoAutoPause(){
    var video = document.getElementById('heroVideo');
    if(!video || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.play().catch(function(){});
        } else {
          e.target.pause();
        }
      });
    }, {threshold: .25}).observe(video);
  })();

  /* ════════════════════════════════════════════════════════════════
     4. DARK MODE TOGGLE (localStorage ftpDark)
     ════════════════════════════════════════════════════════════════ */
  window.toggleDark = function(){
    document.body.classList.toggle('dark');
    var isDark = document.body.classList.contains('dark');
    var icon = document.getElementById('themeIcon');
    if(icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    try { localStorage.setItem('ftpDark', isDark ? '1' : '0'); } catch(e){}
  };
  try {
    if(localStorage.getItem('ftpDark') === '1'){
      document.body.classList.add('dark');
      var icon0 = document.getElementById('themeIcon');
      if(icon0) icon0.className = 'fas fa-sun';
    }
  } catch(e){}

  /* ════════════════════════════════════════════════════════════════
     5. MOBILE MENU
     ════════════════════════════════════════════════════════════════ */
  window.toggleMenu = function(){
    var m = document.getElementById('mobileMenu');
    if(m) m.classList.toggle('open');
  };
  window.closeMenu = function(){
    var m = document.getElementById('mobileMenu');
    if(m) m.classList.remove('open');
  };

  /* ════════════════════════════════════════════════════════════════
     6. SCROLL HANDLER (navbar, progress, ring, active link)
     ════════════════════════════════════════════════════════════════ */
  var ringCirc = 2 * Math.PI * 20; // r=20
  var ticking = false;
  function onScroll(){
    var st = window.scrollY;
    var dh = document.documentElement.scrollHeight - window.innerHeight;
    var pct = dh > 0 ? st / dh : 0;

    // Progress bar
    var sp = document.getElementById('scrollProgress');
    if(sp) sp.style.transform = 'scaleX(' + pct + ')';

    // Navbar scrolled
    var nav = document.getElementById('navbar');
    if(nav) nav.classList.toggle('scrolled', st > 50);

    // Scroll ring visibility + fill
    var ring = document.getElementById('scrollRing');
    var rFill = document.getElementById('ringFill');
    if(ring) ring.classList.toggle('visible', st > 400);
    if(rFill) rFill.style.strokeDashoffset = ringCirc * (1 - pct);

    // Active nav link
    document.querySelectorAll('section[id]').forEach(function(s){
      var l = document.querySelector('.nav-link[href="#' + s.id + '"]');
      if(l){
        var top = s.offsetTop;
        var h = s.offsetHeight;
        l.classList.toggle('active', st >= top - 200 && st < top + h - 200);
      }
    });
  }

  window.addEventListener('scroll', function(){
    if(!ticking){
      requestAnimationFrame(function(){
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, {passive:true});

  // Scroll ring click -> back to top
  var sr = document.getElementById('scrollRing');
  if(sr){
    sr.addEventListener('click', function(){
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  /* ════════════════════════════════════════════════════════════════
     7. REVEAL ANIMATIONS (IntersectionObserver)
     ════════════════════════════════════════════════════════════════ */
  (function initReveals(){
    if(!('IntersectionObserver' in window)){
      document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('revealed'); });
      return;
    }
    var rObs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('revealed');
          rObs.unobserve(e.target);
        }
      });
    }, {threshold: .12, rootMargin: '0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ rObs.observe(el); });
  })();

  /* ════════════════════════════════════════════════════════════════
     8. TIMELINE ANIMATION
     ════════════════════════════════════════════════════════════════ */
  (function initTimeline(){
    var t = document.getElementById('timeline');
    if(!t || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting) e.target.classList.add('animated');
      });
    }, {threshold:.25}).observe(t);
  })();

  /* ════════════════════════════════════════════════════════════════
     9. ODOMETER COUNTERS
     ════════════════════════════════════════════════════════════════ */
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function easeOutElastic(t){ return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2,-10*t)*Math.sin((t-.1)*5*Math.PI)+1; }

  function animateCounter(el, target, duration, suffix, easing){
    suffix = suffix || '';
    duration = duration || 2200;
    var start = performance.now();
    var ease = easing === 'elastic' ? easeOutElastic : easeOutCubic;
    function step(now){
      var t = Math.min(1, (now - start) / duration);
      var val = Math.round(ease(t) * target);
      el.innerHTML = val + '<span class="suffix' + (t >= 1 ? ' show' : '') + '">' + suffix + '</span>';
      if(t < 1){
        requestAnimationFrame(step);
      } else {
        el.style.animation = 'countPop .4s var(--ease-bounce)';
      }
    }
    requestAnimationFrame(step);
  }

  // Hero stats (one-shot)
  (function initHeroStats(){
    var wrap = document.getElementById('heroStats');
    if(!wrap || !('IntersectionObserver' in window)) return;
    var done = false;
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting && !done){
          done = true;
          wrap.querySelectorAll('.hero-stat-num[data-target]').forEach(function(el){
            var tgt = parseInt(el.dataset.target);
            var sfx = el.dataset.suffix || '';
            animateCounter(el, tgt, 2200, sfx, 'elastic');
          });
        }
      });
    }, {threshold:.3}).observe(wrap);
  })();

  // Generic counters (bento + ticker) using data-count
  (function initGenericCounters(){
    if(!('IntersectionObserver' in window)) return;
    var els = document.querySelectorAll('[data-count]');
    if(!els.length) return;
    var cObs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          var el = e.target;
          var target = parseFloat(el.dataset.count);
          var suffix = el.dataset.suffix || '';
          var start = performance.now();
          var duration = 1800 + Math.random() * 400;
          function step(now){
            var t = Math.min(1, (now - start) / duration);
            var val = easeOutCubic(t) * target;
            var display = target >= 10 ? Math.round(val) : val.toFixed(1);
            el.textContent = display + suffix;
            if(t < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
          cObs.unobserve(el);
        }
      });
    }, {threshold:.3});
    els.forEach(function(el){ cObs.observe(el); });
  })();

  /* ════════════════════════════════════════════════════════════════
     10. TYPEWRITER HERO SUB
     ════════════════════════════════════════════════════════════════ */
  (function initTypewriter(){
    var el = document.getElementById('heroSub');
    if(!el) return;
    var txt = 'Llevamos la calidad de nuestros campos al mundo mediante dos empresas especializadas: seleccion premium de fruta fresca y tecnologia avanzada en congelado IQF.';
    var i = 0;
    function type(){
      if(i <= txt.length){
        el.innerHTML = txt.slice(0, i) + '<span class="typing-cursor"></span>';
        i++;
        setTimeout(type, Math.random() * 30 + 18);
      } else {
        setTimeout(function(){
          var c = el.querySelector('.typing-cursor');
          if(c) c.style.display = 'none';
        }, 2000);
      }
    }
    setTimeout(type, 5800);
  })();

  /* ════════════════════════════════════════════════════════════════
     11. RIPPLE EFFECT ON BUTTONS
     ════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('.btn-primary,.btn-outline,.btn-submit,.btn-cta-final').forEach(function(b){
    b.addEventListener('click', function(e){
      var r = b.getBoundingClientRect();
      var rip = document.createElement('span');
      rip.className = 'btn-ripple';
      var sz = Math.max(r.width, r.height);
      rip.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + (e.clientX - r.left - sz/2) + 'px;top:' + (e.clientY - r.top - sz/2) + 'px';
      b.appendChild(rip);
      setTimeout(function(){ rip.remove(); }, 600);
    });
  });

  /* ════════════════════════════════════════════════════════════════
     12. CUSTOM CURSOR (desktop only, width>900)
     ════════════════════════════════════════════════════════════════ */
  (function initCustomCursor(){
    if(window.innerWidth <= 900 || prefersReduced) return;
    if('ontouchstart' in window) return;
    document.body.classList.add('desktop-cursor');
    var cursor = document.getElementById('cursor');
    var trail = document.getElementById('cursorTrail');
    if(!cursor || !trail) return;

    var mx = 0, my = 0, tx = 0, ty = 0;
    document.addEventListener('mousemove', function(e){
      mx = e.clientX; my = e.clientY;
      cursor.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    }, {passive:true});

    function trailLoop(){
      tx += (mx - tx) * .18;
      ty += (my - ty) * .18;
      trail.style.transform = 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%)';
      requestAnimationFrame(trailLoop);
    }
    trailLoop();

    // Hover state for links/buttons
    var hoverables = 'a,button,.pbento,.value-card,.bento,.cert-tile,.contacto-card,.t-dot,.feature-item,.cflag';
    document.querySelectorAll(hoverables).forEach(function(el){
      el.addEventListener('mouseenter', function(){
        cursor.classList.add('hovering');
        trail.classList.add('hovering');
      });
      el.addEventListener('mouseleave', function(){
        cursor.classList.remove('hovering');
        trail.classList.remove('hovering');
      });
    });
  })();

  /* ════════════════════════════════════════════════════════════════
     13. MAGNETIC BUTTONS (desktop only)
     ════════════════════════════════════════════════════════════════ */
  (function initMagnetic(){
    if(window.innerWidth <= 900 || prefersReduced) return;
    var max = 10; // px max displacement
    document.querySelectorAll('.magnetic').forEach(function(el){
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width/2);
        var y = e.clientY - (r.top + r.height/2);
        var dx = Math.max(-max, Math.min(max, x * .3));
        var dy = Math.max(-max, Math.min(max, y * .3));
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });
      el.addEventListener('mouseleave', function(){
        el.style.transform = '';
      });
    });
  })();

  /* ════════════════════════════════════════════════════════════════
     14. 3D TILT CARDS (desktop only)
     ════════════════════════════════════════════════════════════════ */
  (function initTilt(){
    if(window.innerWidth <= 900 || prefersReduced) return;
    var maxTilt = 10; // degrees
    document.querySelectorAll('[data-tilt]').forEach(function(el){
      el.style.transition = 'transform .35s var(--ease-out)';
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;  // 0..1
        var py = (e.clientY - r.top) / r.height;  // 0..1
        var rx = (py - .5) * -2 * maxTilt;
        var ry = (px - .5) * 2 * maxTilt;
        el.style.transform = 'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(4px)';
      });
      el.addEventListener('mouseleave', function(){
        el.style.transform = '';
      });
    });
  })();

  /* ════════════════════════════════════════════════════════════════
     15. JOURNEY VERTICAL RAIL + MAP COUNTRY HIGHLIGHT
     ════════════════════════════════════════════════════════════════ */
  (function initJourneyRail(){
    var steps = document.querySelectorAll('.journey-step');
    var railNodes = document.querySelectorAll('.rail-node');
    var railProgress = document.getElementById('railProgress');
    var railLine = document.querySelector('.rail-line');
    var journeyStack = document.querySelector('.journey-stack');

    if(steps.length && railNodes.length){
      // Intersection Observer para activar nodos
      if('IntersectionObserver' in window){
        var activeStep = 0;
        var sObs = new IntersectionObserver(function(entries){
          entries.forEach(function(e){
            if(e.isIntersecting && e.intersectionRatio > .25){
              var idx = parseInt(e.target.dataset.step) - 1;
              activeStep = Math.max(activeStep, idx);
              railNodes.forEach(function(n, i){
                n.classList.toggle('active', i <= idx);
                n.classList.toggle('current', i === idx);
              });
            }
          });
        }, {threshold:[.25, .4, .6], rootMargin:'-20% 0px -40% 0px'});
        steps.forEach(function(s){ sObs.observe(s); });
      }

      // Progress bar dinamica basada en scroll dentro de journey-stack
      if(railProgress && journeyStack){
        function updateProgress(){
          var rect = journeyStack.getBoundingClientRect();
          var vh = window.innerHeight;
          var scrolled = Math.max(0, (vh * 0.6) - rect.top);
          var total = rect.height - (vh * 0.3);
          var pct = Math.max(0, Math.min(1, scrolled / total));
          railProgress.style.height = (pct * 100) + '%';
        }
        window.addEventListener('scroll', updateProgress, {passive:true});
        window.addEventListener('resize', updateProgress);
        updateProgress();
      }
    }

    // Map hover interaction: hover bandera -> resalta pin
    var flags = document.querySelectorAll('.cflag');
    var pins = document.querySelectorAll('.dest-pin');
    if(flags.length && pins.length){
      flags.forEach(function(flag){
        var c = flag.dataset.c;
        flag.addEventListener('mouseenter', function(){
          pins.forEach(function(p){ p.classList.toggle('active', p.dataset.country === c); });
        });
        flag.addEventListener('mouseleave', function(){
          pins.forEach(function(p){ p.classList.remove('active'); });
        });
      });
      pins.forEach(function(pin){
        var c = pin.dataset.country;
        pin.addEventListener('mouseenter', function(){
          flags.forEach(function(f){ f.classList.toggle('hovered', f.dataset.c === c); });
        });
        pin.addEventListener('mouseleave', function(){
          flags.forEach(function(f){ f.classList.remove('hovered'); });
        });
      });
    }
  })();

  /* ════════════════════════════════════════════════════════════════
     16. TESTIMONIALS CAROUSEL (auto 6s, pause on hover)
     ════════════════════════════════════════════════════════════════ */
  var tState = { idx: 0, timer: null, paused: false };
  function showTestimonial(i){
    var cards = document.querySelectorAll('.testimonial-card');
    var dots = document.querySelectorAll('.t-dot');
    if(!cards.length) return;
    tState.idx = ((i % cards.length) + cards.length) % cards.length;
    cards.forEach(function(c, j){
      c.classList.toggle('active', j === tState.idx);
      c.classList.toggle('exit', j !== tState.idx && c.classList.contains('active'));
    });
    dots.forEach(function(d, j){
      d.classList.toggle('active', j === tState.idx);
    });
  }
  window.nextTestimonial = function(){ showTestimonial(tState.idx + 1); resetTimer(); };
  window.prevTestimonial = function(){ showTestimonial(tState.idx - 1); resetTimer(); };
  function resetTimer(){
    if(tState.timer) clearInterval(tState.timer);
    if(!tState.paused){
      tState.timer = setInterval(function(){
        if(!tState.paused) showTestimonial(tState.idx + 1);
      }, 6000);
    }
  }
  (function initTestimonials(){
    var carousel = document.getElementById('testimonialCarousel');
    if(!carousel) return;
    document.querySelectorAll('.t-dot').forEach(function(d){
      d.addEventListener('click', function(){
        var idx = parseInt(d.dataset.idx);
        if(!isNaN(idx)){ showTestimonial(idx); resetTimer(); }
      });
    });
    carousel.addEventListener('mouseenter', function(){ tState.paused = true; });
    carousel.addEventListener('mouseleave', function(){ tState.paused = false; });

    // Swipe support for mobile
    var startX = 0;
    carousel.addEventListener('touchstart', function(e){
      startX = e.touches[0].clientX;
    }, {passive:true});
    carousel.addEventListener('touchend', function(e){
      var endX = e.changedTouches[0].clientX;
      var diff = startX - endX;
      if(Math.abs(diff) > 50){
        if(diff > 0) showTestimonial(tState.idx + 1);
        else showTestimonial(tState.idx - 1);
        resetTimer();
      }
    }, {passive:true});

    resetTimer();
  })();

  /* ════════════════════════════════════════════════════════════════
     17. CONTACT FORM SUBMIT (fake submit + sparkles)
     ════════════════════════════════════════════════════════════════ */
  window.handleContactSubmit = function(e){
    e.preventDefault();
    var btn = document.getElementById('submitBtn');
    var form = document.getElementById('contactForm');
    if(!btn) return false;

    btn.classList.add('loading');
    setTimeout(function(){
      btn.classList.remove('loading');
      btn.classList.add('success');
      // Sparkles
      var cont = document.getElementById('sparkles');
      if(cont){
        for(var i = 0; i < 12; i++){
          var s = document.createElement('span');
          s.className = 'sparkle';
          var angle = (Math.PI * 2 / 12) * i;
          var tx = Math.cos(angle) * 40;
          var ty = Math.sin(angle) * 40 - 20;
          s.style.setProperty('--tx', tx + 'px');
          s.style.setProperty('--ty', ty + 'px');
          s.style.left = '50%';
          s.style.top = '50%';
          s.style.animationDelay = (i * 0.04) + 's';
          cont.appendChild(s);
          setTimeout(function(sp){ return function(){ sp.remove(); }; }(s), 1400);
        }
      }
      showToast('Solicitud enviada. Te responderemos en menos de 24h.');
      setTimeout(function(){
        btn.classList.remove('success');
        form.reset();
        // Reset floating labels
        document.querySelectorAll('.input-float').forEach(function(f){ f.classList.remove('filled'); });
      }, 3500);
    }, 1400);
    return false;
  };

  /* ════════════════════════════════════════════════════════════════
     18. INPUT FLOATING LABELS
     ════════════════════════════════════════════════════════════════ */
  (function initFloatingLabels(){
    document.querySelectorAll('.input-float input, .input-float textarea, .input-float select').forEach(function(el){
      // Initial check
      var parent = el.closest('.input-float');
      function check(){
        if(!parent) return;
        if(el.value && el.value.length > 0){
          parent.classList.add('filled');
        } else {
          parent.classList.remove('filled');
        }
      }
      el.addEventListener('input', check);
      el.addEventListener('change', check);
      el.addEventListener('blur', check);
      // Add placeholder so :not(:placeholder-shown) works correctly
      if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
        el.setAttribute('placeholder', ' ');
      }
      check();
    });
  })();

  /* ════════════════════════════════════════════════════════════════
     19. NEWSLETTER
     ════════════════════════════════════════════════════════════════ */
  window.handleNewsletter = function(e){
    e.preventDefault();
    var input = document.getElementById('fnEmail');
    if(input && input.value){
      showToast('Suscripcion confirmada. Bienvenido!');
      input.value = '';
    }
    return false;
  };

  /* ════════════════════════════════════════════════════════════════
     20. TOAST NOTIFICATIONS
     ════════════════════════════════════════════════════════════════ */
  function showToast(text){
    var t = document.getElementById('toast');
    var tt = document.getElementById('toastText');
    if(!t || !tt) return;
    tt.textContent = text;
    t.classList.add('visible');
    setTimeout(function(){ t.classList.remove('visible'); }, 3500);
  }
  window.showToast = showToast;

  /* ════════════════════════════════════════════════════════════════
     21. PARALLAX SECTION HEADERS (subtle)
     ════════════════════════════════════════════════════════════════ */
  (function initParallax(){
    if(window.innerWidth <= 900 || prefersReduced) return;
    var sections = document.querySelectorAll('.section');
    window.addEventListener('scroll', function(){
      sections.forEach(function(s){
        var r = s.getBoundingClientRect();
        if(r.bottom < 0 || r.top > window.innerHeight) return;
        var center = r.top + r.height/2 - window.innerHeight/2;
        s.querySelectorAll('.section-header').forEach(function(h){
          h.style.transform = 'translateY(' + (center * -.025) + 'px)';
        });
      });
    }, {passive:true});
  })();

  /* ════════════════════════════════════════════════════════════════
     22. HERO PARALLAX 3D on mousemove
     ════════════════════════════════════════════════════════════════ */
  (function initHeroParallax(){
    if(window.innerWidth <= 900 || prefersReduced) return;
    var hero = document.querySelector('.hero');
    var content = document.getElementById('heroContent');
    var mesh = document.querySelector('.hero-mesh');
    if(!hero || !content) return;
    hero.addEventListener('mousemove', function(e){
      var r = hero.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5;
      var py = (e.clientY - r.top) / r.height - .5;
      content.style.transform = 'translate(' + (px * -12) + 'px,' + (py * -8) + 'px)';
      if(mesh) mesh.style.transform = 'translate(' + (px * 30) + 'px,' + (py * 20) + 'px)';
    });
    hero.addEventListener('mouseleave', function(){
      content.style.transform = '';
      if(mesh) mesh.style.transform = '';
    });
  })();

  /* ════════════════════════════════════════════════════════════════
     23. NAV LINK SMOOTH SCROLL (adjust for fixed nav)
     ════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    var href = a.getAttribute('href');
    if(href === '#' || href.length < 2) return;
    a.addEventListener('click', function(e){
      var target = document.querySelector(href);
      if(target){
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({top: top, behavior:'smooth'});
        closeMenu();
      }
    });
  });

  /* ════════════════════════════════════════════════════════════════
     24. INITIAL SCROLL CHECK
     ════════════════════════════════════════════════════════════════ */
  onScroll();

})();
