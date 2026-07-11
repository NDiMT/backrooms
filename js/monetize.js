/* DRIFTLAND — Monetization & analytics scaffolding.

   Όλα λειτουργούν σε "stub mode" μέχρι να μπουν πραγματικά SDKs:
   - AdMob (Capacitor): βάλε το plugin @capacitor-community/admob,
     όρισε CONFIG.admob.* και άλλαξε provider σε 'admob'.
   - Poki/CrazyGames web SDK: provider 'poki'/'crazygames', τα scripts
     φορτώνονται μόνο όταν οριστεί.
   Τα σημεία κλήσης (rewarded revive, bonus loot) είναι ήδη δεμένα στο
   gameplay — αλλάζοντας provider δουλεύουν αμέσως. */

const Monetize = (() => {
  const CONFIG = {
    provider: 'stub',          // 'stub' | 'admob' | 'poki' | 'crazygames'
    admob: { appId: '', rewardedId: '' },
  };

  /* Analytics: gameplay events → console + dataLayer (GA-ready). */
  function track(event, params) {
    try {
      (window.dataLayer = window.dataLayer || []).push({ event, ...params });
    } catch (e) { /* ok */ }
    if (CONFIG.provider === 'stub') {
      console.log('[analytics]', event, params || '');
    }
  }

  /* Rewarded ad: καλεί onReward() αν ο παίκτης δει τη διαφήμιση.
     Σε stub mode δείχνει προσομοίωση ώστε να δοκιμάζεται το UX. */
  function showRewarded(placement, onReward, onFail) {
    track('ad_requested', { placement });
    if (CONFIG.provider === 'stub') {
      const el = document.getElementById('ad-stub');
      if (!el) { onReward(); return; }
      el.classList.remove('hidden');
      let left = 3;
      const cnt = document.getElementById('ad-stub-count');
      cnt.textContent = left;
      const iv = setInterval(() => {
        left--;
        cnt.textContent = left;
        if (left <= 0) {
          clearInterval(iv);
          el.classList.add('hidden');
          track('ad_rewarded', { placement });
          onReward();
        }
      }, 1000);
      return;
    }
    // TODO πραγματικοί providers:
    // admob: AdMob.showRewardVideoAd(...)
    // poki: PokiSDK.rewardedBreak().then(ok => ok ? onReward() : onFail())
    onFail && onFail();
  }

  /* Gameplay pause hooks για web portals (Poki απαιτεί gameplayStart/Stop). */
  function gameplayStart() { track('gameplay_start'); }
  function gameplayStop() { track('gameplay_stop'); }

  return { CONFIG, track, showRewarded, gameplayStart, gameplayStop };
})();
