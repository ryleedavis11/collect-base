// ─── CONSTANTS ───────────────────────────────────────────────────────────
        const SELL_RATE = 0.50;
        const HOLO_MULTIPLIER = 3;
        const OFFICE_HOURLY_RATE = 0.01;
        const OFFICE_CAP_HOURS = 6;
        const OFFICE_TOP_N = 12;
        const PACK_IMAGES = {
            std:   'https://owffrsfbnpnhdgizamhk.supabase.co/storage/v1/object/public/player-images/Barcelona%20team%20-%20FootyRenders.png',
            pre:   'https://owffrsfbnpnhdgizamhk.supabase.co/storage/v1/object/public/player-images/Erling%20Braut%20Haaland%20-%20FootyRenders%20(1).png',
            elt:   'https://owffrsfbnpnhdgizamhk.supabase.co/storage/v1/object/public/player-images/Neymar%20-%20FootyRenders%20(1).png',
            promo: 'https://owffrsfbnpnhdgizamhk.supabase.co/storage/v1/object/public/player-images/imagefor1sted-removebg-preview.png'
        };

        const TYPE_ADVANTAGES = {
            fire:'grass', water:'fire', grass:'water', psychic:'fighting',
            fighting:'dark', dark:'psychic', electric:'water', ice:'dragon', dragon:'normal',
        };
        const TYPE_ADV_MULTIPLIER = 1.20;

        // ─── STATE ───────────────────────────────────────────────────────────────
        let balance = 1000;
        let holoConfig = { min_rating: 4, chance: 0.02 };
        let mySquad = [];
        let currentPull = null;
        let activeTier = null;
        let currentUser = null;
        let isLoginMode = false;
        let lastCollected = null;
        let officeTickInterval = null;
        let _lockedCardIds = new Set();
        let _lastSaveCheckDate = null;
        let _myPendingTradeIds = [];
        let _activeTypeFilter = 'all';
        let _stdPackData = null;
        let _eltPackData = null;
        let _featuredCardConfig = null;
        let _trainerLevel = 1;
        let _trainerXP = 0;
        let _trainerTitle = 'ROOKIE';
        let _loginStreak = 0;
        let _lastLoginDate = null;
        let _tournamentCoinsClaimedIds = [];
        let _levelDefs = [];
        let _activityChannel = null;

        // ─── TOAST ───────────────────────────────────────────────────────────────
        function showToast(msg, duration = 4000) {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();
            const t = document.createElement('div');
            t.className = 'toast'; t.innerText = msg;
            document.body.appendChild(t);
            requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
            setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
        }

        function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
        function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

        // ─── LANDING PAGE ─────────────────────────────────────────────────────────
        function showAuthPanel(loginMode) {
            isLoginMode = loginMode;
            document.getElementById('view-landing').style.display = 'none';
            document.getElementById('view-login').classList.add('active');
            const subtitle = document.getElementById('auth-subtitle');
            const btn = document.getElementById('auth-submit-btn');
            const toggle = document.querySelector('.auth-toggle');
            const usernameField = document.getElementById('field-username');
            clearAuthMessages();
            if (loginMode) {
                subtitle.innerText = 'SIGN IN'; btn.innerText = 'SIGN IN';
                toggle.innerText = "Don't have an account? Register";
                usernameField.style.display = 'none';
            } else {
                subtitle.innerText = 'CREATE ACCOUNT'; btn.innerText = 'CREATE ACCOUNT';
                toggle.innerText = "Already have an account? Sign In";
                usernameField.style.display = 'block';
            }
        }

        function hideLanding() {
            document.getElementById('view-login').classList.remove('active');
            document.getElementById('view-landing').style.display = '';
        }

        async function initLandingShowcase() {
            const { data } = await _supabase.from('collection').select('*').gte('rating', 8).limit(3);
            const showcase = document.getElementById('landing-card-showcase');
            if (data && data.length > 0) {
                showcase.innerHTML = data.map(p => `<div class="landing-card-item">${generateCardHtml(p, false)}</div>`).join('');
            }
        }

        // ─── AUTH MODE TOGGLE ────────────────────────────────────────────────────
        function toggleAuthMode() {
            isLoginMode = !isLoginMode;
            const subtitle = document.getElementById('auth-subtitle');
            const btn = document.getElementById('auth-submit-btn');
            const toggle = document.querySelector('.auth-toggle');
            const usernameField = document.getElementById('field-username');
            clearAuthMessages();
            if (isLoginMode) {
                subtitle.innerText = 'SIGN IN'; btn.innerText = 'SIGN IN';
                toggle.innerText = "Don't have an account? Register";
                usernameField.style.display = 'none';
            } else {
                subtitle.innerText = 'CREATE ACCOUNT'; btn.innerText = 'CREATE ACCOUNT';
                toggle.innerText = "Already have an account? Sign In";
                usernameField.style.display = 'block';
            }
        }

        function clearAuthMessages() {
            document.getElementById('auth-error').innerText = '';
            document.getElementById('auth-success').innerText = '';
        }
        function setAuthError(msg) { document.getElementById('auth-error').innerText = msg; }
        function setAuthSuccess(msg) { document.getElementById('auth-success').innerText = msg; }

        // ─── HANDLE AUTH ─────────────────────────────────────────────────────────
        async function handleAuth() {
            clearAuthMessages();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const username = document.getElementById('username').value.trim();
            if (!email || !password) { setAuthError('Email and password required.'); return; }
            showLoading();
            if (isLoginMode) {
                const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
                if (error) { hideLoading(); setAuthError(error.message); return; }
                currentUser = data.user;
                await loadCloudSave();
                enterGame();
            } else {
                if (!username) { hideLoading(); setAuthError('Trainer name is required.'); return; }
                if (username.length < 3) { hideLoading(); setAuthError('Trainer name must be at least 3 characters.'); return; }
                if (password.length < 6) { hideLoading(); setAuthError('Password must be at least 6 characters.'); return; }
                const { data, error } = await _supabase.auth.signUp({ email, password, options: { data: { username } } });
                if (error) { hideLoading(); setAuthError(error.message); return; }
                const { data: sessionData } = await _supabase.auth.getSession();
                currentUser = sessionData.session?.user || data.user;
                const { error: dbError } = await _supabase.from('user_saves').upsert({
                    user_id: currentUser.id, email: currentUser.email, username,
                    balance: 1500, squad: [], club_value: 0,
                    last_collected: new Date().toISOString(),
                    login_streak: 1, last_login_date: new Date().toISOString(),
                    xp: 0, level: 1, trainer_title: 'ROOKIE',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                if (dbError) { hideLoading(); setAuthError("Database error: " + dbError.message); return; }
                balance = 1500; mySquad = []; lastCollected = new Date().toISOString();
                hideLoading(); enterGame(true);
            }
        }

        // ─── LOGOUT ──────────────────────────────────────────────────────────────
        async function handleLogout() {
            if (!confirm('Log out?')) return;
            await saveGame();
            stopOfficeTicker(); stopTradePoll();
            if (_activityChannel) _supabase.removeChannel(_activityChannel);
            await _supabase.auth.signOut();
            currentUser = null; balance = 5000; mySquad = []; lastCollected = null;
            document.getElementById('main-nav').style.display = 'none';
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-landing').style.display = '';
            document.getElementById('view-landing').classList.add('active');
            document.getElementById('view-login').classList.remove('active');
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            document.getElementById('username').value = '';
        }

        // ─── SESSION CHECK ───────────────────────────────────────────────────────
        async function checkExistingSession() {
            showLoading();
            initLandingShowcase();
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) { currentUser = session.user; await loadCloudSave(); enterGame(); }
            else { hideLoading(); }
        }

        // ─── ENTER GAME ──────────────────────────────────────────────────────────
        function enterGame(isNew = false) {
            hideLoading();
            document.getElementById('view-landing').style.display = 'none';
            document.getElementById('view-login').classList.remove('active');
            document.getElementById('main-nav').style.display = 'flex';
            setupPresence();
            showView('home');
            updateWelcomeMsg(isNew);
            initMarquee();
            startOfficeTicker();
            startTradePoll();
            if (window._offlineEarnedNotif) {
                showToast(`💰 While you were away, your Daycare earned +${window._offlineEarnedNotif.toLocaleString()} 🪙`);
                window._offlineEarnedNotif = null;
            }
            loadStorePrices();
            loadGameSettings();
            loadTopPullsToday();
            loadLimitedStock();
            loadExchangeState();
            startPlaytimeTracking();
            renderDailyChallenges();
            prefetchStdPack();
            loadTrainerLevels();
            subscribeActivityFeed();
            loadActivityFeed();
            checkTournamentPrizes();
            updateNavLevel();
        }

        // ─── PREFETCH STD PACK ────────────────────────────────────────────────────
        async function prefetchStdPack() {
            const { data } = await _supabase.from('packs').select('*').eq('tier', 'std').single();
            if (data) _stdPackData = data;
            const { data: eltData } = await _supabase.from('packs').select('*').eq('tier', 'elt').single();
            if (eltData) _eltPackData = eltData;
        }

        async function loadTopPullsToday() {
            const track = document.getElementById('store-pulls-track');
            if (!track) return;
            const { data } = await _supabase.from('user_saves').select('username, squad').not('squad', 'is', null);
            if (!data) return;
            const todayStr = new Date().toLocaleDateString();
            let todayPulls = [];
            data.forEach(user => {
                (user.squad || []).forEach(card => {
                    if (card.collectedDate === todayStr) todayPulls.push({ ...card, pulledBy: user.username || 'ANONYMOUS' });
                });
            });
            todayPulls.sort((a, b) => getCardValue(b) - getCardValue(a));
            const top20 = todayPulls.slice(0, 20);
            if (top20.length === 0) {
                const { data: fallback } = await _supabase.from('collection').select('*').gte('rating', 8).order('rating', { ascending: false }).limit(20);
                if (fallback && fallback.length > 0) {
                    track.innerHTML = [...fallback, ...fallback].map(p =>
                        `<div class="store-pull-item">${generateCardHtml(p, false)}<div class="store-pull-username">TODAY'S TOP CARDS</div></div>`
                    ).join('');
                }
                return;
            }
            track.innerHTML = [...top20, ...top20].map(p =>
                `<div class="store-pull-item">${generateCardHtml(p, false)}<div class="store-pull-username">${p.pulledBy}</div></div>`
            ).join('');
        }

        function updateWelcomeMsg(isNew = false) {
            const username = currentUser?.user_metadata?.username || currentUser?.email || 'TRAINER';
            const greeting = isNew ? 'WELCOME TO COLLECTION BASE,' : 'WELCOME BACK,';
            document.getElementById('welcome-msg').innerText = `${greeting} ${username.toUpperCase()}`;
        }

        // ─── CLOUD SAVE ──────────────────────────────────────────────────────────
        async function loadCloudSave() {
            if (!currentUser) return;
            const { data, error } = await _supabase
                .from('user_saves')
                .select('balance, squad, last_collected, completed_exchanges, hours_played, last_daily_collect, daily_challenges, login_streak, last_login_date, xp, level, trainer_title, tournament_coins_claimed')
                .eq('user_id', currentUser.id)
                .single();
            if (error) {
                console.error("CRITICAL LOAD ERROR:", error.message);
                showToast('🚨 Database Error! Check console.', 10000);
                return;
            }
            if (data) {
                balance = data.balance ?? 5000;
                mySquad = data.squad || [];
                completedExchanges = data.completed_exchanges || [];
                _totalHoursPlayed  = data.hours_played || 0;
                lastCollected = data.last_collected || new Date().toISOString();
                _dailyChallenges = data.daily_challenges || null;
                _loginStreak = data.login_streak || 0;
                _lastLoginDate = data.last_login_date || null;
                _trainerXP = data.xp || 0;
                _trainerLevel = data.level || 1;
                _trainerTitle = data.trainer_title || 'ROOKIE';
                _tournamentCoinsClaimedIds = data.tournament_coins_claimed || [];
                updateLockedCards();
                const offlineRoster = [...mySquad].sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, OFFICE_TOP_N);
                const offlineHourlyRate = offlineRoster.reduce((sum, p) => sum + getCardValue(p) * OFFICE_HOURLY_RATE, 0);
                const offlineEarned = Math.floor(offlineHourlyRate * getElapsedHours());
                if (offlineEarned > 0) {
                    balance += offlineEarned;
                    lastCollected = new Date().toISOString();
                    window._offlineEarnedNotif = offlineEarned;
                }
                // Handle login streak after loading level defs
                await handleLoginStreak();
                updateUI(); renderSquad(); saveGame();
            }
        }

        async function saveGame() {
            if (!currentUser) return;
            await flushPlaytime();
            const cv = [...mySquad].sort((a,b) => getCardValue(b) - getCardValue(a)).slice(0, OFFICE_TOP_N).reduce((sum, p) => sum + getCardValue(p), 0);
            await _supabase.from('user_saves').upsert({
                user_id: currentUser.id,
                email: currentUser.email,
                username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
                balance, squad: mySquad, club_value: cv,
                last_collected: lastCollected,
                completed_exchanges: completedExchanges,
                daily_challenges: _dailyChallenges,
                login_streak: _loginStreak,
                last_login_date: _lastLoginDate,
                xp: _trainerXP, level: _trainerLevel, trainer_title: _trainerTitle,
                tournament_coins_claimed: _tournamentCoinsClaimedIds,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        }

        // ─── LOGIN STREAK ─────────────────────────────────────────────────────────
        async function handleLoginStreak() {
            const today = new Date().toDateString();
            const lastDate = _lastLoginDate ? new Date(_lastLoginDate).toDateString() : null;
            if (lastDate === today) return; // already logged in today

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const wasYesterday = lastDate === yesterday.toDateString();

            if (wasYesterday) {
                _loginStreak += 1;
            } else if (lastDate !== today) {
                _loginStreak = 1; // reset streak
            }
            _lastLoginDate = new Date().toISOString();

            // Load streak rewards from game_settings
            const { data: settingData } = await _supabase
                .from('game_settings').select('setting_value').eq('setting_key', 'login_streak_rewards').single();
            const rewards = settingData?.setting_value || [];

            // Find the best reward for this streak day (exact match or nearest lower)
            const eligibleRewards = rewards.filter(r => r.day <= _loginStreak);
            const todayReward = eligibleRewards.sort((a, b) => b.day - a.day)[0];

            if (todayReward) {
                if (todayReward.type === 'coins') {
                    balance += todayReward.value;
                    window._streakRewardData = { streak: _loginStreak, type: 'coins', value: todayReward.value, rewards };
                } else if (todayReward.type === 'pack') {
                    // Give pack insurance as a free pack credit — simplest approach is just coins equivalent
                    balance += 500; // value of std pack
                    window._streakRewardData = { streak: _loginStreak, type: 'pack', value: todayReward.pack_tier || 'std', rewards };
                }
            } else {
                window._streakRewardData = { streak: _loginStreak, type: 'coins', value: 0, rewards };
            }
        }

        function showStreakPopup() {
            const d = window._streakRewardData;
            if (!d || d.shown) return;
            d.shown = true;
            document.getElementById('streak-days').innerText = `DAY ${d.streak}`;
            if (d.type === 'coins') {
                document.getElementById('streak-reward').innerText = d.value > 0 ? `+${d.value.toLocaleString()} 🪙` : 'Keep it up!';
            } else {
                document.getElementById('streak-reward').innerText = `FREE ${(d.value || 'STD').toUpperCase()} PACK CREDIT!`;
            }
            // Build progress dots for next 7 days
            const prog = document.getElementById('streak-progress');
            prog.innerHTML = Array.from({length: 7}, (_, i) => {
                const day = i + 1;
                const cls = day < d.streak ? 'streak-dot done' : (day === d.streak ? 'streak-dot today' : 'streak-dot');
                return `<div class="${cls}">${day}</div>`;
            }).join('');
            const overlay = document.getElementById('streak-overlay');
            overlay.style.display = 'flex';
        }

        function closeStreakOverlay() {
            document.getElementById('streak-overlay').style.display = 'none';
            updateStreakDisplay();
        }

        function updateStreakDisplay() {
            const el = document.getElementById('streak-display');
            if (!el) return;
            if (_loginStreak > 0) {
                el.style.display = 'flex';
                el.innerHTML = `<span class="streak-fire-sm">🔥</span><span class="streak-count">${_loginStreak} DAY STREAK</span>`;
            } else {
                el.style.display = 'none';
            }
        }

        // ─── TRAINER LEVELS + XP ─────────────────────────────────────────────────
        async function loadTrainerLevels() {
            const { data } = await _supabase.from('trainer_levels').select('*').order('level', { ascending: true });
            if (data) _levelDefs = data;
        }

        function addXP(amount) {
            if (_levelDefs.length === 0) return;
            _trainerXP += amount;
            const nextLevelDef = _levelDefs.find(l => l.level === _trainerLevel + 1);
            if (nextLevelDef && _trainerXP >= nextLevelDef.xp_required) {
                _trainerLevel += 1;
                _trainerTitle = nextLevelDef.badge_label || _trainerTitle;
                // Award level up reward
                if (nextLevelDef.reward_type === 'coins') {
                    balance += nextLevelDef.reward_value;
                }
                updateUI();
                updateNavLevel();
                showLevelUpPopup(nextLevelDef);
                saveGame();
            }
        }

        function showLevelUpPopup(def) {
            document.getElementById('levelup-level').innerText = `LEVEL ${def.level}`;
            document.getElementById('levelup-title').innerText = def.badge_label || '';
            document.getElementById('levelup-reward').innerText = def.reward_type === 'coins'
                ? `+${def.reward_value.toLocaleString()} 🪙`
                : `FREE PACK!`;
            document.getElementById('levelup-overlay').style.display = 'flex';
        }

        function closeLevelUp() { document.getElementById('levelup-overlay').style.display = 'none'; }

        function updateNavLevel() {
            const el = document.getElementById('nav-level-badge');
            if (el) el.innerText = `LV${_trainerLevel} `;
        }

        // ─── ACTIVITY FEED ────────────────────────────────────────────────────────
        async function logActivity(eventType, cardData) {
            if (!currentUser) return;
            const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
            await _supabase.from('activity_feed').insert({
                user_id: currentUser.id,
                username,
                event_type: eventType,
                card_data: cardData || null
            });
        }

        async function loadActivityFeed() {
            const { data } = await _supabase
                .from('activity_feed')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            renderActivityFeed(data || []);
        }

        function renderActivityFeed(events) {
            const list = document.getElementById('activity-feed-list');
            if (!list) return;
            if (events.length === 0) {
                list.innerHTML = '<div class="feed-empty">No activity yet — be the first to pull something big!</div>';
                return;
            }
            const icons = { pulled_limited:'🔒', pulled_ultra:'✨', pulled_secret:'🌟', won_battle:'⚔', completed_exchange:'🔁', leveled_up:'⬆' };
            const labels = { pulled_limited:'pulled a LIMITED', pulled_ultra:'pulled an ULTRA RARE', pulled_secret:'pulled a SECRET RARE', won_battle:'won a battle', completed_exchange:'completed an exchange', leveled_up:'leveled up' };
            list.innerHTML = events.map(e => {
                const ago = timeAgo(new Date(e.created_at));
                const icon = icons[e.event_type] || '🎮';
                const label = labels[e.event_type] || e.event_type;
                const cardName = e.card_data?.name ? ` — ${e.card_data.name}` : '';
                return `<div class="feed-item">
                    <span class="feed-icon">${icon}</span>
                    <span class="feed-text"><strong>${e.username || 'TRAINER'}</strong> ${label}${cardName}</span>
                    <span class="feed-time">${ago}</span>
                </div>`;
            }).join('');
        }

        function timeAgo(date) {
            const secs = Math.floor((Date.now() - date.getTime()) / 1000);
            if (secs < 60) return 'just now';
            if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
            if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
            return `${Math.floor(secs/86400)}d ago`;
        }

        function subscribeActivityFeed() {
            _activityChannel = _supabase
                .channel('activity_feed_changes')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, payload => {
                    loadActivityFeed();
                })
                .subscribe();
        }

        // ─── LOCK CARDS ───────────────────────────────────────────────────────────
        async function updateLockedCards() {
            if (!currentUser) return;
            const { data } = await _supabase.from('trades')
                .select('offered_card, receiver_card')
                .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                .in('status', ['open', 'pending']);
            _lockedCardIds.clear();
            if (data) {
                data.forEach(t => {
                    if (t.offered_card?.instanceId)  _lockedCardIds.add(t.offered_card.instanceId);
                    if (t.receiver_card?.instanceId) _lockedCardIds.add(t.receiver_card.instanceId);
                });
            }
        }

        // ─── GAME LOGIC ──────────────────────────────────────────────────────────
        function getCardValue(p) {
            let val = p.base_price || 0;
            if (p.isSuperHolo) val *= HOLO_MULTIPLIER;
            // Featured card multiplier
            if (_featuredCardConfig?.card_id && p.id === _featuredCardConfig.card_id) {
                val *= (_featuredCardConfig.multiplier || 2);
            }
            return val;
        }

        function getSellValue(p) {
            if ((p.rarity || '').toLowerCase() === 'exchange' || p.isExchange) return 0;
            return Math.floor(getCardValue(p) * SELL_RATE);
        }

        // ─── OFFICE / DAYCARE ─────────────────────────────────────────────────────
        function getOfficeRoster() { return [...mySquad].sort((a,b) => getCardValue(b) - getCardValue(a)).slice(0, OFFICE_TOP_N); }
        function getOfficeHourlyTotal() { return getOfficeRoster().reduce((sum,p) => sum + getCardValue(p) * OFFICE_HOURLY_RATE, 0); }
        function getElapsedHours() {
            if (!lastCollected) return 0;
            return Math.min((Date.now() - new Date(lastCollected).getTime()) / (1000*60*60), OFFICE_CAP_HOURS);
        }
        function isOfficeCapped() {
            if (!lastCollected) return false;
            return (Date.now() - new Date(lastCollected).getTime()) >= OFFICE_CAP_HOURS * 3600000;
        }
        function getPendingEarnings() { return Math.floor(getOfficeHourlyTotal() * getElapsedHours()); }

        async function collectOfficeEarnings() {
            const pending = getPendingEarnings();
            if (pending <= 0) return;
            balance += pending;
            lastCollected = new Date().toISOString();
            addXP(Math.floor(pending / 100));
            updateUI(); renderOfficeView(); await saveGame();
            showToast(`💰 Collected +${pending.toLocaleString()} 🪙 from the Daycare!`);
            const panel = document.getElementById('office-panel');
            if (panel) { panel.classList.add('collect-flash'); setTimeout(() => panel.classList.remove('collect-flash'), 600); }
        }

        function updateOfficePanelUI() {
            const pending = getPendingEarnings();
            const capped  = isOfficeCapped();
            const hourly  = getOfficeHourlyTotal();
            const hours   = getElapsedHours();
            const pendingEl = document.getElementById('office-pending-display');
            const rateEl    = document.getElementById('office-rate-display');
            const barEl     = document.getElementById('office-timer-bar');
            const lblEl     = document.getElementById('office-timer-label');
            if (!pendingEl) return;
            pendingEl.innerText = pending.toLocaleString() + ' 🪙';
            pendingEl.style.color = capped ? '#ef4444' : '#ffd700';
            rateEl.innerText = hourly.toLocaleString(undefined, {maximumFractionDigits:1}) + ' 🪙 / hour';
            const pct = Math.min((hours / OFFICE_CAP_HOURS) * 100, 100);
            barEl.style.width = pct + '%';
            barEl.style.background = capped ? 'linear-gradient(90deg,#ef4444,#ff6b6b)' : 'linear-gradient(90deg,#ffcb05,#ffd700)';
            const totalMins = Math.floor(hours * 60);
            const hh = Math.floor(totalMins/60), mm = totalMins % 60;
            lblEl.innerText = capped ? '⚠ CAPPED — COLLECT NOW' : `${hh}h ${mm}m accumulated`;
            const btn = document.getElementById('office-collect-btn');
            if (pending > 0) {
                btn.className = capped ? 'office-collect-btn capped' : 'office-collect-btn ready';
                btn.innerText = `COLLECT +${pending.toLocaleString()} 🪙`;
            } else { btn.className = 'office-collect-btn empty'; btn.innerText = 'COLLECT'; }
            document.getElementById('office-badge').style.display = pending > 0 ? 'flex' : 'none';
        }

        function renderOfficeRoster() {
            const roster = getOfficeRoster();
            const container = document.getElementById('office-roster');
            const capped = isOfficeCapped();
            if (roster.length === 0) {
                container.innerHTML = `<div class="office-empty-state"><div class="big-icon">🏠</div><p>KEEP POKÉMON CARDS TO START EARNING</p></div>`;
                return;
            }
            const hourlyTotal = getOfficeHourlyTotal();
            let html = `<div class="office-roster-title">TOP ${roster.length} EARNERS &nbsp;·&nbsp; ${hourlyTotal.toLocaleString(undefined,{maximumFractionDigits:0})} 🪙 / HOUR ${capped ? '&nbsp;&nbsp;<span style="color:#ef4444">⚠ INCOME PAUSED — COLLECT NOW</span>' : ''}</div><div class="office-card-grid">`;
            roster.forEach((p, i) => {
                const hourly = getCardValue(p) * OFFICE_HOURLY_RATE;
                const isFeatured = _featuredCardConfig?.card_id && p.id === _featuredCardConfig.card_id;
                html += `<div class="office-card-wrap ${capped ? 'capped' : ''} ${isFeatured ? 'featured-card-wrap' : ''}">
                    <div class="office-rank-badge ${i < 3 ? 'top3' : ''}">#${i+1}</div>
                    ${isFeatured ? '<div class="featured-star-badge">⭐ 2×</div>' : ''}
                    ${generateCardHtml(p, false)}
                    <div class="office-earn-tag ${capped ? 'capped' : ''}">
                        <div class="office-earn-amount">${capped ? '⏸' : '+'} ${hourly.toLocaleString(undefined,{maximumFractionDigits:1})} 🪙</div>
                        <div class="office-earn-label">${capped ? 'PAUSED' : 'PER HOUR'}</div>
                    </div>
                </div>`;
            });
            html += `</div>`;
            container.innerHTML = html;
        }

        function renderOfficeView() { updateOfficePanelUI(); renderOfficeRoster(); }

        function startOfficeTicker() {
            stopOfficeTicker();
            officeTickInterval = setInterval(() => {
                const pending = getPendingEarnings();
                document.getElementById('office-badge').style.display = (pending > 0 && mySquad.length > 0) ? 'flex' : 'none';
                const officeView = document.getElementById('view-office');
                if (officeView.classList.contains('active')) updateOfficePanelUI();
            }, 5000);
        }
        function stopOfficeTicker() { if (officeTickInterval) { clearInterval(officeTickInterval); officeTickInterval = null; } }

        // ─── MARQUEE ─────────────────────────────────────────────────────────────
        async function initMarquee() {
            const track = document.getElementById('marquee-track');
            const { data } = await _supabase.from('collection').select('*').gte('rating', 5).order('rating', {ascending:false}).limit(40);
            if (data && data.length > 0) {
                track.innerHTML = [...data, ...data].map(p => generateCardHtml(p, false)).join('');
            }
        }

        // ─── PACK LOGIC ───────────────────────────────────────────────────────────
        function preparePack(tier) {
            activeTier = tier;
            document.getElementById('packArea').style.display = 'none';
            document.getElementById('default-message').style.display = 'none';
            let specialLayer = '';
            if (tier === 'elt')        { specialLayer = '<div class="galaxy-nebula"></div>'; }
            else if (tier === 'promo') { specialLayer = '<div class="promo-fire"></div>'; }
            else if (tier === 'pre')   { specialLayer = '<div class="premium-glow"></div>'; }
            const visual = document.getElementById('pack-visual');
            visual.innerHTML = `
                <div class="pack-container" onclick="openPack()">
                    <div class="info-btn" onclick="event.stopPropagation(); showPackWeights('${tier}');"
                        style="position:absolute;top:-10px;right:-10px;z-index:20;cursor:pointer;background:#111;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:2px solid #ffcb05;color:#ffcb05;font-weight:bold;box-shadow:0 0 10px rgba(255,203,5,0.3);">i</div>
                    <div class="foil-pack">${specialLayer}<div class="foil-shine"></div><div class="pack-label">${tier.toUpperCase()}</div><img src="${PACK_IMAGES[tier]}" class="sealed-player-render"></div>
                </div>
                <button class="btn" style="background:#1e1e2e;font-size:0.7rem;max-width:200px;" onclick="resetUI()">← CANCEL</button>`;
            visual.style.display = 'block';
        }

        async function loadStorePrices() {
            const { data: packs, error } = await _supabase.from('packs').select('tier, cost, in_store, image_url');
            if (error || !packs) return;
            const names = { std:'Standard', pre:'Premium', elt:'Elite', promo:'1st Edition' };
            ['std','pre','elt','promo'].forEach(tier => { const btn = document.getElementById(`btn-${tier}`); if (btn) btn.style.display = 'none'; });
            packs.forEach(pack => {
                if (pack.image_url) PACK_IMAGES[pack.tier] = pack.image_url;
                const btn = document.getElementById(`btn-${pack.tier}`);
                if (btn && names[pack.tier]) {
                    if (pack.in_store === false) { btn.style.display = 'none'; }
                    else { btn.style.display = 'block'; btn.innerText = `${names[pack.tier]} (${pack.cost.toLocaleString()} 🪙)`; }
                }
            });
        }

        async function openPack() {
            showLoading();
            const { data: pack, error } = await _supabase.from('packs').select('*').eq('tier', activeTier).single();
            if (error || !pack) { hideLoading(); showToast("Error loading pack data from server."); return; }
            if (balance < pack.cost) { hideLoading(); showToast("Not enough coins!"); return; }
            balance -= pack.cost;
            const roll = Math.random() * 100;
            let pulledPlayer = null;

            if (Math.random() * 100 < pack.limited_odds) {
                const { data: limitedPool } = await _supabase.from('collection').select('*').ilike('rarity', 'Limited');
                if (limitedPool && limitedPool.length > 0) {
                    let potential = limitedPool[Math.floor(Math.random() * limitedPool.length)];
                    const { data: countData } = await _supabase.rpc('count_limited_player', { pid: potential.id });
                    if ((countData || 0) < 10) { pulledPlayer = potential; pulledPlayer.isLimited = true; pulledPlayer.serialNumber = (countData || 0) + 1; }
                }
            }

            if (!pulledPlayer && pack.promo_odds > 0 && roll < pack.promo_odds) {
                const { data: promoPool } = await _supabase.from('collection').select('*').ilike('rarity', '1st edition');
                if (promoPool && promoPool.length > 0) pulledPlayer = promoPool[Math.floor(Math.random() * promoPool.length)];
            }

            if (!pulledPlayer) {
                const rules = pack.odds_config || [];
                if (rules.length === 0) { hideLoading(); showToast("Pack odds missing! Check Supabase."); return; }
                let cumulative = 0, rule = rules[rules.length - 1];
                for (const r of rules) { cumulative += r.chance; if (roll < cumulative) { rule = r; break; } }
                const { data } = await _supabase.from('collection').select('*')
                    .gte('rating', rule.min).lte('rating', rule.max)
                    .neq('rarity', 'Limited').neq('rarity', '1st edition').eq('in_packs', true);
                let poolData = (data && data.length > 0) ? data : (await _supabase.from('collection').select('*').limit(20)).data;
                pulledPlayer = poolData[Math.floor(Math.random() * poolData.length)];
            }

            if (!pulledPlayer) { hideLoading(); showToast("No cards found in the database!"); return; }
            if (pulledPlayer.rating >= holoConfig.min_rating && Math.random() < holoConfig.chance) pulledPlayer.isSuperHolo = true;

            currentPull = { ...pulledPlayer, instanceId: 'inst_' + Date.now(), collectedDate: new Date().toLocaleDateString() };
            hideLoading();
            tickChallenge('open_packs', 1);
            addXP(5);
            await animatePack(currentPull);
        }

        async function animatePack(pulledPlayer) {
            const packVisual = document.getElementById('pack-visual').querySelector('.pack-container');
            const rarity = (pulledPlayer.rarity || '').toLowerCase();
            if (rarity === 'limited') {
                packVisual.classList.add('suspense-shake-limited');
                await new Promise(r => setTimeout(r, 1800));
                const flash = document.createElement('div'); flash.className = 'limited-flash'; document.body.appendChild(flash); setTimeout(() => flash.remove(), 2000);
            } else if (rarity === '1st edition') {
                packVisual.classList.add('suspense-shake-promo');
                await new Promise(r => setTimeout(r, 1200));
                const flash = document.createElement('div'); flash.className = 'promo-flash'; document.body.appendChild(flash); setTimeout(() => flash.remove(), 1200);
            } else if (pulledPlayer.isSuperHolo || rarity === 'ultra rare' || rarity === 'secret rare') {
                packVisual.classList.add('suspense-shake');
                await new Promise(r => setTimeout(r, 900));
                const flash = document.createElement('div'); flash.className = 'walkout-flash'; document.body.appendChild(flash); setTimeout(() => flash.remove(), 1500);
            } else {
                packVisual.classList.add('suspense-shake');
                await new Promise(r => setTimeout(r, 500));
            }
            packVisual.classList.remove('suspense-shake','suspense-shake-promo','suspense-shake-limited');
            if (rarity === 'limited' && pulledPlayer.isLimited) broadcastLimitedPull(pulledPlayer);
            const val = getCardValue(currentPull);
            const reveal = document.getElementById('pack-reveal');
            reveal.innerHTML = generateCardHtml(currentPull, false);
            document.getElementById('pack-visual').style.display = 'none';
            reveal.style.display = 'block';
            document.getElementById('choiceArea').style.display = 'flex';
            document.getElementById('sellBtn').innerText = `SELL (+${Math.floor(val * SELL_RATE)})`;
            updateUI();
            await saveGame();
        }

        async function loadGameSettings() {
            const { data, error } = await _supabase.from('game_settings').select('setting_key, setting_value');
            if (!data) return;
            data.forEach(row => {
                if (row.setting_key === 'holo_rules') holoConfig = row.setting_value;
                if (row.setting_key === 'weekly_featured_card') {
                    _featuredCardConfig = row.setting_value;
                    updateFeaturedCardBanner();
                }
            });
        }

        function updateFeaturedCardBanner() {
            const banner = document.getElementById('featured-card-banner');
            const titleEl = document.getElementById('featured-banner-title');
            const subEl = document.getElementById('featured-banner-sub');
            if (!banner) return;
            if (_featuredCardConfig?.card_id) {
                banner.style.display = 'flex';
                titleEl.innerText = _featuredCardConfig.label || 'FEATURED CARD THIS WEEK';
                subEl.innerText = `Earns ${_featuredCardConfig.multiplier || 2}× daycare income`;
            } else {
                banner.style.display = 'none';
            }
        }

        // ─── COIN SHOP ────────────────────────────────────────────────────────────
        async function loadShop() {
            const grid = document.getElementById('shop-grid');
            grid.innerHTML = '<div class="shop-loading">Loading shop...</div>';
            const now = new Date().toISOString();
            const { data, error } = await _supabase
                .from('coin_shop')
                .select('*, collection(*)')
                .eq('is_active', true)
                .lte('available_from', now)
                .gte('available_until', now);
            if (error || !data || data.length === 0) {
                grid.innerHTML = '<div class="shop-empty"><div style="font-size:2.5rem;margin-bottom:12px;">🛒</div><p>Shop is restocking — check back soon!</p></div>';
                return;
            }
            grid.innerHTML = data.map(item => {
                const card = item.collection;
                const stockColor = item.stock > 3 ? '#3ecf8e' : (item.stock > 0 ? '#ffd700' : '#ef4444');
                const canAfford = balance >= item.price;
                const inStock = item.stock > 0;
                return `<div class="shop-item ${!inStock ? 'out-of-stock' : ''}">
                    <div class="shop-item-card">${card ? generateCardHtml(card, false) : '<div class="shop-no-card">?</div>'}</div>
                    <div class="shop-item-info">
                        <div class="shop-item-name">${card?.name || item.name || 'Mystery Item'}</div>
                        <div class="shop-item-desc">${item.description || ''}</div>
                        <div class="shop-item-stock" style="color:${stockColor}">${inStock ? `${item.stock} LEFT` : 'SOLD OUT'}</div>
                        <div class="shop-item-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="shop-buy-btn ${!inStock || !canAfford ? 'disabled' : ''}"
                            onclick="${inStock && canAfford ? `buyShopItem('${item.id}')` : ''}"
                            ${!inStock || !canAfford ? 'disabled' : ''}>
                            ${!inStock ? 'SOLD OUT' : (!canAfford ? 'NOT ENOUGH COINS' : 'BUY NOW')}
                        </button>
                    </div>
                </div>`;
            }).join('');
            // Load tournament banner
            loadTournamentBanner();
        }

        async function buyShopItem(itemId) {
            const now = new Date().toISOString();
            const { data: item, error } = await _supabase.from('coin_shop').select('*, collection(*)').eq('id', itemId).single();
            if (error || !item) { showToast('❌ Item not found.'); return; }
            if (item.stock <= 0) { showToast('❌ Out of stock!'); return; }
            if (balance < item.price) { showToast('❌ Not enough coins!'); return; }
            balance -= item.price;
            // Decrement stock
            await _supabase.from('coin_shop').update({ stock: item.stock - 1 }).eq('id', itemId);
            // Add card to squad
            if (item.collection) {
                const newCard = { ...item.collection, instanceId: 'inst_' + Date.now(), collectedDate: new Date().toLocaleDateString() };
                mySquad.push(newCard);
                renderSquad();
                addXP(10);
            }
            updateUI();
            await saveGame();
            showToast(`✅ Purchased ${item.collection?.name || item.name}!`);
            loadShop();
            logActivity('shop_purchase', item.collection || null);
        }

        // ─── TOURNAMENT ───────────────────────────────────────────────────────────
        async function loadTournamentBanner() {
            const banner = document.getElementById('shop-tournament-banner');
            if (!banner) return;
            const { data } = await _supabase.from('tournaments').select('*').eq('is_active', true).gte('end_date', new Date().toISOString()).single();
            if (!data) { banner.style.display = 'none'; return; }
            banner.style.display = 'block';
            document.getElementById('tournament-title').innerText = `🏆 ${data.name}`;
            document.getElementById('tournament-sub').innerText = data.description || 'Compete for the top spot!';
            // Countdown
            const timeLeft = new Date(data.end_date) - new Date();
            const days = Math.floor(timeLeft / 86400000);
            const hours = Math.floor((timeLeft % 86400000) / 3600000);
            document.getElementById('tournament-timer').innerText = `⏱ ${days}d ${hours}h remaining`;
            // Prizes
            const prizes = data.prize_config || {};
            document.getElementById('tournament-prizes').innerHTML = Object.entries(prizes).map(([rank, coins]) =>
                `<span class="t-prize">#${rank}: ${Number(coins).toLocaleString()} 🪙</span>`
            ).join('');
        }

        async function checkTournamentPrizes() {
            // Check if a tournament just ended and the user is owed prizes
            const { data: tournaments } = await _supabase
                .from('tournaments')
                .select('*')
                .eq('winner_announced', false)
                .lt('end_date', new Date().toISOString());
            if (!tournaments || tournaments.length === 0) return;

            for (const t of tournaments) {
                if (_tournamentCoinsClaimedIds.includes(t.id)) continue;
                // Get final rankings
                const { data: rankings } = await _supabase
                    .from('user_saves')
                    .select('user_id, username, club_value')
                    .order('club_value', { ascending: false })
                    .limit(10);
                if (!rankings) continue;
                const myRank = rankings.findIndex(r => r.user_id === currentUser.id) + 1;
                if (myRank > 0 && t.prize_config[String(myRank)]) {
                    const prize = Number(t.prize_config[String(myRank)]);
                    balance += prize;
                    _tournamentCoinsClaimedIds.push(t.id);
                    showToast(`🏆 Tournament ended! You finished #${myRank} and won ${prize.toLocaleString()} 🪙!`, 8000);
                    updateUI(); saveGame();
                }
            }
        }

        async function loadTournamentRankings() {
            const section = document.getElementById('tournament-rank-section');
            const header = document.getElementById('tournament-rank-header');
            const list = document.getElementById('tournament-rank-list');
            if (!section) return;
            const { data } = await _supabase.from('tournaments').select('*').eq('is_active', true).gte('end_date', new Date().toISOString()).single();
            if (!data) { section.style.display = 'none'; return; }
            section.style.display = 'block';
            const timeLeft = new Date(data.end_date) - new Date();
            const days = Math.floor(timeLeft / 86400000), hrs = Math.floor((timeLeft % 86400000) / 3600000);
            header.innerHTML = `<span class="tournament-rank-name">🏆 ${data.name}</span><span class="tournament-rank-timer">Ends in ${days}d ${hrs}h</span>`;
            const { data: rankings } = await _supabase.from('user_saves').select('username, club_value').order('club_value', {ascending:false}).limit(10);
            if (!rankings) return;
            list.innerHTML = `<table class="rank-table"><tr><th>Rank</th><th>Trainer</th><th>DEX Value</th><th>Prize</th></tr>` +
                rankings.map((u, i) => {
                    const prize = data.prize_config[String(i+1)];
                    return `<tr><td>#${i+1}</td><td>${u.username||'ANONYMOUS'}</td><td style="color:#ffd700;font-weight:900">${u.club_value.toLocaleString()} 🪙</td><td style="color:#3ecf8e">${prize ? Number(prize).toLocaleString() + ' 🪙' : '—'}</td></tr>`;
                }).join('') + '</table>';
        }

        // ─── LEADERBOARD ─────────────────────────────────────────────────────────
        const BANNED_USERNAMES = ['yleer'];
        let _lbData = [];

        async function loadLeaderboard() {
            const podium = document.getElementById('podium-area');
            const list   = document.getElementById('leaderboard-container');
            podium.innerHTML = '<p style="color:#555566">FETCHING DATA...</p>';
            list.innerHTML = '';
            const { data, error } = await _supabase.from('user_saves').select('username, club_value, squad, level, trainer_title').order('club_value', {ascending:false}).limit(50);
            if (error) return;
            const filtered = (data||[]).filter(u => !BANNED_USERNAMES.includes((u.username||'').toLowerCase())).slice(0, 25);
            _lbData = filtered;
            let podiumHtml = '';
            for (let i = 0; i < Math.min(3, filtered.length); i++) {
                const user = filtered[i];
                let starCard = { name:"No Cards", type:"normal", rating:0, rarity:"basic", image_url:'' };
                if (user.squad && user.squad.length > 0) {
                    starCard = user.squad.find(c=>c.isShowcase) || user.squad.find(c=>c.isFavorite) || user.squad.reduce((prev,curr) => getCardValue(curr) > getCardValue(prev) ? curr : prev);
                }
                podiumHtml += `<div class="podium-slot slot-${i+1} clickable" onclick="openSquadViewer(${i})" title="View ${user.username||'ANONYMOUS'}'s collection">
                    <div class="podium-user">#${i+1} ${user.username||'ANONYMOUS'}</div>
                    ${user.trainer_title ? `<div class="podium-title-badge">${user.trainer_title}</div>` : ''}
                    <div class="podium-val">${user.club_value.toLocaleString()} 🪙</div>
                    <div class="podium-card-mini">${user.squad && user.squad.length > 0 ? generateCardHtml(starCard, false) : '<div style="height:100px;color:#333">EMPTY</div>'}</div>
                </div>`;
            }
            podium.innerHTML = podiumHtml;
            let tableHtml = `<table class="rank-table"><tr><th>Rank</th><th>Trainer</th><th>Level</th><th>DEX Value</th><th></th></tr>`;
            for (let i = 3; i < filtered.length; i++) {
                const u = filtered[i];
                tableHtml += `<tr class="rank-row-clickable" onclick="openSquadViewer(${i})">
                    <td>#${i+1}</td><td>${u.username||'ANONYMOUS'}</td>
                    <td><span class="rank-level-badge">LV${u.level||1}</span></td>
                    <td style="color:#ffd700;font-weight:bold;">${u.club_value.toLocaleString()} 🪙</td>
                    <td class="view-col">VIEW</td></tr>`;
            }
            list.innerHTML = tableHtml + '</table>';
            loadTournamentRankings();
        }

        function openSquadViewer(idx) {
            const user = _lbData[idx];
            if (!user) return;
            document.getElementById('sv-title').innerText = (user.username||'ANONYMOUS') + "'S COLLECTION";
            document.getElementById('sv-subtitle').innerText = `${(user.squad||[]).length} cards · DEX Value: ${user.club_value.toLocaleString()} 🪙`;
            const grid = document.getElementById('sv-grid');
            if (!user.squad || user.squad.length === 0) { grid.innerHTML = '<div class="sv-empty">This trainer has no cards yet.</div>'; }
            else { grid.innerHTML = [...user.squad].sort((a,b) => getCardValue(b)-getCardValue(a)).map(p => generateCardHtml(p,false)).join(''); }
            document.getElementById('squad-viewer-modal').style.display = 'flex';
        }
        function closeSquadViewer() { document.getElementById('squad-viewer-modal').style.display = 'none'; }

        // ─── TYPE HELPERS ─────────────────────────────────────────────────────────
        const TYPE_ICONS = { fire:'🔥', water:'💧', grass:'🌿', psychic:'🔮', fighting:'🥊', electric:'⚡', ice:'❄️', dragon:'🐉', dark:'🌑', normal:'⭐' };
        function getCardType(p) { return (p.type || 'normal').toLowerCase().trim(); }

        // ─── CARD HTML ───────────────────────────────────────────────────────────
        function generateCardHtml(p, clickable = true, clickType = 'details') {
            const rarity    = (p.rarity || 'basic').toLowerCase();
            const typeClass = getCardType(p);
            const typeIcon  = TYPE_ICONS[typeClass] || '⭐';
            const rarityClass = rarity.replace(' ', '-');
            const isFullArt = rarity === 'ultra rare' || rarity === 'secret rare' || rarity === 'limited' || rarity === '1st edition';
            const val = getCardValue(p);
            let clickAttr = '';
            if (clickable) {
                if (clickType === 'details') {
                    const target = p.instanceId ? `'${p.instanceId}'` : JSON.stringify(p).replace(/"/g, '&quot;');
                    clickAttr = `onclick="showCardDetails(${target})"`;
                } else {
                    clickAttr = `onclick="zoomCard(${JSON.stringify(p).replace(/"/g,'&quot;')})"`;
                }
            }
            return `
<div class="pokemon-card ${rarityClass} type-${typeClass}" ${clickAttr}>
    ${isFullArt ? `<img src="${p.image_url}" class="card-full-image">` : ''}
    <div class="card-header ${isFullArt ? 'full-art-ui' : ''}">
        <span class="card-stage">${typeIcon} ${typeClass.toUpperCase()}</span>
        <span class="card-name">${p.name}</span>
    </div>
    ${!isFullArt ? `<div class="card-portrait-frame"><img src="${p.image_url}" class="card-image"></div>` : ''}
    <div style="flex-grow:1;"></div>
    <div class="card-footer ${isFullArt ? 'full-art-ui bottom-gradient' : ''}">
        <div style="display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:2px;">
            <span style="font-weight:900;font-size:0.6rem;letter-spacing:1px;">${rarity.toUpperCase()}</span>
            <span style="color:#ffd700;font-weight:bold;font-size:0.6rem;">${p.isSuperHolo ? '✨ HOLO' : ''}</span>
        </div>
        <div style="text-align:right;">
            <div style="font-size:0.5rem;color:${isFullArt?'#ddd':'#555'};letter-spacing:1px;margin-bottom:2px;">VALUE</div>
            <div style="font-size:0.95rem;font-weight:900;line-height:1;">${val.toLocaleString()} 🪙</div>
        </div>
    </div>
    ${p.isSuperHolo ? '<div class="holo-sheen"></div>' : ''}
    ${p.serialNumber ? `<div class="card-serial">#${p.serialNumber}/10</div>` : ''}
</div>`;
        }

        // ─── CARD DETAILS MODAL ──────────────────────────────────────────────────
        let _modalCurrentId = null;
        function showCardDetails(idOrObj) {
            let p;
            if (typeof idOrObj === 'string') { p = mySquad.find(player => player.instanceId == idOrObj); }
            else { p = idOrObj; }
            if (!p) return;
            _modalCurrentId = p.instanceId || null;
            const val = getCardValue(p);
            document.getElementById('modal-card-render').innerHTML = generateCardHtml(p, true, 'zoom');
            document.getElementById('val-orig').innerText  = val.toLocaleString() + " 🪙";
            const sellVal = getSellValue(p);
            document.getElementById('val-sell').innerText  = p.instanceId ? sellVal.toLocaleString() + " 🪙" : 'NOT OWNED';
            document.getElementById('val-date').innerText  = p.collectedDate || "Not in Collection";
            const sellBtn = document.getElementById('modal-sell-btn');
            const favBtn  = document.getElementById('modal-fav-btn');
            const scBtn   = document.getElementById('modal-showcase-btn');
            const isOwned = !!p.instanceId;
            [sellBtn, favBtn, scBtn].forEach(btn => btn.style.display = isOwned ? 'block' : 'none');
            if (isOwned) {
                favBtn.innerText = p.isFavorite ? '⭐ FAVOURITED' : '☆ FAVOURITE';
                scBtn.innerText = p.isShowcase ? '🏆 CURRENT SHOWCASE' : '🏆 SET AS SHOWCASE';
                if (p.isFavorite) { sellBtn.disabled = true; sellBtn.innerText = '⭐ UNFAVOURITE TO SELL'; }
                else if (_lockedCardIds.has(p.instanceId)) { sellBtn.disabled = true; sellBtn.innerText = '🔒 LOCKED IN TRADE'; }
                else { sellBtn.disabled = false; sellBtn.innerText = `QUICK SELL (+${sellVal.toLocaleString()} 🪙)`; sellBtn.onclick = () => { if(confirm(`Sell ${p.name}?`)) finalizeSale(p.instanceId); }; }
            }
            document.getElementById('modal-overlay').style.display = 'flex';
        }

        function zoomCard(p) {
            const overlay = document.getElementById('card-zoom-overlay');
            document.getElementById('zoom-content').innerHTML = generateCardHtml(p, false);
            overlay.style.display = 'flex';
        }

        async function modalToggleFavorite() { if (!_modalCurrentId) return; await toggleFavorite(_modalCurrentId); showCardDetails(_modalCurrentId); }
        async function modalToggleShowcase() {
            if (!_modalCurrentId) return;
            mySquad.forEach(c => c.isShowcase = false);
            const p = mySquad.find(c => c.instanceId === _modalCurrentId);
            if (p) p.isShowcase = true;
            renderSquad(); await saveGame(); showCardDetails(_modalCurrentId);
            showToast(`🏆 ${p.name} is now your Showcase Card!`);
        }
        async function finalizeSale(id) {
            const index = mySquad.findIndex(p => p.instanceId == id);
            if (index > -1) {
                balance += Math.floor(getCardValue(mySquad[index]) * SELL_RATE);
                mySquad.splice(index, 1);
                closeModal(); updateUI(); renderSquad(); await saveGame();
            }
        }
        function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
        async function toggleFavorite(id) {
            const p = mySquad.find(c => c.instanceId === id);
            if (!p) return; p.isFavorite = !p.isFavorite; renderSquad(); await saveGame();
        }

        // ─── VIEW MANAGEMENT ─────────────────────────────────────────────────────
        function showView(id) {
            if (id !== 'slots' && currentPull) {
                currentPull.instanceId    = currentPull.instanceId    || ('inst_' + Date.now());
                currentPull.collectedDate = currentPull.collectedDate || new Date().toLocaleDateString();
                mySquad.push(currentPull);
                renderSquad();
                showToast('✅ ' + currentPull.name + ' auto-added to collection');
                currentPull = null; saveGame();
            }
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            document.getElementById('view-' + id).classList.add('active');
            const navBtn = document.getElementById('nav-' + id);
            if (navBtn) navBtn.classList.add('active');
            if (id === 'rank')      loadLeaderboard();
            if (id === 'office')    renderOfficeView();
            if (id === 'exchanges') { loadExchangeState().then(renderExchanges); }
            if (id === 'trade')     switchTradeTab('board');
            if (id === 'arena')     arenaToLobby();
            if (id === 'slots')     { resetUI(); closeCatalog(); initDailyReward(); }
            if (id === 'shop')      loadShop();
            if (id === 'home')      { updateStreakDisplay(); renderDailyChallenges(); }
            if (id !== 'team')      exitMultiSelect();
        }

        async function keepPlayer() {
            mySquad.push(currentPull);
            const rarity = (currentPull.rarity || '').toLowerCase();
            tickChallenge('keep_cards', 1);
            if (rarity === 'ultra rare' || rarity === 'secret rare' || rarity === 'limited') {
                tickChallenge('keep_rare', 1);
                logActivity(rarity === 'ultra rare' ? 'pulled_ultra' : (rarity === 'secret rare' ? 'pulled_secret' : 'pulled_limited'), currentPull);
            }
            const type = getCardType(currentPull);
            if (type === 'fire') tickChallenge('keep_fire', 1);
            if (type === 'water') tickChallenge('keep_water', 1);
            if (type === 'grass') tickChallenge('keep_grass', 1);
            addXP(10);
            currentPull = null; renderSquad(); resetUI(); await saveGame();
        }
        async function sellPlayer() { balance += Math.floor(getCardValue(currentPull) * SELL_RATE); currentPull = null; resetUI(); await saveGame(); }

        function resetUI() {
            document.getElementById('choiceArea').style.display = 'none';
            document.getElementById('pack-reveal').style.display = 'none';
            document.getElementById('pack-visual').style.display = 'none';
            document.getElementById('packArea').style.display = 'block';
            document.getElementById('default-message').style.display = 'block';
            updateUI();
        }

        function updateUI() {
            document.querySelectorAll('.bal-text').forEach(el => el.innerText = balance.toLocaleString());
            document.querySelectorAll('.team-count-menu').forEach(el => el.innerText = mySquad.length);
            const dexScore = [...mySquad].sort((a,b)=>getCardValue(b)-getCardValue(a)).slice(0,10).reduce((sum,p)=>sum+getCardValue(p),0);
            document.getElementById('nav-dex-value').innerText = dexScore.toLocaleString();
            document.getElementById('team-count').innerText = mySquad.length;
        }

        // ─── TYPE FILTER + RENDER COLLECTION ─────────────────────────────────────
        function filterSquad(type, btn) {
            _activeTypeFilter = type;
            document.querySelectorAll('.team-filter-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
            renderSquad();
        }

        function renderSquad() {
            const grid = document.getElementById('squad-grid');
            let displayList = [...mySquad];
            if (_activeTypeFilter === 'favorites') displayList = displayList.filter(p => p.isFavorite);
            else if (_activeTypeFilter !== 'all') displayList = displayList.filter(p => getCardType(p) === _activeTypeFilter);
            displayList.sort((a, b) => getCardValue(b) - getCardValue(a));
            if (displayList.length === 0) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#333;padding:60px;font-size:0.85rem;letter-spacing:1px;">NO CARDS MATCH THIS FILTER</div>';
                updateUI(); return;
            }
            grid.innerHTML = displayList.map(p => {
                const isSelected = multiSelectMode && multiSelectIds.has(p.instanceId);
                return `<div class="squad-card-wrap ${isSelected ? 'ms-selected' : ''}" onclick="squadCardClick(event, '${p.instanceId}')">${generateCardHtml(p, !multiSelectMode)}</div>`;
            }).join('');
            updateUI(); updatePlaytimeLabel(); updateExchangeBadge();
        }

        // ─── CATALOG ─────────────────────────────────────────────────────────────
        function openCatalog() {
            document.getElementById('slot-container').style.display = 'none';
            document.getElementById('catalog-toggle-btn').style.display = 'none';
            document.getElementById('catalog-grid').style.display = 'flex';
            loadCatalog('basic');
        }
        function closeCatalog() {
            document.getElementById('catalog-grid').style.display = 'none';
            document.getElementById('slot-container').style.display = 'flex';
            document.getElementById('catalog-toggle-btn').style.display = 'block';
        }
        async function loadCatalog(tier) {
            showLoading();
            let query = _supabase.from('collection').select('*');
            if (tier === 'holo') query = query.eq('isSuperHolo', true);
            else query = query.ilike('rarity', tier);
            const { data, error } = await query;
            hideLoading();
            const grid = document.getElementById('catalog-cards');
            if (error) { grid.innerHTML = `<p style="color:red">Error: ${error.message}</p>`; return; }
            data.sort((a, b) => getCardValue(b) - getCardValue(a));
            grid.innerHTML = data.map(p => generateCardHtml(p, true, 'details')).join('');
        }

        // ─── MULTI-SELECT ─────────────────────────────────────────────────────────
        let multiSelectMode = false;
        let multiSelectIds  = new Set();
        function squadCardClick(event, id) {
            if (multiSelectMode) { multiSelectIds.has(id) ? multiSelectIds.delete(id) : multiSelectIds.add(id); renderSquad(); }
            else { showCardDetails(id); }
        }
        function exitMultiSelect() { multiSelectMode = false; multiSelectIds.clear(); }

        // ─── PLAYTIME TRACKING ────────────────────────────────────────────────────
        let _sessionStart = Date.now();
        let _totalHoursPlayed = 0;
        function startPlaytimeTracking() { _sessionStart = Date.now(); }
        async function flushPlaytime() {
            const sessionHours = (Date.now() - _sessionStart) / (1000*60*60);
            _totalHoursPlayed += sessionHours; _sessionStart = Date.now();
        }
        function updatePlaytimeLabel() {
            const el = document.getElementById('squad-playtime-footer');
            if (!el) return;
            const h = Math.floor(_totalHoursPlayed), m = Math.floor((_totalHoursPlayed - h) * 60);
            el.innerHTML = `TIME PLAYED: <span>${h}h ${m}m</span>`;
        }

        // ─── DAILY CHALLENGES ────────────────────────────────────────────────────
        let _dailyChallenges = null;
        const CHALLENGE_DEFINITIONS = [
            { id: 'open_packs',  label: '🎴 Open 3 packs',         target: 3,  reward: 300 },
            { id: 'keep_cards',  label: '📦 Keep 5 cards',          target: 5,  reward: 500 },
            { id: 'keep_rare',   label: '✨ Keep 1 Ultra Rare+',     target: 1,  reward: 1000 },
            { id: 'keep_fire',   label: '🔥 Collect 2 Fire cards',  target: 2,  reward: 400 },
            { id: 'keep_water',  label: '💧 Collect 2 Water cards', target: 2,  reward: 400 },
            { id: 'keep_grass',  label: '🌿 Collect 2 Grass cards', target: 2,  reward: 400 },
        ];

        function getTodayKey() { return new Date().toDateString(); }
        function initDailyChallengesState() {
            const todayKey = getTodayKey();
            if (!_dailyChallenges || _dailyChallenges.date !== todayKey) {
                const progress = {};
                CHALLENGE_DEFINITIONS.forEach(c => { progress[c.id] = { count: 0, claimed: false }; });
                _dailyChallenges = { date: todayKey, progress };
            }
        }

        function renderDailyChallenges() {
            initDailyChallengesState();
            const panel = document.getElementById('daily-challenges-panel');
            if (!panel) return;
            const prog = _dailyChallenges.progress;
            const allDone = CHALLENGE_DEFINITIONS.every(c => prog[c.id]?.claimed);
            panel.innerHTML = `
                <div class="challenges-header">📋 DAILY CHALLENGES</div>
                ${allDone ? '<div class="challenges-all-done">🎉 ALL CHALLENGES COMPLETE! Come back tomorrow.</div>' : ''}
                ${CHALLENGE_DEFINITIONS.map(c => {
                    const p = prog[c.id] || { count: 0, claimed: false };
                    const pct = Math.min((p.count / c.target) * 100, 100);
                    const done = p.claimed, ready = !done && p.count >= c.target;
                    return `<div class="challenge-row ${done ? 'done' : (ready ? 'ready' : '')}">
                        <div class="challenge-info">
                            <div class="challenge-label">${c.label}</div>
                            <div class="challenge-bar-wrap"><div class="challenge-bar" style="width:${pct}%"></div></div>
                            <div class="challenge-progress">${Math.min(p.count, c.target)} / ${c.target}</div>
                        </div>
                        <div class="challenge-reward">+${c.reward.toLocaleString()} 🪙</div>
                        ${ready ? `<button class="challenge-claim-btn" onclick="claimChallenge('${c.id}')">CLAIM</button>` : ''}
                        ${done ? `<div class="challenge-claimed">✓</div>` : ''}
                    </div>`;
                }).join('')}`;
        }

        function tickChallenge(id, amount) {
            initDailyChallengesState();
            const prog = _dailyChallenges.progress;
            if (prog[id] && !prog[id].claimed) { prog[id].count += amount; renderDailyChallenges(); saveGame(); }
        }

        async function claimChallenge(id) {
            initDailyChallengesState();
            const def = CHALLENGE_DEFINITIONS.find(c => c.id === id);
            const prog = _dailyChallenges.progress;
            if (!def || !prog[id] || prog[id].claimed || prog[id].count < def.target) return;
            prog[id].claimed = true;
            balance += def.reward;
            addXP(20);
            updateUI(); renderDailyChallenges(); await saveGame();
            showToast(`🎉 Challenge complete! +${def.reward.toLocaleString()} 🪙`);
        }

        // ─── DAILY REWARD ─────────────────────────────────────────────────────────
        async function initDailyReward() {
            const banner = document.getElementById('daily-collect-banner');
            const btn    = document.getElementById('daily-collect-btn');
            const sub    = document.getElementById('daily-collect-sub');
            if (!banner) return;
            const { data } = await _supabase.from('user_saves').select('last_daily_collect').eq('user_id', currentUser.id).single();
            const alreadyClaimed = data?.last_daily_collect && new Date(data.last_daily_collect).toDateString() === new Date().toDateString();
            banner.style.display = 'flex';
            if (alreadyClaimed) {
                banner.className = 'daily-collect-banner done';
                sub.innerText = 'Come back tomorrow for your next reward!';
                btn.className = 'daily-collect-btn done'; btn.innerText = 'COLLECTED';
            } else {
                banner.className = 'daily-collect-banner ready';
                sub.innerText = `Claim your free ${Math.max(150, _trainerLevel * 150).toLocaleString()} 🪙 daily reward!`;
                btn.className = 'daily-collect-btn ready'; btn.innerText = 'COLLECT';
            }
        }

        async function claimDailyReward() {
            const DAILY_REWARD = Math.max(150, _trainerLevel * 150);
            const { data } = await _supabase.from('user_saves').select('last_daily_collect').eq('user_id', currentUser.id).single();
            if (data?.last_daily_collect && new Date(data.last_daily_collect).toDateString() === new Date().toDateString()) { showToast('Already claimed today!'); return; }
            balance += DAILY_REWARD;
            await _supabase.from('user_saves').upsert({ user_id: currentUser.id, last_daily_collect: new Date().toISOString() }, { onConflict: 'user_id' });
            updateUI(); initDailyReward();
            showToast(`🎁 Daily reward claimed! +${DAILY_REWARD.toLocaleString()} 🪙 (Level ${_trainerLevel} bonus)`);
        }

        // ─── SHARE COLLECTION ─────────────────────────────────────────────────────
        function openShareModal() {
            const username = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'trainer';
            const shareUrl = `${window.location.origin}${window.location.pathname}?view=${encodeURIComponent(username)}`;
            document.getElementById('share-link-input').value = shareUrl;
            document.getElementById('share-copy-confirm').innerText = '';
            const top5 = [...mySquad].sort((a,b) => getCardValue(b)-getCardValue(a)).slice(0,5);
            document.getElementById('share-preview-cards').innerHTML = top5.map(p => generateCardHtml(p, false)).join('');
            document.getElementById('share-modal').style.display = 'flex';
        }
        function closeShareModal() { document.getElementById('share-modal').style.display = 'none'; }
        function copyShareLink() {
            const input = document.getElementById('share-link-input');
            navigator.clipboard.writeText(input.value).then(() => {
                document.getElementById('share-copy-confirm').innerText = '✓ LINK COPIED TO CLIPBOARD!';
            }).catch(() => { input.select(); document.execCommand('copy'); document.getElementById('share-copy-confirm').innerText = '✓ LINK COPIED!'; });
        }

        async function checkSharedView() {
            const params = new URLSearchParams(window.location.search);
            const viewUser = params.get('view');
            if (!viewUser) return false;
            showLoading();
            const { data } = await _supabase.from('user_saves').select('username, squad, club_value').ilike('username', viewUser).single();
            hideLoading();
            if (!data) { showToast('Trainer not found.'); return false; }
            document.getElementById('view-landing').style.display = 'none';
            document.getElementById('sv-title').innerText    = (data.username || viewUser).toUpperCase() + "'S COLLECTION";
            document.getElementById('sv-subtitle').innerText = `${(data.squad||[]).length} cards · DEX Value: ${(data.club_value||0).toLocaleString()} 🪙`;
            const sorted = [...(data.squad||[])].sort((a,b) => getCardValue(b)-getCardValue(a));
            document.getElementById('sv-grid').innerHTML = sorted.length > 0 ? sorted.map(p => generateCardHtml(p,false)).join('') : '<div class="sv-empty">No cards yet.</div>';
            document.getElementById('squad-viewer-modal').style.display = 'flex';
            document.getElementById('squad-viewer-modal').querySelector('.sv-close').onclick = () => {
                document.getElementById('squad-viewer-modal').style.display = 'none';
                document.getElementById('view-landing').style.display = '';
            };
            return true;
        }

        // ─── PRESENCE ────────────────────────────────────────────────────────────
        function setupPresence() { /* real-time presence code here */ }

        // ─── PACK WEIGHT INFO ─────────────────────────────────────────────────────
        function showPackWeights(tier) {
            const weights = { std:'Basic: 60%  ·  Rare: 35%  ·  Ultra Rare: 5%', pre:'Rare: 50%  ·  Ultra Rare: 40%  ·  Secret Rare: 10%', elt:'Ultra Rare: 50%  ·  Secret Rare: 40%  ·  Limited: 10%', promo:'1st Edition guaranteed  ·  Limited: 5%' };
            showToast(`📊 ${tier.toUpperCase()} ODDS: ${weights[tier] || 'See store for details'}`, 5000);
        }

        // ─── TRADE SYSTEM ────────────────────────────────────────────────────────
        let _tradeConfirmMode = 'board';
        function handleTradeConfirm() {
            if (_tradeConfirmMode === 'incoming') { const trade = tradeState.pendingAcceptTrade; if (trade) executeSwap(trade); }
            else { finaliseAccept(); }
        }
        let tradeState = { activeTab:'board', postSelectedCard:null, wantRarity:'any', wantMinRating:4, pendingAcceptTrade:null, pendingAcceptMyCard:null };
        let tradePollInterval = null;

        function getWantDescription(trade) {
            const parts = [];
            if (trade.want_rarity && trade.want_rarity !== 'any') { const labels = {common:'Basic',silver:'Rare',gold:'Ultra Rare',limited:'Limited',holo:'Secret Rare'}; parts.push(labels[trade.want_rarity]||trade.want_rarity); }
            if (trade.want_min_rating && trade.want_min_rating > 1) parts.push('Rating ' + trade.want_min_rating + '+');
            if (trade.want_name) parts.push('"' + trade.want_name + '"');
            return parts.length ? parts.join(' · ') : 'Any Card';
        }

        function switchTradeTab(tab) {
            tradeState.activeTab = tab;
            document.querySelectorAll('.trade-tab').forEach((b,i) => { const tabs=['board','mine','incoming','post']; b.classList.toggle('active', tabs[i]===tab); });
            document.querySelectorAll('.trade-tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('trade-panel-' + tab).classList.add('active');
            if (tab === 'board')    loadTradeBoard();
            if (tab === 'mine')     loadMyTrades();
            if (tab === 'incoming') loadIncomingTrades();
            if (tab === 'post')     renderPostOfferGrid();
        }

        function renderPostOfferGrid() {
            const grid = document.getElementById('post-pick-grid');
            if (mySquad.length === 0) { grid.innerHTML = '<p style="color:#555566;font-size:0.8rem;">No cards yet.</p>'; return; }
            grid.innerHTML = mySquad.sort((a,b) => getCardValue(b)-getCardValue(a)).map(p => `
                <div class="pick-card-wrap ${tradeState.postSelectedCard?.instanceId === p.instanceId ? 'selected' : ''}" onclick="selectPostCard('${p.instanceId}')">
                    ${generateCardHtml(p, false)}</div>`).join('');
            updateWantSummary();
        }

        function selectPostCard(id) { tradeState.postSelectedCard = mySquad.find(p => p.instanceId === id) || null; renderPostOfferGrid(); }

        function toggleWantRarity(btn) {
            document.querySelectorAll('.want-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active'); tradeState.wantRarity = btn.dataset.rarity; updateWantSummary();
        }

        function updateWantRatingLabel() {
            const v = document.getElementById('want-rating-min').value;
            tradeState.wantMinRating = parseInt(v);
            document.getElementById('want-rating-label').innerText = v + '+'; updateWantSummary();
        }

        function updateWantSummary() {
            const nameVal = (document.getElementById('want-name-input')?.value||'').trim();
            const rarity = document.querySelector('.want-filter-btn.active')?.dataset.rarity || 'any';
            const minRat = tradeState.wantMinRating;
            const submitBtn = document.getElementById('post-offer-submit-btn');
            let parts = [];
            if (rarity !== 'any') { const labels={common:'Basic',silver:'Rare',gold:'Ultra Rare',limited:'Limited',holo:'Secret Rare'}; parts.push(labels[rarity]||rarity); }
            if (minRat > 1) parts.push('Rating ' + minRat + '+');
            if (nameVal) parts.push(`"${nameVal}"`);
            const summary = document.getElementById('want-summary');
            if (summary) summary.innerText = parts.length ? parts.join(' · ') : 'Any card will do';
            if (submitBtn) { const hasCard = !!tradeState.postSelectedCard; submitBtn.disabled = !hasCard; submitBtn.innerText = hasCard ? 'POST TRADE OFFER' : 'SELECT A CARD TO CONTINUE'; }
        }

        async function submitTradeOffer() {
            if (!tradeState.postSelectedCard) return;
            const wantName = (document.getElementById('want-name-input')?.value||'').trim();
            const { error } = await _supabase.from('trades').insert({
                sender_id: currentUser.id,
                sender_username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
                offered_card: tradeState.postSelectedCard,
                want_rarity: tradeState.wantRarity, want_min_rating: tradeState.wantMinRating,
                want_name: wantName || null, status: 'open', created_at: new Date().toISOString()
            });
            if (error) { showToast('❌ Error posting trade: ' + error.message); return; }
            tradeState.postSelectedCard = null; showToast('✅ Trade offer posted!'); switchTradeTab('mine');
        }

        async function loadTradeBoard() {
            const list = document.getElementById('trade-board-list');
            list.innerHTML = '<div class="no-trades"><div class="nt-icon">⏳</div><p>LOADING...</p></div>';
            const { data, error } = await _supabase.from('trades').select('*').eq('status','open').neq('sender_id', currentUser.id).order('created_at',{ascending:false}).limit(30);
            if (error || !data || data.length === 0) { list.innerHTML = '<div class="no-trades"><div class="nt-icon">📋</div><p>NO OPEN OFFERS RIGHT NOW</p></div>'; return; }
            list.innerHTML = data.map(t => `<div class="trade-card"><div class="trade-mini-card">${generateCardHtml(t.offered_card,false)}</div><div class="trade-arrow">→</div><div class="trade-want-info"><div class="trade-want-title">WANTS IN RETURN</div><div class="trade-want-val">${getWantDescription(t)}</div><div class="trade-want-sub">by ${t.sender_username||'ANONYMOUS'}</div></div><div class="trade-actions"><button class="trade-btn accept" onclick="openPickModal('${t.id}')">OFFER CARD</button></div></div>`).join('');
        }

        async function loadMyTrades() {
            const list = document.getElementById('trade-mine-list');
            list.innerHTML = '<div class="no-trades"><div class="nt-icon">⏳</div><p>LOADING...</p></div>';
            const { data } = await _supabase.from('trades').select('*').eq('sender_id', currentUser.id).in('status',['open','pending']).order('created_at',{ascending:false});
            if (!data || data.length === 0) { list.innerHTML = '<div class="no-trades"><div class="nt-icon">📋</div><p>NO ACTIVE OFFERS</p></div>'; return; }
            _myPendingTradeIds = data.filter(t => t.status === 'pending').map(t => t.id);
            list.innerHTML = data.map(t => `<div class="trade-card mine"><div class="trade-mini-card">${generateCardHtml(t.offered_card,false)}</div><div class="trade-arrow">→</div><div class="trade-want-info"><div class="trade-want-title">YOU WANT</div><div class="trade-want-val">${getWantDescription(t)}</div><div class="trade-want-sub" style="color:${t.status==='pending'?'#ffd700':'#555566'}">${t.status.toUpperCase()}</div></div><div class="trade-actions"><button class="trade-btn cancel" onclick="cancelTrade('${t.id}')">CANCEL</button></div></div>`).join('');
        }

        async function loadIncomingTrades() {
            const list = document.getElementById('trade-incoming-list');
            list.innerHTML = '<div class="no-trades"><div class="nt-icon">⏳</div><p>LOADING...</p></div>';
            const { data } = await _supabase.from('trades').select('*').eq('receiver_id', currentUser.id).eq('status','pending').order('created_at',{ascending:false});
            const countEl = document.getElementById('incoming-count-tab');
            if (countEl) countEl.innerText = data && data.length > 0 ? `(${data.length})` : '';
            if (!data || data.length === 0) { list.innerHTML = '<div class="no-trades"><div class="nt-icon">📬</div><p>NO INCOMING TRADE REQUESTS</p></div>'; return; }
            list.innerHTML = data.map(t => `<div class="trade-card incoming"><div class="trade-mini-card">${generateCardHtml(t.offered_card,false)}</div><div class="trade-arrow">⇄</div><div class="trade-mini-card">${generateCardHtml(t.receiver_card,false)}</div><div class="trade-want-info"><div class="trade-want-title">FROM ${t.sender_username||'ANONYMOUS'}</div><div class="trade-want-val">Trade Request</div></div><div class="trade-actions"><button class="trade-btn accept" onclick="showAcceptModal('${t.id}')">REVIEW</button><button class="trade-btn decline" onclick="declineTrade('${t.id}')">DECLINE</button></div></div>`).join('');
        }

        let _currentPickTradeId = null;
        function openPickModal(tradeId) {
            _currentPickTradeId = tradeId;
            const eligible = mySquad.filter(c => !_lockedCardIds.has(c.instanceId));
            const grid = document.getElementById('trade-pick-grid');
            if (eligible.length === 0) { showToast('No eligible cards to offer.'); return; }
            grid.innerHTML = eligible.sort((a,b)=>getCardValue(b)-getCardValue(a)).map(p => `<div class="pick-card-wrap" onclick="selectPickCard('${p.instanceId}',this)">${generateCardHtml(p,false)}</div>`).join('');
            document.getElementById('trade-pick-modal').style.display = 'flex';
        }

        let _pickedCardForTrade = null;
        function selectPickCard(id, wrap) {
            _pickedCardForTrade = mySquad.find(p => p.instanceId === id);
            document.querySelectorAll('.trade-pick-grid .pick-card-wrap').forEach(w => w.classList.remove('selected'));
            wrap.classList.add('selected');
        }

        async function finaliseAccept() {
            if (!_pickedCardForTrade || !_currentPickTradeId) return;
            const { error } = await _supabase.from('trades').update({
                receiver_id: currentUser.id,
                receiver_username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
                receiver_card: _pickedCardForTrade, status: 'pending'
            }).eq('id', _currentPickTradeId);
            if (error) { showToast('❌ Error: ' + error.message); return; }
            closePickModal(); showToast('✅ Offer sent! Waiting for confirmation.'); await updateLockedCards();
        }

        function closePickModal() { document.getElementById('trade-pick-modal').style.display = 'none'; _pickedCardForTrade = null; _currentPickTradeId = null; }

        async function showAcceptModal(tradeId) {
            const { data: t } = await _supabase.from('trades').select('*').eq('id', tradeId).single();
            if (!t) return;
            tradeState.pendingAcceptTrade = t; _tradeConfirmMode = 'incoming';
            document.getElementById('tam-from').innerText = `From: ${t.sender_username||'ANONYMOUS'}`;
            document.getElementById('tam-recv-card').innerHTML = generateCardHtml(t.offered_card, false);
            document.getElementById('tam-send-card').innerHTML = generateCardHtml(t.receiver_card, false);
            document.getElementById('trade-accept-modal').style.display = 'flex';
        }

        function closeTAModal() { document.getElementById('trade-accept-modal').style.display = 'none'; tradeState.pendingAcceptTrade = null; }

        async function executeSwap(trade) {
            mySquad = mySquad.filter(c => c.instanceId !== trade.receiver_card.instanceId);
            const newCard = { ...trade.offered_card, instanceId: 'inst_' + Date.now(), collectedDate: new Date().toLocaleDateString() };
            mySquad.push(newCard);
            await _supabase.from('trades').update({ status: 'completed' }).eq('id', trade.id);
            closeTAModal(); renderSquad(); updateUI(); await saveGame();
            showToast('🔄 Trade complete! You received ' + trade.offered_card.name);
            logActivity('completed_exchange', newCard);
            addXP(15);
        }

        async function cancelTrade(id) { await _supabase.from('trades').update({ status: 'cancelled' }).eq('id', id); loadMyTrades(); showToast('Trade cancelled.'); }
        async function declineTrade(id) { await _supabase.from('trades').update({ status: 'open', receiver_id: null, receiver_card: null }).eq('id', id); loadIncomingTrades(); showToast('Trade declined.'); }

        function startTradePoll() {
            stopTradePoll();
            tradePollInterval = setInterval(async () => {
                if (!currentUser) return;
                const { data } = await _supabase.from('trades').select('id').eq('receiver_id', currentUser.id).eq('status','pending').limit(1);
                const badge = document.getElementById('trade-badge');
                const countEl = document.getElementById('incoming-count-tab');
                if (data && data.length > 0) { if (badge) badge.style.display = 'flex'; if (countEl) countEl.innerText = `(${data.length})`; }
                else { if (badge) badge.style.display = 'none'; if (countEl) countEl.innerText = ''; }
            }, 15000);
        }
        function stopTradePoll() { if (tradePollInterval) { clearInterval(tradePollInterval); tradePollInterval = null; } }

        function handleSquadNavClick(e) { document.getElementById('nav-squad-menu').classList.toggle('open'); e.stopPropagation(); }
        function closeNavDropdown() { document.getElementById('nav-squad-menu').classList.remove('open'); }
        document.addEventListener('click', () => closeNavDropdown());

        // ─── ARENA ───────────────────────────────────────────────────────────────
        function arenaToLobby() { document.querySelectorAll('.arena-phase').forEach(p => p.classList.remove('active-phase')); document.getElementById('arena-lobby').classList.add('active-phase'); }
        function arenaShowPhase(id) { document.querySelectorAll('.arena-phase').forEach(p => p.classList.remove('active-phase')); document.getElementById(id).classList.add('active-phase'); }

        async function getArenaCard(highStakes = false) {
            const pack = highStakes ? _eltPackData : _stdPackData;
            if (!pack || !pack.odds_config || pack.odds_config.length === 0) {
                const minRating = highStakes ? 6 : 4;
                const { data } = await _supabase.from('collection').select('*').gte('rating', minRating).lte('rating', 10).neq('rarity','Limited').neq('rarity','1st edition').eq('in_packs', true).limit(50);
                return data[Math.floor(Math.random() * data.length)];
            }
            const roll = Math.random() * 100;
            const rules = pack.odds_config;
            let cumulative = 0, rule = rules[rules.length-1];
            for (const r of rules) { cumulative += r.chance; if (roll < cumulative) { rule = r; break; } }
            const { data } = await _supabase.from('collection').select('*')
                .gte('rating', rule.min).lte('rating', rule.max)
                .neq('rarity', 'Limited').neq('rarity', '1st edition').eq('in_packs', true);
            if (!data || data.length === 0) return null;
            return data[Math.floor(Math.random() * data.length)];
        }

        function getBattleValue(attacker, defender) {
            let val = getCardValue(attacker);
            if (TYPE_ADVANTAGES[getCardType(attacker)] === getCardType(defender)) val = Math.floor(val * TYPE_ADV_MULTIPLIER);
            return val;
        }

        async function startArenaBattle(highStakes = false) {
            window._lastBattleHighStakes = highStakes;
            const ENTRY = highStakes ? 5000 : 500;
            const WIN_BONUS = highStakes ? 5000 : 500;
            if (balance < ENTRY) { showToast(`⚠ You need ${ENTRY.toLocaleString()} 🪙 to enter.`); return; }
            if (!_stdPackData) await prefetchStdPack();
            balance -= ENTRY; updateUI(); arenaShowPhase('arena-rolling');
            const labels = ['DRAWING CARDS...','CHECKING DEX...','CHOOSING POKÉMON...','BATTLE STARTING...'];
            let li = 0;
            const lblEl = document.getElementById('arena-rolling-lbl');
            const lblInterval = setInterval(() => { lblEl.innerText = labels[li++ % labels.length]; }, 600);
            const [pCard, bCard] = await Promise.all([getArenaCard(highStakes), getArenaCard(highStakes), new Promise(r => setTimeout(r, 1600))]);
            clearInterval(lblInterval);
            if (!pCard || !bCard) { balance += ENTRY; updateUI(); arenaToLobby(); showToast('❌ Connection error. Entry fee refunded.'); return; }
            pCard.instanceId = 'inst_' + Date.now(); pCard.collectedDate = new Date().toLocaleDateString();
            const pVal = getBattleValue(pCard, bCard), bVal = getBattleValue(bCard, pCard);
            const pType = getCardType(pCard), bType = getCardType(bCard);
            let typeAdvMsg = '';
            if (TYPE_ADVANTAGES[pType] === bType) typeAdvMsg = `⚡ TYPE ADVANTAGE: Your ${pType.toUpperCase()} beats ${bType.toUpperCase()}! (+20%)`;
            else if (TYPE_ADVANTAGES[bType] === pType) typeAdvMsg = `⚡ TYPE DISADVANTAGE: Bot's ${bType.toUpperCase()} beats your ${pType.toUpperCase()}`;
            let bannerClass, bannerText, msg;
            if (pVal > bVal) {
                bannerClass = 'win'; bannerText = 'VICTORY';
                msg = `Your ${pCard.name} (${pVal.toLocaleString()} 🪙) beats Bot's ${bCard.name} (${bVal.toLocaleString()} 🪙). Card kept + ${WIN_BONUS.toLocaleString()} 🪙!`;
                balance += WIN_BONUS; mySquad.push(pCard); renderSquad();
                addXP(25); logActivity('won_battle', pCard);
                tickChallenge('keep_cards', 1);
            } else if (pVal === bVal) {
                bannerClass = 'tie'; bannerText = 'DRAW';
                msg = `Both drew equal value. Entry fee refunded.`; balance += ENTRY;
            } else {
                bannerClass = 'loss'; bannerText = 'DEFEAT';
                msg = `Bot's ${bCard.name} (${bVal.toLocaleString()} 🪙) beats your ${pCard.name} (${pVal.toLocaleString()} 🪙). Card burned.`;
            }
            updateUI(); await saveGame();
            document.getElementById('arena-banner').className = 'arena-banner ' + bannerClass;
            document.getElementById('arena-banner').innerText = bannerText;
            const typeAdvEl = document.getElementById('arena-type-adv-msg');
            typeAdvEl.innerText = typeAdvMsg; typeAdvEl.style.display = typeAdvMsg ? 'block' : 'none';
            document.getElementById('arena-card-player').innerHTML = `<div class="arena-flipin">${generateCardHtml(pCard, false)}</div>`;
            document.getElementById('arena-card-bot').innerHTML    = `<div class="arena-flipin" style="animation-delay:0.18s">${generateCardHtml(bCard, false)}</div>`;
            const pValEl = document.getElementById('arena-val-player'), bValEl = document.getElementById('arena-val-bot');
            pValEl.innerText = pVal.toLocaleString() + ' 🪙'; bValEl.innerText = bVal.toLocaleString() + ' 🪙';
            pValEl.style.color = pVal > bVal ? '#3ecf8e' : (pVal===bVal ? '#ffd700' : '#ef4444');
            bValEl.style.color = bVal > pVal ? '#3ecf8e' : (pVal===bVal ? '#ffd700' : '#555566');
            document.getElementById('arena-result-msg').innerText = msg;
            arenaShowPhase('arena-reveal');
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const revealPhase = document.getElementById('arena-reveal');
                if (revealPhase && revealPhase.classList.contains('active-phase')) { e.preventDefault(); startArenaBattle(window._lastBattleHighStakes); }
            }
        });

        // ─── LIMITED STOCK ────────────────────────────────────────────────────────
        async function loadLimitedStock() {
            const banner = document.getElementById('limited-stock-banner');
            const list   = document.getElementById('limited-stock-list');
            const { data: limitedPlayers, error } = await _supabase.from('collection').select('id, name').ilike('rarity', 'Limited');
            if (error || !limitedPlayers || limitedPlayers.length === 0) { banner.style.display = 'none'; return; }
            list.innerHTML = ''; banner.style.display = 'block';
            for (const player of limitedPlayers) {
                const { data: issuedCount } = await _supabase.rpc('count_limited_player', { pid: player.id });
                const remaining = 10 - (issuedCount || 0);
                const stockColor = remaining > 3 ? '#3ecf8e' : (remaining > 0 ? '#ffd700' : '#ef4444');
                const item = document.createElement('div');
                item.style = `background:rgba(255,255,255,0.05);border:1px solid ${stockColor}44;padding:4px 10px;border-radius:6px;font-size:0.65rem;font-weight:900;display:flex;gap:8px;align-items:center;`;
                item.innerHTML = `<span style="color:#888;">${player.name.toUpperCase()}</span><span style="color:${stockColor};">${remaining}/10 LEFT</span>`;
                list.appendChild(item);
            }
        }

        function broadcastLimitedPull(card) {
            const overlay   = document.getElementById('limited-pull-overlay');
            const cardWrap  = document.getElementById('lpa-card-wrap');
            const headline  = document.getElementById('lpa-headline');
            const sub       = document.getElementById('lpa-sub');
            const countdown = document.getElementById('lpa-countdown');
            const bar       = document.getElementById('lpa-progress-bar');
            const username = currentUser?.user_metadata?.username || 'A TRAINER';
            headline.innerText = `${username.toUpperCase()} PULLED A LIMITED!`;
            sub.innerText = `${card.name} · Serial #${card.serialNumber||'?'}/10`;
            cardWrap.innerHTML = generateCardHtml(card, false);
            bar.style.width = '100%'; overlay.style.display = 'flex';
            let secs = 5;
            const tick = setInterval(() => {
                secs--; countdown.innerText = `CLOSING IN ${secs}s`; bar.style.width = (secs/5*100) + '%';
                if (secs <= 0) { clearInterval(tick); overlay.style.display = 'none'; }
            }, 1000);
            logActivity('pulled_limited', card);
        }

        // ─── EXCHANGES ────────────────────────────────────────────────────────────
        let completedExchanges = [];
        let _exchangeConfig = [];

        async function loadExchangeState() {
            const { data } = await _supabase.from('exchanges').select('*').order('order', { ascending: true });
            _exchangeConfig = data || [];
            updateExchangeBadge();
            return _exchangeConfig;
        }

        function updateExchangeBadge() {
            const badge = document.getElementById('exchange-badge');
            if (!badge) return;
            const available = _exchangeConfig.filter(exc => !completedExchanges.includes(exc.id) && checkExchangeRequirements(exc));
            badge.style.display = available.length > 0 ? 'flex' : 'none';
            badge.innerText = available.length;
        }

        function renderExchanges() {
            const list = document.getElementById('exchange-list');
            if (!list) return;
            if (_exchangeConfig.length === 0) { list.innerHTML = '<p style="color:#555566;text-align:center;padding:40px;">No exchanges available right now.</p>'; return; }
            list.innerHTML = _exchangeConfig.map(exc => {
                const done = completedExchanges.includes(exc.id);
                const canDo = !done && checkExchangeRequirements(exc);
                const statusClass = done ? 'done' : (canDo ? 'available' : 'locked');
                const statusLabel = done ? 'COMPLETED' : (canDo ? 'AVAILABLE' : 'LOCKED');
                const progress = getExchangeProgress(exc);
                const costCards = (exc.cost_cards||[]).slice(0,3).map(c => `<div class="exc-cost-card">${generateCardHtml(c,false)}</div>`).join('');
                return `<div class="exc-item ${statusClass}">
                    <div class="exc-item-header"><div><div class="exc-item-name">${exc.name||'EXCHANGE'}</div><div class="exc-item-desc">${exc.description||''}</div></div><div class="exc-status-badge ${statusClass}">${statusLabel}</div></div>
                    <div class="exc-cards-row"><div class="exc-cost-col"><div class="exc-side-label">YOU GIVE</div><div class="exc-cost-stack">${costCards}</div><div class="exc-cost-count">× ${exc.cost_count||1}</div></div><div class="exc-arrow">→</div><div class="exc-reward-col"><div class="exc-side-label">YOU GET</div><div class="exc-reward-wrap">${exc.reward_card ? generateCardHtml(exc.reward_card,false) : ''}</div></div></div>
                    <div class="exc-progress-wrap"><div class="exc-progress-bar" style="width:${progress.pct}%"></div></div>
                    <div class="exc-progress-label">${progress.label}</div>
                    <button class="exc-btn ${done?'done':(canDo?'go':'locked')}" onclick="${canDo?`doExchange('${exc.id}')`:''}${done||!canDo?'" disabled':''}">
                        ${done?'✓ COMPLETED':(canDo?'EXCHANGE NOW':'REQUIREMENTS NOT MET')}</button>
                </div>`;
            }).join('');
        }

        function checkExchangeRequirements(exc) {
            if (!exc.cost_rarity) return false;
            return mySquad.filter(c => (c.rarity||'').toLowerCase() === exc.cost_rarity.toLowerCase() && !c.isExchange).length >= (exc.cost_count||1);
        }

        function getExchangeProgress(exc) {
            if (!exc.cost_rarity) return { pct:0, label:'' };
            const need = exc.cost_count||1;
            const have = mySquad.filter(c => (c.rarity||'').toLowerCase() === exc.cost_rarity.toLowerCase() && !c.isExchange).length;
            return { pct: Math.min((have/need)*100, 100), label: `${Math.min(have,need)} / ${need} ${exc.cost_rarity} cards` };
        }

        async function doExchange(excId) {
            const exc = _exchangeConfig.find(e => e.id === excId);
            if (!exc || !checkExchangeRequirements(exc)) return;
            let removed = 0;
            mySquad = mySquad.filter(c => {
                if (removed < exc.cost_count && (c.rarity||'').toLowerCase() === exc.cost_rarity.toLowerCase() && !c.isExchange) { removed++; return false; }
                return true;
            });
            if (exc.reward_card) mySquad.push({ ...exc.reward_card, instanceId:'inst_'+Date.now(), collectedDate:new Date().toLocaleDateString(), isExchange:true });
            completedExchanges.push(excId);
            renderSquad(); updateUI(); await saveGame(); renderExchanges();
            logActivity('completed_exchange', exc.reward_card || null);
            addXP(30);
            showToast(`🔁 Exchange complete! You received ${exc.reward_card?.name||'a reward card'}!`);
        }

        // ─── INIT ─────────────────────────────────────────────────────────────────
        window.addEventListener('load', async () => {
            const isShared = await checkSharedView();
            if (!isShared) {
                await checkExistingSession();
                // Show streak popup after a short delay once game is loaded
                setTimeout(() => {
                    if (window._streakRewardData && !window._streakRewardData.shown) {
                        showStreakPopup();
                    }
                }, 1200);
            }
        });