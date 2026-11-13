(function(){
  var known=["ar","en","de"];
  function pick(){
    var q=new URLSearchParams(location.search).get("lang");
    if(known.indexOf(q)>=0)return q;
    try{var s=localStorage.getItem("kmcc-lang");if(known.indexOf(s)>=0)return s}catch(e){}
    var n=(navigator.language||"ar").slice(0,2).toLowerCase();
    return known.indexOf(n)>=0?n:"ar";
  }
  function show(code){
    document.querySelectorAll(".loc").forEach(function(el){
      var on=el.lang===code;el.classList.toggle("on",on);
      if(on){document.documentElement.lang=code;document.documentElement.dir=el.dir;document.title=el.dataset.title}
    });
    document.querySelectorAll(".langs button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.lang===code))});
    try{localStorage.setItem("kmcc-lang",code)}catch(e){}
  }
  document.addEventListener("click",function(e){var b=e.target.closest(".langs button");if(b){show(b.dataset.lang);window.scrollTo(0,0)}});
  show(pick());
})();
