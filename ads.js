/* تحميل إعلانات AdSense بشكل آمن: خارج إطار اللعبة، بلا طبقات منبثقة، وبلا تحديث تلقائي. */
(function () {
  var C = window.ADS_CONFIG || {};
  if (!/^ca-pub-\d{16}$/.test(C.client || "")) return;               // الإعلانات معطّلة
  function boot() {
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
    var s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + C.client;
    document.head.appendChild(s);
  }
  function unit(box, slot, w, h) {
    if (!box || !slot || box.getAttribute("data-done")) return;
    box.setAttribute("data-done", "1"); boot();
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    if (w) ins.style.cssText = "display:inline-block;width:" + w + "px;height:" + h + "px";
    else { ins.style.display = "block"; ins.setAttribute("data-ad-format", "auto"); ins.setAttribute("data-full-width-responsive", "true"); }
    ins.setAttribute("data-ad-client", C.client); ins.setAttribute("data-ad-slot", slot);
    box.appendChild(ins);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
  function ready() {
    // صفحات المحتوى: وحدات متجاوبة داخل النص
    var list = document.querySelectorAll('[data-ad="content"]');
    for (var i = 0; i < list.length; i++) unit(list[i], C.slotContent);
    // صفحة اللعب: عمود جانبي على الشاشات العريضة، وبانر صغير اختياري على الجوال
    var rail = document.getElementById("rail"), bn = document.getElementById("bn");
    if (!rail) return;
    var wide = window.matchMedia("(min-width:1200px) and (min-height:680px)");
    function apply() {
      document.body.classList.toggle("wide", wide.matches);
      if (wide.matches) unit(rail, C.slotRail, 160, 600);
      else if (C.mobileBanner && bn) { document.body.classList.add("mob"); unit(bn, C.slotBanner, 320, 50); }
    }
    if (wide.addEventListener) wide.addEventListener("change", apply); else wide.addListener(apply);
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
