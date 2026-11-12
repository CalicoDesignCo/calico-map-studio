(function () {
    'use strict';
    if (window.CalicoMapStudio) return;
    const features = {
        land: ['landscape', 'geometry'], water: ['water', 'geometry'],
        parks: ['poi.park', 'geometry'], roads: ['road', 'geometry'],
        highways: ['road.highway', 'geometry'], buildings: ['landscape.man_made', 'geometry'],
        labels: ['all', 'labels.text.fill'], label_stroke: ['all', 'labels.text.stroke'],
        boundaries: ['administrative', 'labels.text.fill'], transit: ['transit', 'geometry']
    };
    const presets = {
        standard: ['', '', '', '', '', '', '', '', '', ''],
        silver: ['#f1f2f3', '#b8cbd3', '#d9e3d5', '#ffffff', '#d6d7db', '#e5e7e9', '#5d6770', '#ffffff', '#b5bac1', '#d5d8de'],
        night: ['#202833', '#111b28', '#253d36', '#364252', '#56647a', '#293341', '#aeb9c8', '#202833', '#4b586b', '#364454'],
        warm: ['#eee8df', '#a8c1c5', '#d0d9bd', '#ffffff', '#d3b993', '#e3d9c9', '#6a6258', '#f6f1ea', '#c6b8a7', '#d1c3af'],
        coastal: ['#f3f0e7', '#83becb', '#c7d9b0', '#ffffff', '#e4c895', '#e6e2d6', '#4a646c', '#ffffff', '#b4c1bc', '#cedadd']
    };
    const colorKeys = Object.keys(features);
    const live = new Map();
    let loading;
    let Pin;
    const schema = window.CalicoMapSchema;

    function validateRules(raw) {
        const rules = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(rules) || rules.length > 200 || JSON.stringify(rules).length > 60000) throw new Error('Use an embedded style array up to 200 rules and 60 KB.');
        const normalized = [];
        rules.forEach((rule, ruleIndex) => {
            if (!rule || typeof rule !== 'object' || Array.isArray(rule) || !Array.isArray(rule.stylers) || !rule.stylers.length ||
                typeof (rule.featureType ?? 'all') !== 'string' || !Object.hasOwn(schema.features, rule.featureType ?? 'all') ||
                typeof (rule.elementType ?? 'all') !== 'string' || !Object.hasOwn(schema.elements, rule.elementType ?? 'all') ||
                Object.keys(rule).some(key => !['featureType', 'elementType', 'stylers'].includes(key))) throw new Error('Choose a supported feature, element and at least one style property.');
            const normalizedStylers = rule.stylers.map(styler => {
                if (!styler || typeof styler !== 'object' || Array.isArray(styler) || Object.keys(styler).length !== 1) throw new Error('Each styler must contain one property.');
                const [name, original] = Object.entries(styler)[0];
                let value = original;
                const spec = Object.hasOwn(schema.stylers, name) ? schema.stylers[name] : null;
                if (spec && spec.type === 'number' && typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) value = Number(value.trim());
                let valid = false;
                if (spec) {
                    if (spec.type === 'color') valid = typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
                    else if (name === 'invert_lightness') valid = typeof value === 'boolean';
                    else if (spec.type === 'select') valid = typeof value === 'string' && Object.hasOwn(spec.options, value);
                    else valid = typeof value === 'number' && Number.isFinite(value) && value >= spec.min && (spec.max === undefined || value <= spec.max);
                }
                if (!valid) {
                    const label = 'Rule ' + (ruleIndex + 1) + ', ' + name.slice(0, 60) + ': ';
                    if (!spec) throw new Error(label + 'unsupported style property.');
                    const hint = spec.type === 'number' ? ('use a number ' + (spec.max === undefined ? 'at least ' + spec.min : 'from ' + spec.min + ' to ' + spec.max)) : (spec.type === 'color' ? 'use a six-digit hex color such as #123456' : (name === 'invert_lightness' ? 'use true or false without quotes' : 'use on, off or simplified'));
                    throw new Error(label + JSON.stringify(original).slice(0, 80) + ' is invalid; ' + hint + '.');
                }
                return { [name]: value };
            });
            normalized.push({ ...rule, stylers: normalizedStylers });
        });
        return normalized;
    }

    function styles(config) {
        if (config.json && config.json.trim()) {
            return validateRules(config.json);
        }
        const rules = [];
        colorKeys.forEach(key => {
            if (/^#[a-f\d]{6}$/i.test(config[key] || '')) {
                rules.push({ featureType: features[key][0], elementType: features[key][1], stylers: [{ color: config[key] }] });
            }
        });
        const hidden = { hide_poi: 'poi', hide_transit: 'transit', hide_roads: 'road', hide_boundaries: 'administrative' };
        Object.keys(hidden).forEach(key => {
            if (config[key]) rules.push({ featureType: hidden[key], elementType: ['hide_poi', 'hide_boundaries'].includes(key) ? 'labels' : 'all', stylers: [{ visibility: 'off' }] });
        });
        if (config.hide_labels) rules.push({ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] });
        return rules.concat(validateRules(config.rules || '[]'));
    }

    function highlightStyles(config, featureType, elementType) {
        if (!Object.hasOwn(schema.features, featureType) || !Object.hasOwn(schema.elements, elementType)) throw new Error('Choose a feature and element to highlight.');
        const stylers = [{ visibility: 'on' }, { color: '#ed28ba' }];
        if (elementType.endsWith('.stroke')) stylers.push({ weight: 4 });
        return styles(config).concat([{ featureType, elementType, stylers }]);
    }

    function load(apiKey) {
        if (window.google && google.maps && google.maps.Map) return Promise.resolve(google.maps);
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            let poll;
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                clearInterval(poll);
                if (error) reject(error); else resolve(google.maps);
            };
            const timeout = setTimeout(() => finish(new Error('Google Maps did not load. Check the API key, domain restrictions and network connection.')), 20000);
            // Share an API loader already supplied by Elementor or another plugin.
            const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"],script[src*="maps.google.com/maps/api/js"]');
            if (existing || (window.google && google.maps && google.maps.importLibrary)) {
                if (window.google && google.maps && google.maps.importLibrary) {
                    google.maps.importLibrary('maps').then(() => finish(), finish);
                } else {
                    poll = setInterval(() => { if (window.google && google.maps && google.maps.Map) finish(); }, 100);
                    existing.addEventListener('error', () => finish(new Error('The existing Google Maps script could not load.')), { once: true });
                }
                return;
            }
            if (!apiKey) { finish(new Error('Add a Google Maps browser API key in Map Studio → API Settings.')); return; }
            window.calicoMapStudioReady = () => finish();
            const script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key: apiKey, v: 'quarterly', loading: 'async', callback: 'calicoMapStudioReady' });
            script.async = true;
            script.dataset.calicoMaps = 'true';
            script.onerror = () => { script.remove(); finish(new Error('Google Maps could not load. Check your connection and API setup.')); };
            document.head.appendChild(script);
        });
        loading.catch(() => { loading = null; });
        return loading;
    }

    function pinClass() {
        if (Pin) return Pin;
        Pin = class extends google.maps.OverlayView {
            constructor(map, config) { super(); this.config = config; this.setMap(map); }
            onAdd() {
                this.element = document.createElement('a');
                this.element.className = 'cms-pin';
                this.element.target = '_blank';
                this.element.rel = 'noopener noreferrer';
                // Static markup only. All location text is assigned through DOM properties.
                this.element.innerHTML = '<svg viewBox="0 0 36 48" aria-hidden="true"><path d="M18 1C8.6 1 1 8.6 1 18c0 12 17 29 17 29s17-17 17-29C35 8.6 27.4 1 18 1Z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="white"/></svg>';
                google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.element);
                this.getPanes().overlayMouseTarget.appendChild(this.element);
                this.draw();
            }
            draw() {
                if (!this.element) return;
                const c = this.config;
                const point = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(Number(c.lat), Number(c.lng)));
                if (!point) return;
                this.element.style.left = point.x + 'px';
                this.element.style.top = point.y + 'px';
                this.element.style.color = /^#[a-f\d]{6}$/i.test(c.pin || '') ? c.pin : '#d85b3f';
                this.element.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.lat + ',' + c.lng);
                this.element.setAttribute('aria-label', (c.location || 'Our location') + ' — Open in Google Maps');
                this.element.title = c.location || 'Our location';
            }
            onRemove() { if (this.element) this.element.remove(); this.element = null; }
        };
        return Pin;
    }

    async function render(canvas, config, apiKey) {
        const parsedStyles = styles(config); // Validate before touching a working preview.
        await load(apiKey);
        if (!canvas.isConnected) return;
        const center = { lat: Number(config.lat), lng: Number(config.lng) };
        const options = { center, zoom: Number(config.zoom), styles: parsedStyles, mapTypeId: 'roadmap',
            disableDefaultUI: true, zoomControl: !!config.zoom_control, fullscreenControl: !!config.fullscreen,
            scrollwheel: !!config.scrollwheel, gestureHandling: 'cooperative', clickableIcons: false,
            // Embedded style rules need a map without a cloud map ID.
            renderingType: google.maps.RenderingType ? google.maps.RenderingType.RASTER : undefined
        };
        let state = live.get(canvas);
        if (!state) {
            canvas.textContent = '';
            state = { map: new google.maps.Map(canvas, options), pin: null };
            live.set(canvas, state);
        } else state.map.setOptions(options);
        if (config.show_pin) {
            if (!state.pin) { const LocationPin = pinClass(); state.pin = new LocationPin(state.map, config); }
            else { state.pin.config = config; state.pin.draw(); }
        } else if (state.pin) { state.pin.setMap(null); state.pin = null; }
        return state.map;
    }

    function errorMessage(canvas, message) {
        canvas.textContent = '';
        const p = document.createElement('p');
        p.className = 'cms-loading';
        p.setAttribute('role', 'status');
        p.textContent = message;
        canvas.appendChild(p);
    }
    function init(root) {
        const elements = [];
        if (root.matches && root.matches('[data-cms-map]')) elements.push(root);
        if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-cms-map]'));
        elements.forEach(element => {
            if (element.dataset.cmsReady) return;
            element.dataset.cmsReady = '1';
            const start = async () => {
                const canvas = element.querySelector('.cms-canvas');
                if (!canvas) return;
                try {
                    const payload = JSON.parse(element.dataset.cmsMap);
                    await render(canvas, payload.config, payload.apiKey);
                } catch (error) { errorMessage(canvas, 'Map unavailable. Please try again later.'); }
            };
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(entries => {
                    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
                }, { rootMargin: '200px' });
                observer.observe(element);
            } else start();
        });
    }
    function cleanup() {
        live.forEach((state, canvas) => {
            if (canvas.isConnected) return;
            if (state.pin) state.pin.setMap(null);
            google.maps.event.clearInstanceListeners(state.map);
            live.delete(canvas);
        });
    }
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = function () {
        live.forEach((state, canvas) => errorMessage(canvas, 'Google Maps authorization failed. Check the API key, billing and allowed domains.'));
        if (typeof previousAuthFailure === 'function') previousAuthFailure();
    };
    window.CalicoMapStudio = { styles, presets, colorKeys, render, init, schema, validateRules, highlightStyles };
    function ready() {
        init(document);
        new MutationObserver(records => {
            records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) init(node); }));
            if (records.some(record => record.removedNodes.length)) cleanup();
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
}());
