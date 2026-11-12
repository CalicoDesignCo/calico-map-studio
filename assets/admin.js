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
    function config() {
        const result = {};
        fields.forEach(field => { result[field.dataset.cmsField] = field.type === 'checkbox' ? field.checked : field.value; });
        return result;
    }
    async function update() {
        const current = ++revision;
        try {
            const c = config();
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
        active = true;
        event.target.disabled = true;
        status.textContent = 'Loading Google Maps…';
        await update();
        event.target.disabled = false;
        event.target.textContent = 'Refresh preview';
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
    document.getElementById('post').addEventListener('submit', event => {
        try { studio.styles(config()); }
        catch (error) { event.preventDefault(); status.textContent = error.message; document.getElementById('cms-json').focus(); }
    });
}());
