(function () {
    'use strict';
    const editor = document.querySelector('.cms-editor');
    if (!editor) return;
    const studio = window.CalicoMapStudio;
    const canvas = document.getElementById('cms-preview');
    const status = document.getElementById('cms-status');
    const fields = Array.from(editor.querySelectorAll('[data-cms-field]'));
    const codeField = document.getElementById('cms-json');
    const codeStatus = document.getElementById('cms-code-status');
    const codePresets = window.CalicoMapStylePresets || {};
    let active = false;
    let timer;
    let revision = 0;
    let picker;
    const locationList = document.getElementById('cms-location-list');
    let nextLocation = locationList.querySelectorAll('.cms-location-row').length;
    const pendingLookups = new Map();
    const form = document.getElementById('post');
    const errorNotice = document.createElement('div');
    errorNotice.id = 'cms-editor-error';
    errorNotice.className = 'notice notice-error inline';
    errorNotice.setAttribute('role', 'alert');
    errorNotice.hidden = true;
    editor.prepend(errorNotice);
    function clearError() {
        errorNotice.hidden = true;
        editor.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
    }
    function showError(error) {
        status.textContent = error.message;
        errorNotice.textContent = error.message;
        errorNotice.hidden = false;
        const target = error.field || codeField;
        target.setAttribute('aria-invalid', 'true');
        target.focus();
        target.scrollIntoView({ block: 'center' });
    }
    function checkStyles() {
        try { studio.styles(config()); }
        catch (error) {
            error.field = codeField.value.trim() ? codeField : (editor.querySelector('#cms-rule-list input:not([type="hidden"]), #cms-rule-list select') || codeField);
            throw error;
        }
    }
    function config() {
        const result = {};
        fields.forEach(field => { result[field.dataset.cmsField] = field.type === 'checkbox' ? field.checked : field.value; });
        result.locations = Array.from(locationList.querySelectorAll('.cms-location-row')).map(row => {
            const point = {};
            row.querySelectorAll('[data-cms-location]').forEach(field => { point[field.dataset.cmsLocation] = field.value; });
            return point;
        });
        return result;
    }
    function locationFields(row) {
        const primary = row.id === 'cms-primary-location';
        return Object.fromEntries(['location', 'address', 'lat', 'lng'].map(key => [key, row.querySelector(primary ? '[data-cms-field="' + key + '"]' : '[data-cms-location="' + key + '"]')]));
    }
    document.getElementById('cms-add-location').addEventListener('click', () => {
        if (locationList.children.length >= 49) { status.textContent = 'Use up to 50 locations per map.'; return; }
        const template = document.getElementById('cms-location-template');
        const fragment = template.content.cloneNode(true);
        fragment.querySelectorAll('input').forEach(field => { field.name = field.name.replace('__INDEX__', nextLocation); field.id = field.id.replace('__INDEX__', nextLocation); });
        fragment.querySelectorAll('label').forEach(label => { label.htmlFor = label.htmlFor.replace('__INDEX__', nextLocation); });
        nextLocation++;
        locationList.appendChild(fragment);
        locationList.lastElementChild.querySelector('input').focus();
    });
    function lookupAddress(row) {
        if (pendingLookups.has(row)) return pendingLookups.get(row);
        const values = locationFields(row);
        const button = row.querySelector('[data-cms-find]');
        const message = row.querySelector('[data-cms-location-status]');
        const address = values.address.value;
        const revision = row.dataset.revision || '0';
        button.disabled = true;
        message.textContent = 'Finding address…';
        const promise = (async () => { try {
            const matches = await studio.geocode(address, editor.dataset.apiKey);
            if (!row.isConnected || values.address.value !== address || (row.dataset.revision || '0') !== revision) throw new Error('Location changed during lookup. Try again with the current address.');
            if (matches.length > 1) throw new Error('Several addresses matched. Add more detail, such as city and postal code, and try again.');
            if (matches[0].partial) throw new Error('Only a partial address matched. Add more detail or enter confirmed coordinates manually.');
            values.lat.value = matches[0].lat;
            values.lng.value = matches[0].lng;
            message.textContent = 'Found: ' + matches[0].address + '. Check the pin in the preview, then save the map.';
        } catch (error) {
            if (row.isConnected) message.textContent = error.message;
            error.field = row.isConnected ? values.address : document.getElementById('cms-add-location');
            throw error;
        } finally { button.disabled = false; pendingLookups.delete(row); } })();
        pendingLookups.set(row, promise);
        return promise;
    }
    async function ensureLocations() {
        const rows = [document.getElementById('cms-primary-location'), ...locationList.querySelectorAll('.cms-location-row')];
        for (const row of rows) {
            if (!row.isConnected) continue;
            const values = locationFields(row);
            const invalid = ['lat', 'lng'].find(key => values[key].value.trim() === '' || !Number.isFinite(Number(values[key].value)) || Math.abs(Number(values[key].value)) > (key === 'lat' ? 85 : 180));
            if (!invalid) continue;
            if (values.address.value.trim()) await lookupAddress(row);
            else {
                const error = new Error('Enter a street address or valid coordinates for each location. Remove unused additional locations.');
                error.field = values[invalid];
                throw error;
            }
        }
        try { studio.locations(config()); }
        catch (error) {
            const row = [document.getElementById('cms-primary-location'), ...locationList.querySelectorAll('.cms-location-row')].find(row => {
                const values = locationFields(row);
                return ['lat', 'lng'].some(key => values[key].value.trim() === '' || !Number.isFinite(Number(values[key].value)) || Math.abs(Number(values[key].value)) > (key === 'lat' ? 85 : 180));
            });
            error.field = row ? locationFields(row).address : document.getElementById('cms-add-location');
            throw error;
        }
    }
    editor.addEventListener('click', async event => {
        const remove = event.target.closest('[data-cms-remove-location]');
        if (remove) { remove.closest('.cms-location-row').remove(); clearError(); await update(); return; }
        const button = event.target.closest('[data-cms-find]');
        if (!button) return;
        clearError();
        try {
            await lookupAddress(button.closest('.cms-location-row, #cms-primary-location'));
            active = true;
            await update();
        } catch (error) { showError(error); }
    });
    async function update() {
        const current = ++revision;
        try {
            const c = config();
            studio.locations(c);
            if (!Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng)) || c.lat === '' || c.lng === '') throw new Error('Enter valid latitude and longitude.');
            c.lat = Math.max(-85, Math.min(85, Number(c.lat)));
            c.lng = Math.max(-180, Math.min(180, Number(c.lng)));
            c.zoom = Math.max(1, Math.min(20, Number(c.zoom) || 13));
            canvas.style.height = Math.max(180, Math.min(1200, Number(c.height) || 420)) + 'px';
            if (active) {
                if (picker) picker.restore();
                const map = await studio.render(canvas, c, editor.dataset.apiKey);
                if (picker) picker.attach(map);
            }
            else studio.styles(c);
            document.getElementById('cms-rules-note').textContent = c.json.trim() ? 'Advanced JSON is active. Clear it to apply the palette and detailed rules.' : '';
            if (current === revision) status.textContent = c.json.trim() ? 'Advanced JSON overrides the palette, visibility and detailed rules.' : (active ? 'Preview updated. Save / Update to keep your changes.' : 'Load the preview to see your style on Google Maps.');
        } catch (error) { if (current === revision) status.textContent = error.message; }
    }
    editor.addEventListener('input', event => {
        const field = event.target;
        if (field.closest('#cms-guided-picker')) return;
        const row = field.closest('.cms-location-row, #cms-primary-location');
        if (row) {
            row.dataset.revision = String(Number(row.dataset.revision || 0) + 1);
            if (field.dataset.cmsField === 'address' || field.dataset.cmsLocation === 'address') {
                const values = locationFields(row);
                values.lat.value = ''; values.lng.value = '';
                row.querySelector('[data-cms-location-status]').textContent = 'Address changed. Find it on the map or enter coordinates before saving.';
            } else if (['lat', 'lng'].includes(field.dataset.cmsField || field.dataset.cmsLocation)) {
                row.querySelector('[data-cms-location-status]').textContent = 'Coordinates entered manually. Check the pin in the preview before saving.';
            }
        }
        if (field.dataset.cmsPicker) {
            document.getElementById('cms-' + field.dataset.cmsPicker).value = field.value;
        } else if (field.dataset.cmsField) {
            const picker = editor.querySelector('[data-cms-picker="' + field.dataset.cmsField + '"]');
            if (picker && /^#[a-f\d]{6}$/i.test(field.value)) picker.value = field.value;
        }
        clearTimeout(timer);
        timer = setTimeout(update, 160);
    });
    document.getElementById('cms-preview-load').addEventListener('click', async event => {
        clearError();
        event.target.disabled = true;
        status.textContent = 'Loading Google Maps…';
        try {
            checkStyles();
            await ensureLocations();
            active = true;
            await update();
        } catch (error) { showError(error); }
        finally { event.target.disabled = false; event.target.textContent = 'Refresh preview'; }
    });
    document.getElementById('cms-apply-preset').addEventListener('click', () => {
        const choice = document.getElementById('cms-preset').value;
        if (Object.hasOwn(codePresets, choice)) {
            codeField.value = JSON.stringify(studio.validateRules(codePresets[choice].styles), null, 2);
            codeField.dispatchEvent(new Event('input', { bubbles: true }));
            codeStatus.textContent = codePresets[choice].name + ' loaded. Update the map to save it, or choose Edit code visually to customize it.';
            update();
            return;
        }
        const palette = studio.presets[choice];
        if (!palette) return;
        codeField.value = '';
        studio.colorKeys.forEach((key, index) => {
            document.getElementById('cms-' + key).value = palette[index];
            editor.querySelector('[data-cms-picker="' + key + '"]').value = palette[index] || '#ffffff';
        });
        codeField.dispatchEvent(new Event('input', { bubbles: true }));
        codeStatus.textContent = 'Palette preset applied. Update the map to save it.';
        update();
    });
    document.getElementById('cms-code-apply').addEventListener('click', () => {
        try {
            if (!codeField.value.trim()) throw new Error('Paste a Google Maps JSON style array first.');
            codeField.value = JSON.stringify(studio.validateRules(codeField.value), null, 2);
            codeField.dispatchEvent(new Event('input', { bubbles: true }));
            codeStatus.textContent = 'Style code applied. Update the map to save it.';
            update();
        } catch (error) { codeStatus.textContent = error.message; codeField.focus(); }
    });
    document.getElementById('cms-export').addEventListener('click', async () => {
        try {
            const json = JSON.stringify(studio.styles(config()), null, 2);
            const output = document.getElementById('cms-code-output');
            output.value = json;
            document.getElementById('cms-code-output-wrap').hidden = false;
            output.focus(); output.select();
            if (navigator.clipboard && window.isSecureContext) {
                try { await navigator.clipboard.writeText(json); codeStatus.textContent = 'Current style code copied. Paste it into another compatible Google Maps editor or website.'; }
                catch (error) { codeStatus.textContent = 'Current style code is selected below. Press Ctrl+C (or Command+C) to copy it.'; }
            } else codeStatus.textContent = 'Current style code is selected below. Press Ctrl+C (or Command+C) to copy it.';
        } catch (error) { codeStatus.textContent = error.message; }
    });
    document.getElementById('cms-code-clear').addEventListener('click', () => {
        codeField.value = '';
        codeField.dispatchEvent(new Event('input', { bubbles: true }));
        codeStatus.textContent = 'Code cleared. The palette and detailed rules are active again. Update the map to save.';
        update();
    });
    const rulesField = document.getElementById('cms-rules');
    const ruleList = document.getElementById('cms-rule-list');
    let rules = studio.validateRules(rulesField.value || '[]');
    function commitRules() {
        rulesField.value = JSON.stringify(rules.filter(rule => rule.stylers.length));
        rulesField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function select(options, value, placeholder) {
        const control = document.createElement('select');
        if (placeholder) control.add(new Option(placeholder, ''));
        Object.entries(options).forEach(([key, label]) => control.add(new Option(label, key)));
        control.value = value;
        return control;
    }
    function labeled(label, control) {
        const wrapper = document.createElement('label');
        wrapper.className = 'cms-field';
        const text = document.createElement('span'); text.textContent = label;
        wrapper.append(text, control);
        return wrapper;
    }
    function button(label, action, disabled) {
        const control = document.createElement('button');
        control.type = 'button'; control.className = 'button'; control.textContent = label;
        control.disabled = !!disabled;
        control.addEventListener('click', action);
        return control;
    }
    function drawRules(focusIndex) {
        ruleList.textContent = '';
        rules.forEach((rule, index) => {
            const card = document.createElement('fieldset'); card.className = 'cms-rule';
            const title = document.createElement('legend'); title.textContent = 'Rule ' + (index + 1);
            card.appendChild(title);
            const selectors = document.createElement('div'); selectors.className = 'cms-grid';
            ['featureType', 'elementType'].forEach((key, position) => {
                const control = select(position ? studio.schema.elements : studio.schema.features, rule[key] || 'all');
                control.addEventListener('change', () => { rule[key] = control.value; commitRules(); });
                selectors.appendChild(labeled(position ? 'Element' : 'Feature', control));
            });
            card.appendChild(selectors);
            const properties = document.createElement('div'); properties.className = 'cms-grid cms-rule-properties';
            Object.entries(studio.schema.stylers).forEach(([name, spec]) => {
                const match = rule.stylers.find(styler => Object.hasOwn(styler, name));
                const value = match ? String(match[name]) : '';
                let control;
                if (spec.type === 'select') control = select(spec.options, value, 'Inherit / default');
                else {
                    control = document.createElement('input');
                    control.type = spec.type === 'number' ? 'number' : 'text';
                    control.value = value; control.placeholder = spec.type === 'color' ? '#RRGGBB / default' : 'Inherit / default';
                    if (spec.type === 'number') {
                        control.min = spec.min; control.step = spec.step;
                        if (spec.max !== undefined) control.max = spec.max;
                    } else { control.pattern = '#[a-fA-F0-9]{6}'; control.maxLength = 7; control.spellcheck = false; }
                }
                const wrapper = labeled(spec.label, control);
                if (spec.type === 'color') {
                    const picker = document.createElement('input'); picker.type = 'color'; picker.value = value || '#ffffff';
                    picker.setAttribute('aria-label', spec.label + ' picker');
                    const pair = document.createElement('span'); pair.className = 'cms-color-pair';
                    pair.append(picker, control); wrapper.appendChild(pair);
                    picker.addEventListener('input', () => { control.value = picker.value; control.dispatchEvent(new Event('input', { bubbles: true })); });
                    control.addEventListener('input', () => { if (/^#[a-f\d]{6}$/i.test(control.value)) picker.value = control.value; });
                }
                control.addEventListener(spec.type === 'select' ? 'change' : 'input', () => {
                    if (!control.checkValidity()) return;
                    const at = rule.stylers.findIndex(styler => Object.hasOwn(styler, name));
                    if (control.value === '') { if (at >= 0) rule.stylers.splice(at, 1); }
                    else {
                        const converted = name === 'invert_lightness' ? control.value === 'true' : (spec.type === 'number' ? Number(control.value) : control.value);
                        const styler = { [name]: converted };
                        if (at >= 0) rule.stylers[at] = styler; else rule.stylers.push(styler);
                    }
                    commitRules();
                });
                properties.appendChild(wrapper);
            });
            card.appendChild(properties);
            const actions = document.createElement('div'); actions.className = 'cms-rule-actions';
            function move(delta) {
                [rules[index], rules[index + delta]] = [rules[index + delta], rules[index]];
                commitRules(); drawRules(index + delta);
            }
            actions.append(
                button('Move up', () => move(-1), index === 0),
                button('Move down', () => move(1), index === rules.length - 1),
                button('Duplicate', () => { rules.splice(index + 1, 0, JSON.parse(JSON.stringify(rule))); commitRules(); drawRules(index + 1); }, rules.length >= 200),
                button('Reset properties', () => { rule.stylers = []; commitRules(); drawRules(index); }),
                button('Remove', () => { rules.splice(index, 1); commitRules(); drawRules(Math.min(index, rules.length - 1)); })
            );
            card.appendChild(actions); ruleList.appendChild(card);
        });
        document.getElementById('cms-add-rule').disabled = rules.length >= 200;
        if (focusIndex >= 0) ruleList.children[focusIndex]?.querySelector('select')?.focus();
    }
    document.getElementById('cms-code-visual').addEventListener('click', () => {
        try {
            if (!codeField.value.trim()) throw new Error('Paste style code or load a code preset first.');
            const imported = studio.validateRules(codeField.value);
            // Reset only visual map styling so the imported style starts from Google's baseline.
            studio.colorKeys.forEach(key => {
                document.getElementById('cms-' + key).value = '';
                editor.querySelector('[data-cms-picker="' + key + '"]').value = '#ffffff';
            });
            fields.forEach(field => { if (field.type === 'checkbox' && field.dataset.cmsField.startsWith('hide_')) field.checked = false; });
            rules = JSON.parse(JSON.stringify(imported));
            codeField.value = '';
            commitRules(); drawRules();
            codeField.dispatchEvent(new Event('input', { bubbles: true }));
            codeStatus.textContent = 'Code converted to detailed rules. Your pin, location and map controls were kept. Use the guided picker or edit the rules, then Update to save.';
            update();
        } catch (error) { codeStatus.textContent = error.message; codeField.focus(); }
    });
    document.getElementById('cms-add-rule').addEventListener('click', () => {
        rules.push({ featureType: 'all', elementType: 'all', stylers: [] });
        drawRules(rules.length - 1);
    });
    drawRules();
    picker = window.CalicoMapGuidedPicker({ editor, canvas, getConfig: config, onEdit(featureType, elementType) {
        let index = -1;
        for (let i = rules.length - 1; i >= 0; i--) {
            if ((rules[i].featureType || 'all') === featureType && (rules[i].elementType || 'all') === elementType) { index = i; break; }
        }
        if (index === -1) {
            if (rules.length >= 200) { status.textContent = 'Remove a rule before adding another (200 maximum).'; return; }
            rules.push({ featureType, elementType, stylers: [] });
            index = rules.length - 1;
        }
        drawRules(index);
        const card = ruleList.children[index];
        card.classList.add('cms-rule-selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        status.textContent = 'Editing rule ' + (index + 1) + ': ' + studio.schema.features[featureType] + ' / ' + studio.schema.elements[elementType] + '. Set a property, then Update to save.';
    } });
    update();
    // Do not lose the rest of the map form when JSON has a typo.
    let saving = false;
    form.addEventListener('submit', event => {
        clearError();
        const block = () => { event.preventDefault(); event.stopImmediatePropagation(); };
        if (saving) { block(); return; }
        try {
            checkStyles();
        } catch (error) { block(); showError(error); return; }
        try { studio.locations(config()); }
        catch (error) {
            block();
            saving = true;
            const submitter = event.submitter;
            status.textContent = 'Resolving addresses before saving…';
            ensureLocations().then(() => {
                checkStyles(); studio.locations(config());
                saving = false;
                if (submitter) submitter.disabled = false;
                form.requestSubmit(submitter || undefined);
            }).catch(showError).finally(() => { saving = false; });
        }
    }, true);
}());
