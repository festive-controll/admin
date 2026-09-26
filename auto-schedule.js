(function () {
    'use strict';

    const firebaseConfig = {
        apiKey: 'AIzaSyCKA0k_9UgoJX_RBgEsIeNdiW2w0Okko1o',
        authDomain: 'festie-s1u2h3.firebaseapp.com',
        projectId: 'festie-s1u2h3',
        storageBucket: 'festie-s1u2h3.firebasestorage.app',
        messagingSenderId: '794049194885',
        appId: '1:794049194885:web:8f75f0df4c15cde15eb2ec'
    };

    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    }

    const db = window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null);
    if (db) {
        try {
            db.settings({ experimentalForceLongPolling: true, merge: true });
        } catch (e) {
            // Already initialized settings
        }
    }

    const labels = ['Scope', 'Timing', 'Days', 'Durations', 'Preview'];
    const stepsEl = document.getElementById('steps');
    const dayList = document.getElementById('dayList');
    const breakList = document.getElementById('breakList');
    const customBreakList = document.getElementById('customBreakList');
    const ruleList = document.getElementById('ruleList');
    const typeOptionsEl = document.getElementById('typeOptions');
    const savedStagesBox = document.getElementById('savedStagesBox');
    const savedStagesChips = document.getElementById('savedStagesChips');
    const savedStagesCount = document.getElementById('savedStagesCount');
    const savedStagesHeader = document.getElementById('savedStagesHeader');
    const dbStatusPill = document.getElementById('dbStatusPill');

    let current = 0;
    let dayCount = 0;
    let ruleCount = 0;
    let programs = [];
    let venues = [];
    let venueTypes = [];
    let sections = [];
    let generatedSchedule = [];
    const dbLoaded = { venues: false, programs: false, venueTypes: false };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function normalize(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function categoryOf(program) {
        return program.section || program.category || program.type || 'General';
    }
    function programmeVenueType(program) {
        if (program.venueTypeId) {
            const matched = venueTypes.find(t => t.id === program.venueTypeId);
            if (matched) return matched.name;
        }
        return program.venueTypeName || program.venueType || '';
    }
    function venueName(venue) {
        return (venue.name || venue.venueName || 'Stage') + (venue.subVenue ? ` (${venue.subVenue})` : '');
    }

    function venueMatchesType(venue, typeKey) {
        if (!typeKey) return true;
        const normKey = normalize(typeKey);
        const venueTypeId = venue.typeId || venue.venueTypeId || '';
        const venueTypeName = venue.type || venue.venueTypeName || '';
        
        if (venueTypeId && (venueTypeId === typeKey || normalize(venueTypeId) === normKey)) return true;
        if (venueTypeName && normalize(venueTypeName) === normKey) return true;
        
        // If typeKey is "Stage", match venues with 'stage' in their name or empty type (defaults to stage)
        if (normKey === 'stage' && (!venueTypeName || normalize(venue.name).includes('stage') || normalize(venue.name).startsWith('s'))) return true;
        // If typeKey is "Non-stage" / "Off-stage"
        if ((normKey === 'nonstage' || normKey === 'offstage') && (normalize(venueTypeName).includes('non') || normalize(venueTypeName).includes('off') || normalize(venue.name).includes('off') || normalize(venue.name).includes('room') || normalize(venue.name).includes('hall'))) return true;
        // If typeKey is "Sports"
        if (normKey === 'sports' && (normalize(venueTypeName).includes('sport') || normalize(venue.name).includes('ground') || normalize(venue.name).includes('court') || normalize(venue.name).includes('field'))) return true;
        
        return false;
    }

    function programMatchesType(program, typeKey) {
        if (!typeKey) return true;
        const normKey = normalize(typeKey);
        const pTypeId = program.venueTypeId || '';
        const pTypeName = programmeVenueType(program);
        
        if (pTypeId && (pTypeId === typeKey || normalize(pTypeId) === normKey)) return true;
        if (pTypeName && normalize(pTypeName) === normKey) return true;
        
        // Fallback for programs without explicit venueTypeName
        if (!pTypeId && !pTypeName) {
            const pType = normalize(program.type || '');
            if (normKey === 'stage') {
                return pType === 'stage' || pType === 'individual' || pType === 'group' || pType === '' || pType === 'general';
            }
            if (normKey === 'nonstage' || normKey === 'offstage') {
                return pType.includes('non') || pType.includes('off') || pType.includes('written');
            }
            if (normKey === 'sports') {
                return pType.includes('sport') || pType.includes('game') || pType.includes('athletic');
            }
        }
        return false;
    }

    function venueMatchesProgram(venue, program, selectedTypeKey) {
        if (selectedTypeKey) {
            return venueMatchesType(venue, selectedTypeKey) && programMatchesType(program, selectedTypeKey);
        }
        const progType = programmeVenueType(program) || program.venueTypeId;
        if (progType) {
            return venueMatchesType(venue, progType);
        }
        return true;
    }

    function timeToMinutes(value) {
        const parts = String(value || '00:00').split(':').map(Number);
        if (parts.length !== 2 || parts.some(Number.isNaN)) return NaN;
        return (parts[0] * 60) + parts[1];
    }
    function displayTime(total) {
        const hours = Math.floor(total / 60) % 24;
        const minutes = total % 60;
        return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
    }
    function isoDateTime(date, minutes) {
        const result = new Date(`${date}T00:00:00`);
        result.setMinutes(minutes);
        return result;
    }
    function localDateValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    function nextAvailableStart(start, duration, breaks) {
        let value = start;
        let changed = true;
        while (changed) {
            changed = false;
            const overlap = breaks.find(item => value < item.end && value + duration > item.start);
            if (overlap) {
                value = overlap.end;
                changed = true;
            }
        }
        return value;
    }

    function notice(message, isError) {
        const element = document.getElementById('notice');
        if (!element) return;
        element.textContent = message;
        element.style.display = 'block';
        element.style.color = isError ? '#b91c1c' : '#15803d';
        element.style.background = isError ? '#fef2f2' : '#f0fdf4';
        element.style.borderColor = isError ? '#fca5a5' : '#bbf7d0';
    }

    // Stepper Creation
    if (stepsEl) {
        stepsEl.innerHTML = '';
        labels.forEach((label, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'step-wrap';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'step';
            button.innerHTML = `<span class="step-dot">${index + 1}</span><span class="step-label">${label}</span>`;
            button.addEventListener('click', () => { if (index <= current) showStep(index); });
            wrap.appendChild(button);
            if (index < labels.length - 1) {
                const line = document.createElement('span');
                line.className = 'connector';
                wrap.appendChild(line);
            }
            stepsEl.appendChild(wrap);
        });
    }

    function showStep(index) {
        current = Math.max(0, Math.min(labels.length - 1, index));
        document.querySelectorAll('.step-panel').forEach((panel, i) => {
            const active = i === current;
            panel.classList.toggle('active', active);
            panel.hidden = !active;
        });
        document.querySelectorAll('.step').forEach((step, i) => {
            step.classList.toggle('active', i === current);
            step.classList.toggle('done', i < current);
            step.setAttribute('aria-current', i === current ? 'step' : 'false');
            step.disabled = i > current;
        });
        
        const backBtn = document.getElementById('backBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (backBtn) {
            backBtn.disabled = current === 0;
            backBtn.innerHTML = current === 0 ? '&lsaquo; &nbsp; Schedule' : '&lsaquo; &nbsp; Back';
        }
        
        if (nextBtn) {
            if (current === 3) {
                nextBtn.innerHTML = 'Generate Schedule &nbsp;&#10022;';
            } else if (current === 4) {
                nextBtn.textContent = 'Save to DB';
            } else {
                nextBtn.innerHTML = 'Next &nbsp;&rsaquo;';
            }
        }
        
        if (current === 4) {
            updateSummary();
        }
    }

    // Programme Types toggle in Step 0
    const programmeTypesContainer = document.getElementById('programmeTypes');
    document.querySelectorAll('input[name="programmes"]').forEach(input => {
        input.addEventListener('change', () => {
            const isSelectedOnly = document.querySelector('input[name="programmes"]:checked').value === 'selected';
            if (programmeTypesContainer) {
                programmeTypesContainer.classList.toggle('visible', isSelectedOnly);
                programmeTypesContainer.setAttribute('aria-hidden', String(!isSelectedOnly));
            }
            renderSavedStagesForSelectedType();
            refreshVenuePickers();
        });
    });

    function getSelectedProgrammeType() {
        const progChoice = document.querySelector('input[name="programmes"]:checked');
        if (!progChoice || progChoice.value === 'all') return '';
        const checked = document.querySelector('input[name="programmeType"]:checked');
        return checked ? checked.value : '';
    }

    function renderVenueTypeOptions() {
        if (!typeOptionsEl) return;
        const previousSelection = getSelectedProgrammeType();
        
        // Collect all distinct types from DB
        const typeSet = new Map();
        
        // Add venueTypes from collection
        venueTypes.forEach(vt => {
            const name = vt.name || vt.id;
            if (name) typeSet.set(normalize(name), name);
        });

        // Add types from venues collection
        venues.forEach(v => {
            const t = v.type || v.venueTypeName;
            if (t) typeSet.set(normalize(t), t);
        });

        // Add standard defaults
        if (!typeSet.has('stage')) typeSet.set('stage', 'Stage');
        if (!typeSet.has('nonstage')) typeSet.set('nonstage', 'Non-stage');
        if (!typeSet.has('sports')) typeSet.set('sports', 'Sports');

        const typeList = Array.from(typeSet.values());

        let html = '';
        typeList.forEach((typeName, index) => {
            const matchingVenues = venues.filter(v => venueMatchesType(v, typeName));
            const matchingProgs = programs.filter(p => programMatchesType(p, typeName));
            const isChecked = (previousSelection ? typeName === previousSelection : index === 0) ? 'checked' : '';

            html += `
                <label class="type-choice">
                    <input type="radio" name="programmeType" value="${esc(typeName)}" ${isChecked}>
                    <div class="type-choice-header">
                        <span class="radio"></span>
                        <span class="type-label">${esc(typeName)}</span>
                    </div>
                    <span class="type-badge">${matchingVenues.length} saved stage${matchingVenues.length === 1 ? '' : 's'} &bull; ${matchingProgs.length} prog${matchingProgs.length === 1 ? '' : 's'}</span>
                </label>`;
        });

        typeOptionsEl.innerHTML = html;

        typeOptionsEl.querySelectorAll('input[name="programmeType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                renderSavedStagesForSelectedType();
                refreshVenuePickers();
                updateSummary();
            });
        });

        renderSavedStagesForSelectedType();
    }

    function renderSavedStagesForSelectedType() {
        if (!savedStagesBox || !savedStagesChips) return;
        
        const isSelectedOnly = document.querySelector('input[name="programmes"]:checked')?.value === 'selected';
        const selectedType = getSelectedProgrammeType();
        
        if (!isSelectedOnly) {
            savedStagesBox.style.display = 'none';
            return;
        }

        const matchingVenues = venues.filter(v => venueMatchesType(v, selectedType));
        const matchingProgs = programs.filter(p => programMatchesType(p, selectedType));
        
        savedStagesBox.style.display = 'block';
        if (savedStagesHeader) {
            savedStagesHeader.textContent = `Saved Stages in DB for "${selectedType || 'Selected'}"`;
        }
        if (savedStagesCount) {
            savedStagesCount.textContent = `${matchingVenues.length} Stages • ${matchingProgs.length} Programmes`;
        }

        if (matchingVenues.length === 0) {
            savedStagesChips.innerHTML = `<div class="no-stages-warning">⚠️ No saved venues found in Firestore database matching type "<strong>${esc(selectedType)}</strong>". Please add venues under the Venues section or select another type.</div>`;
        } else {
            savedStagesChips.innerHTML = matchingVenues.map(v => {
                const vols = Array.isArray(v.volunteers) ? v.volunteers.length : (v.volunteers ? v.volunteers.split(',').length : 0);
                return `
                <div class="stage-chip" title="Location: ${esc(v.place || 'Festival Ground')}">
                    <span class="stage-chip-icon">&#127917;</span>
                    <span>${esc(v.name || 'Stage')}</span>
                    ${v.place ? `<span class="stage-chip-place">📍 ${esc(v.place)}</span>` : ''}
                    ${vols > 0 ? `<span style="font-size:10.5px; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:6px; margin-left:4px;">👥 ${vols}</span>` : ''}
                </div>`;
            }).join('');
        }
    }

    // Breaks handlers
    function breakRow(from = '13:00', to = '14:00') {
        const row = document.createElement('div');
        row.className = 'break-row';
        row.innerHTML = `<label class="field"><span class="field-label">From</span><input type="time" value="${from}"></label><label class="field"><span class="field-label">To</span><input type="time" value="${to}"></label><button class="delete-break" type="button" aria-label="Delete break">&#128465;</button>`;
        return row;
    }
    const addBreakBtn = document.getElementById('addBreakBtn');
    const addCustomBreakBtn = document.getElementById('addCustomBreakBtn');
    if (addBreakBtn) addBreakBtn.addEventListener('click', () => breakList && breakList.appendChild(breakRow('13:00', '14:00')));
    if (addCustomBreakBtn) addCustomBreakBtn.addEventListener('click', () => customBreakList && customBreakList.appendChild(breakRow('17:00', '17:30')));
    
    [breakList, customBreakList].forEach(list => {
        if (list) {
            list.addEventListener('click', event => {
                const button = event.target.closest('.delete-break');
                if (button) button.closest('.break-row').remove();
            });
        }
    });

    // Schedule Days handlers
    function addScheduleDay() {
        if (!dayList) return;
        dayCount += 1;
        const entry = document.createElement('div');
        entry.className = 'day-entry';
        const today = new Date();
        today.setDate(today.getDate() + dayList.children.length);
        const dateValue = localDateValue(today);
        entry.innerHTML = `
            <div class="day-title"><span class="day-number"></span><span class="day-name"></span><button class="remove-day" type="button" aria-label="Delete day">&#128465;</button></div>
            <div class="day-fields">
                <label class="field"><span class="field-label">Date</span><input type="date" value="${dateValue}"></label>
                <label class="field"><span class="field-label">Start Time</span><input type="time" value="08:30"></label>
                <label class="field"><span class="field-label">End Time</span><input type="time" value="21:00"></label>
            </div>
            <div class="venue-options">
                <label class="venue-chip"><input type="radio" name="day-venue-${dayCount}" value="all" checked><span class="chip-check"></span>All compatible saved stages</label>
                <label class="venue-chip"><input type="radio" name="day-venue-${dayCount}" value="selected"><span class="chip-check"></span>Select specific stages</label>
            </div>
            <select class="venue-picker" multiple aria-label="Select venues"></select>`;
        dayList.appendChild(entry);
        renumberDays();
        fillVenuePicker(entry);
    }

    function renumberDays() {
        if (!dayList) return;
        dayList.querySelectorAll('.day-entry').forEach((entry, index) => {
            const numEl = entry.querySelector('.day-number');
            const nameEl = entry.querySelector('.day-name');
            if (numEl) numEl.textContent = index + 1;
            if (nameEl) nameEl.textContent = `Day ${index + 1}`;
        });
    }

    function fillVenuePicker(day) {
        const picker = day.querySelector('.venue-picker');
        if (!picker) return;
        const previousIds = new Set([...picker.selectedOptions].map(option => option.value));
        const hadOptions = picker.options.length > 0;
        const type = getSelectedProgrammeType();
        const compatible = type ? venues.filter(v => venueMatchesType(v, type)) : venues;
        
        if (compatible.length === 0) {
            picker.innerHTML = '<option disabled selected>No saved stages match this type</option>';
        } else {
            picker.innerHTML = compatible.map(v => `<option value="${esc(v.id)}" ${!hadOptions || previousIds.has(v.id) ? 'selected' : ''}>${esc(venueName(v))}${v.place ? ' (' + esc(v.place) + ')' : ''}</option>`).join('');
        }
    }

    function refreshVenuePickers() {
        if (!dayList) return;
        dayList.querySelectorAll('.day-entry').forEach(fillVenuePicker);
    }

    const addDayBtn = document.getElementById('addDayBtn');
    if (addDayBtn) addDayBtn.addEventListener('click', addScheduleDay);

    if (dayList) {
        dayList.addEventListener('change', event => {
            if (!event.target.matches('.venue-chip input')) return;
            const day = event.target.closest('.day-entry');
            const picker = day.querySelector('.venue-picker');
            if (picker) {
                picker.classList.toggle('visible', event.target.value === 'selected' && event.target.checked);
            }
        });

        dayList.addEventListener('click', event => {
            const button = event.target.closest('.remove-day');
            if (button && dayList.children.length > 1) {
                button.closest('.day-entry').remove();
                renumberDays();
            }
        });
    }

    // Add 1 default day
    addScheduleDay();

    // Duration Rules handlers
    function addDurationRule() {
        if (!ruleList) return;
        ruleCount += 1;
        const row = document.createElement('div');
        row.className = 'rule-row';
        row.innerHTML = `
            <label class="field"><span class="field-label">Programme Code</span><input class="rule-code" type="search" list="programme-codes-${ruleCount}" autocomplete="off" placeholder="e.g. A101"><datalist id="programme-codes-${ruleCount}"></datalist></label>
            <label class="field"><span class="field-label">Programme Name</span><input class="rule-name" type="text" readonly placeholder="Auto loaded from DB"></label>
            <label class="field"><span class="field-label">Category</span><input class="rule-category" type="text" readonly placeholder="Auto loaded from DB"></label>
            <label class="field"><span class="field-label">Duration (mins)</span><input class="rule-duration" type="number" value="45" min="1"></label>
            <div class="rule-actions"><button class="rule-action delete-rule" type="button" aria-label="Delete rule">&#128465;</button></div>`;
        ruleList.appendChild(row);
        populateRuleCodes(row);
    }

    function populateRuleCodes(row) {
        const list = row.querySelector('datalist');
        if (!list) return;
        list.innerHTML = programs.map(p => `<option value="${esc(p.code || '')}">${esc(p.name || '')} (${esc(categoryOf(p))})</option>`).join('');
    }

    function resolveRule(row) {
        const inputVal = row.querySelector('.rule-code').value.trim();
        const code = normalize(inputVal);
        const program = programs.find(item => normalize(item.code) === code || normalize(item.name) === code);
        
        row.dataset.programId = program ? program.id : '';
        const nameInput = row.querySelector('.rule-name');
        const catInput = row.querySelector('.rule-category');
        
        if (nameInput) nameInput.value = program ? (program.name || '') : '';
        if (catInput) catInput.value = program ? categoryOf(program) : '';
    }

    const addRuleBtn = document.getElementById('addRuleBtn');
    if (addRuleBtn) addRuleBtn.addEventListener('click', addDurationRule);

    if (ruleList) {
        ruleList.addEventListener('input', event => { if (event.target.matches('.rule-code')) resolveRule(event.target.closest('.rule-row')); });
        ruleList.addEventListener('change', event => { if (event.target.matches('.rule-code')) resolveRule(event.target.closest('.rule-row')); });
        ruleList.addEventListener('click', event => {
            const button = event.target.closest('.delete-rule');
            if (button) button.closest('.rule-row').remove();
        });
    }

    // Real-Time Database Connection & Listeners
    function setupDatabaseListeners() {
        if (!db) {
            console.error("Firestore database is not initialized.");
            if (dbStatusPill) {
                dbStatusPill.className = 'db-pill error';
                dbStatusPill.innerHTML = '<span class="db-dot"></span>DB Connection Error (Firestore not available)';
            }
            return;
        }

        if (dbStatusPill) {
            dbStatusPill.className = 'db-pill loading';
            dbStatusPill.innerHTML = '<span class="db-dot"></span>Connecting to Firestore DB...';
        }

        // 1. Listen to Venues
        db.collection('venues').onSnapshot(snap => {
            venues = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            venues.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            dbLoaded.venues = true;
            updateUIWithDbData();
        }, err => handleDatabaseError('venues', err));

        // 2. Listen to Programs
        db.collection('programs').onSnapshot(snap => {
            programs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            dbLoaded.programs = true;
            updateUIWithDbData();
        }, err => handleDatabaseError('programmes', err));

        // 3. Listen to Venue Types
        db.collection('venueTypes').onSnapshot(snap => {
            venueTypes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            dbLoaded.venueTypes = true;
            updateUIWithDbData();
        }, err => handleDatabaseError('venue types', err));

        // 4. Listen to Sections
        db.collection('sections').onSnapshot(snap => {
            sections = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, err => console.warn("Error listening to sections:", err));
    }

    function handleDatabaseError(resource, error) {
        console.error(`Error loading ${resource}:`, error);
        if (dbStatusPill) {
            dbStatusPill.className = 'db-pill error';
            dbStatusPill.innerHTML = `<span class="db-dot"></span>Could not load ${esc(resource)} from Firestore`;
        }
    }

    function updateUIWithDbData() {
        const fullyLoaded = Object.values(dbLoaded).every(Boolean);
        if (dbStatusPill && fullyLoaded) {
            dbStatusPill.className = 'db-pill connected';
            dbStatusPill.innerHTML = `<span class="db-dot"></span>Live DB Connected &bull; ${venues.length} Saved Stages &bull; ${programs.length} Programmes`;
        }

        const reportStatus = document.getElementById('reportStatus');
        if (reportStatus && current !== 4 && fullyLoaded) {
            reportStatus.className = 'report-status';
            reportStatus.innerHTML = `<strong>✓ Database Connected</strong><span>${programs.length} programmes and ${venues.length} saved stages loaded live from Firestore.</span>`;
        }

        renderVenueTypeOptions();
        if (ruleList) ruleList.querySelectorAll('.rule-row').forEach(populateRuleCodes);
        refreshVenuePickers();
    }

    function collectBreaks() {
        return [...(breakList ? breakList.querySelectorAll('.break-row') : []), ...(customBreakList ? customBreakList.querySelectorAll('.break-row') : [])].map(row => {
            const inputs = row.querySelectorAll('input[type="time"]');
            return { start: timeToMinutes(inputs[0].value), end: timeToMinutes(inputs[1].value) };
        }).filter(item => item.end > item.start).sort((a, b) => a.start - b.start);
    }

    function collectDays() {
        if (!dayList) return [];
        return [...dayList.querySelectorAll('.day-entry')].map(entry => {
            const inputs = entry.querySelectorAll('.day-fields input');
            const allVenues = entry.querySelector('.venue-chip input:checked')?.value === 'all';
            const selectedVenueIds = [...entry.querySelector('.venue-picker').selectedOptions].map(option => option.value);
            return { date: inputs[0]?.value, start: timeToMinutes(inputs[1]?.value), end: timeToMinutes(inputs[2]?.value), allVenues, selectedVenueIds };
        });
    }

    function collectRules() {
        const rules = new Map();
        if (ruleList) {
            ruleList.querySelectorAll('.rule-row').forEach(row => {
                resolveRule(row);
                const id = row.dataset.programId;
                const duration = Number(row.querySelector('.rule-duration')?.value);
                if (id && duration > 0) rules.set(id, duration);
            });
        }
        return rules;
    }

    function eligiblePrograms() {
        const includeExisting = document.querySelector('input[name="existing"]:checked')?.value === 'include';
        const selectedType = getSelectedProgrammeType();
        return programs.filter(program => {
            if (program.status === false || program.isActive === false) return false;
            if (!includeExisting && (program.time || program.scheduleDate || program.startTime)) return false;
            if (selectedType && !programMatchesType(program, selectedType)) return false;
            return true;
        }).sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
    }

    function buildSchedule() {
        const defaultDuration = Math.max(1, Number(document.getElementById('defaultDuration')?.value) || 45);
        const gap = Math.max(0, Number(document.getElementById('programmeGap')?.value) || 0);
        const rules = collectRules();
        const breaks = collectBreaks();
        const days = collectDays();
        const selectedType = getSelectedProgrammeType();
        const schedule = [];
        const unscheduled = [];
        const cursors = days.map(day => new Map(venues.map(venue => [venue.id, day.start])));

        eligiblePrograms().forEach(program => {
            const duration = rules.get(program.id) || defaultDuration;
            let best = null;
            
            days.forEach((day, dayIndex) => {
                let candidates = day.allVenues
                    ? venues.filter(venue => venueMatchesProgram(venue, program, selectedType))
                    : venues.filter(venue => day.selectedVenueIds.includes(venue.id) && venueMatchesProgram(venue, program, selectedType));
                
                candidates.forEach(venue => {
                    const currentPos = cursors[dayIndex].get(venue.id) || day.start;
                    const start = nextAvailableStart(currentPos, duration, breaks);
                    if (start + duration <= day.end && (!best || dayIndex < best.dayIndex || (dayIndex === best.dayIndex && start < best.start))) {
                        best = { dayIndex, day, venue, start };
                    }
                });
            });
            
            if (!best) {
                unscheduled.push(program);
                return;
            }
            
            const end = best.start + duration;
            cursors[best.dayIndex].set(best.venue.id, end + gap);
            
            schedule.push({
                programId: program.id,
                code: program.code || '',
                name: program.name || 'Unnamed programme',
                category: categoryOf(program),
                date: best.day.date,
                startMinutes: best.start,
                endMinutes: end,
                start: displayTime(best.start),
                end: displayTime(end),
                duration,
                venueId: best.venue.id,
                venue: venueName(best.venue),
                time: isoDateTime(best.day.date, best.start)
            });
        });
        
        return { schedule, unscheduled };
    }

    async function saveScheduleToFirestore() {
        if (!db) {
            notice('Firestore is unavailable. Check the connection and try again.', true);
            return;
        }
        if (!generatedSchedule.length) {
            notice('Please generate the schedule preview before saving to database.', true);
            return;
        }

        const saveBtn = document.getElementById('btnSaveDb');
        const nextBtn = document.getElementById('nextBtn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving to Database...'; }
        if (nextBtn && current === 4) { nextBtn.disabled = true; nextBtn.textContent = 'Saving to Database...'; }

        try {
            const rows = generatedSchedule;
            for (let offset = 0; offset < rows.length; offset += 400) {
                const batch = db.batch();
                rows.slice(offset, offset + 400).forEach(row => {
                    batch.update(db.collection('programs').doc(row.programId), {
                        time: row.time,
                        scheduleDate: row.date,
                        startTime: row.start,
                        endTime: row.end,
                        duration: row.duration,
                        venueId: row.venueId,
                        venue: row.venue,
                        judgeAlertSent: false,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
            }

            notice(`Successfully saved ${rows.length} scheduled programmes to Firestore.`, false);
            const reportStatus = document.getElementById('reportStatus');
            if (reportStatus) {
                reportStatus.className = 'report-status';
                reportStatus.innerHTML = `<strong>✓ Schedule Saved to Database</strong><span>All ${rows.length} programmes have been successfully committed to Firestore DB.</span>`;
            }
        } catch (error) {
            console.error('Firestore save failed:', error);
            notice(`Failed to save to database: ${error.message}`, true);
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save to Database'; }
            if (nextBtn && current === 4) { nextBtn.disabled = false; nextBtn.textContent = 'Save to DB'; }
        }
    }

    function generatePreview() {
        generatedSchedule = [];
        if (!programs.length || !venues.length) {
            notice('No programmes or saved stages were found in database.', true);
            return;
        }
        
        const days = collectDays();
        if (days.some(day => !day.date || day.end <= day.start)) {
            notice('Each schedule day must have a valid date and end time after start time.', true);
            return;
        }
        if (days.some(day => !day.allVenues && day.selectedVenueIds.length === 0)) {
            notice('Choose at least one stage for every day using specific stages.', true);
            return;
        }
        
        const result = buildSchedule();
        if (!result.schedule.length) {
            notice('No compatible programmes could be scheduled. Check programme types, saved stages in DB, and day timing.', true);
            return;
        }

        generatedSchedule = result.schedule;
        renderPreviewFilters();
        renderPreview();
        showStep(4);
        
        const reportStatus = document.getElementById('reportStatus');
        if (reportStatus) {
            reportStatus.className = 'report-status';
            reportStatus.innerHTML = `<strong>✓ Generated ${result.schedule.length} Programme Slots</strong><span>Ready to save to Firestore or export as CSV${result.unscheduled.length ? ` (${result.unscheduled.length} programmes did not fit)` : ''}.</span>`;
        }
        notice(`Schedule generated with ${result.schedule.length} programmes across saved stages. Click "Save to Database" to apply.`, false);
    }

    function updateSummary() {
        const existing = document.querySelector('input[name="existing"]:checked')?.value;
        const set = document.querySelector('input[name="programmes"]:checked')?.value;
        const type = getSelectedProgrammeType();
        
        const summaryScope = document.getElementById('summaryScope');
        const summaryPrograms = document.getElementById('summaryPrograms');
        const summaryDates = document.getElementById('summaryDates');
        const summaryDays = document.getElementById('summaryDays');
        const summaryRules = document.getElementById('summaryRules');
        
        if (summaryScope) summaryScope.textContent = existing === 'unscheduled' ? 'Unscheduled programmes only' : 'Include existing schedules';
        if (summaryPrograms) summaryPrograms.textContent = set === 'all' ? 'All programmes' : `Selected type (${type || 'Stage'})`;
        if (summaryDates) summaryDates.textContent = `${document.getElementById('defaultDuration')?.value || 0} min, ${document.getElementById('programmeGap')?.value || 0} min gap`;
        if (summaryDays) summaryDays.textContent = `${dayList ? dayList.children.length : 1} day(s)`;
        
        const count = collectRules().size;
        if (summaryRules) summaryRules.textContent = `${count} ${count === 1 ? 'rule' : 'rules'}`;
    }

    function renderPreviewFilters() {
        const categorySelect = document.getElementById('previewCategory');
        const venueSelect = document.getElementById('previewVenue');
        if (!categorySelect || !venueSelect) return;
        
        const categories = [...new Set(generatedSchedule.map(row => row.category))].sort();
        const venueNames = [...new Set(generatedSchedule.map(row => row.venue))].sort();
        
        categorySelect.innerHTML = '<option value="">All categories</option>' + categories.map(val => `<option value="${esc(val)}">${esc(val)}</option>`).join('');
        venueSelect.innerHTML = '<option value="">All venues / stages</option>' + venueNames.map(val => `<option value="${esc(val)}">${esc(val)}</option>`).join('');
    }

    function filteredSchedule() {
        const category = document.getElementById('previewCategory')?.value;
        const venue = document.getElementById('previewVenue')?.value;
        return generatedSchedule.filter(row => (!category || row.category === category) && (!venue || row.venue === venue));
    }

    function renderPreview() {
        const previewBody = document.getElementById('previewBody');
        if (!previewBody) return;
        
        const rows = filteredSchedule();
        previewBody.innerHTML = rows.length ? rows.map(row => `
            <tr>
                <td>${esc(row.date)}</td>
                <td style="font-weight:700; color:#0f172a;">${esc(row.start)}</td>
                <td style="color:#64748b;">${esc(row.end)}</td>
                <td><span style="font-family: 'JetBrains Mono', monospace; font-weight:700; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11.5px;">${esc(row.code)}</span></td>
                <td style="font-weight:600;">${esc(row.name)}</td>
                <td><span style="font-size:11px; background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:6px; font-weight:600;">${esc(row.category)}</span></td>
                <td><span style="font-weight:700; color:#b91c1c; background:#fff1f1; padding:3px 8px; border-radius:6px; font-size:12px;">🎭 ${esc(row.venue)}</span></td>
                <td style="color:#475569; font-weight:600;">${row.duration} min</td>
            </tr>
        `).join('') : '<tr><td colspan="8" class="preview-empty">No schedules match the selected filters.</td></tr>';
    }

    function downloadExcel() {
        const rows = filteredSchedule();
        if (!rows.length) return notice('There are no schedule rows to download.', true);
        const headers = ['Date', 'Start', 'End', 'Programme code', 'Programme name', 'Category', 'Stage / Venue', 'Duration (minutes)'];
        const values = rows.map(row => [row.date, row.start, row.end, row.code, row.name, row.category, row.venue, row.duration]);
        const csvCell = value => {
            let text = String(value == null ? '' : value);
            if (/^[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [headers, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
        const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `auto-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
        link.remove();
    }

    // Event listeners
    const prevCat = document.getElementById('previewCategory');
    const prevVen = document.getElementById('previewVenue');
    const dlBtn = document.getElementById('downloadBtn');
    const btnSaveDb = document.getElementById('btnSaveDb');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Normalize labels that may have been saved with damaged legacy icon bytes.
    if (document.getElementById('addDayBtn')) document.getElementById('addDayBtn').textContent = '+  Add schedule day';
    if (document.getElementById('addRuleBtn')) document.getElementById('addRuleBtn').textContent = '+  Add duration rule';
    if (btnSaveDb) btnSaveDb.textContent = 'Save to Database';
    if (dlBtn) dlBtn.textContent = 'Download CSV';

    if (prevCat) prevCat.addEventListener('change', renderPreview);
    if (prevVen) prevVen.addEventListener('change', renderPreview);
    if (dlBtn) dlBtn.addEventListener('click', downloadExcel);
    if (btnSaveDb) btnSaveDb.addEventListener('click', saveScheduleToFirestore);

    if (backBtn) backBtn.addEventListener('click', () => showStep(current - 1));
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (current === 3) {
                generatePreview();
            } else if (current === 4) {
                saveScheduleToFirestore();
            } else {
                showStep(current + 1);
            }
        });
    }

    showStep(0);
    setupDatabaseListeners();
}());
