(function () {
  var s = document.documentElement;
  var t = localStorage.getItem('dw:theme');
  var r =
    t === 'dark'
      ? 'dark'
      : t === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  s.classList.remove('light', 'dark');
  s.classList.add(r);
})();
