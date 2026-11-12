(function () {
    'use strict';
    window.CalicoMapGuidedPicker = function ({ editor, canvas, getConfig, onEdit }) {
        const studio = window.CalicoMapStudio;
        const root = document.getElementById('cms-guided-picker');
        const toggle = document.getElementById('cms-picker-toggle');
        const controls = document.getElementById('cms-picker-controls');
        const feature = document.getElementById('cms-picker-feature');
        const element = document.getElementById('cms-picker-element');
        const highlight = document.getElementById('cms-picker-highlight');
        const clear = document.getElementById('cms-picker-clear');
        const edit = document.getElementById('cms-picker-edit');
        const status = document.getElementById('cms-picker-status');
        const point = document.getElementById('cms-picker-point');
        let map, clickListener, marker, timeout, restoreStyles;
        let enabled = false;
        let highlighted = false;
        feature.add(new Option('Choose a feature…', ''));
        Object.entries(studio.schema.features).forEach(([key, label]) => feature.add(new Option(label, key)));
        Object.entries(studio.schema.elements).forEach(([key, label]) => element.add(new Option(label, key)));
        element.value = 'geometry.fill';

        function restore() {
            clearTimeout(timeout);
            if (highlighted && map) {
                try { map.setOptions({ styles: studio.styles(getConfig()) }); }
                catch (error) { map.setOptions({ styles: restoreStyles || [] }); }
            }
            highlighted = false;
            restoreStyles = null;
            clear.disabled = true;
        }
        function message() {
            const imported = getConfig().json.trim() !== '';
            edit.disabled = !enabled || !feature.value || imported;
            highlight.disabled = !enabled || !feature.value;
            status.textContent = imported ? 'Advanced JSON is active. You can highlight it; clear the JSON to edit with visual controls.' : (feature.value ? 'Selected: ' + studio.schema.features[feature.value] + ' / ' + studio.schema.elements[element.value] + '. This affects matching features across the map.' : 'Choose the category and element you want to edit.');
        }
        function pulse() {
            if (!map || !enabled || !feature.value) return;
            restore();
            try {
                restoreStyles = studio.styles(getConfig());
                map.setOptions({ styles: studio.highlightStyles(getConfig(), feature.value, element.value) });
                highlighted = true;
                clear.disabled = false;
                status.textContent = 'Temporary magenta highlight: ' + studio.schema.features[feature.value] + ' / ' + studio.schema.elements[element.value] + '. Your saved style is unchanged.';
                timeout = setTimeout(() => { restore(); message(); }, 3000);
            } catch (error) { status.textContent = error.message; }
        }
        function setEnabled(value) {
            enabled = !!value && !!map;
            restore();
            controls.hidden = !enabled;
            toggle.setAttribute('aria-pressed', String(enabled));
            toggle.setAttribute('aria-expanded', String(enabled));
            toggle.textContent = enabled ? 'Done picking' : 'Pick a map feature';
            canvas.classList.toggle('cms-picking', enabled);
            if (map) map.setOptions({ draggableCursor: enabled ? 'crosshair' : null, clickableIcons: enabled });
            if (!enabled && marker) { marker.setMap(null); marker = null; }
            message();
        }
        function attach(nextMap) {
            if (!nextMap) return;
            if (map !== nextMap) {
                restore();
                if (clickListener) clickListener.remove();
                if (marker) { marker.setMap(null); marker = null; }
                map = nextMap;
                clickListener = map.addListener('click', event => {
                    if (!enabled || !event.latLng) return;
                    if (event.stop) event.stop();
                    const lat = event.latLng.lat(), lng = event.latLng.lng();
                    point.textContent = 'Clicked ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + (event.placeId ? ' (place icon). Choose its category below.' : '. Choose the feature category below.');
                    if (marker) marker.setMap(null);
                    marker = new google.maps.Circle({ map, center: event.latLng, radius: 12 * 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom()), strokeColor: '#ed28ba', strokeWeight: 2, fillColor: '#ed28ba', fillOpacity: 0.18, clickable: false });
                    controls.hidden = false;
                    message();
                    feature.focus({ preventScroll: true });
                });
            }
            toggle.disabled = false;
            if (enabled) map.setOptions({ draggableCursor: 'crosshair', clickableIcons: true });
            message();
        }
        toggle.addEventListener('click', () => setEnabled(!enabled));
        feature.addEventListener('change', () => { restore(); message(); pulse(); });
        element.addEventListener('change', () => { restore(); message(); pulse(); });
        highlight.addEventListener('click', pulse);
        clear.addEventListener('click', () => { restore(); message(); });
        edit.addEventListener('click', () => {
            if (edit.disabled) return;
            restore();
            onEdit(feature.value, element.value);
        });
        editor.addEventListener('input', event => {
            if (root.contains(event.target)) return;
            restore(); message();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && enabled) { setEnabled(false); toggle.focus(); }
        });
        document.getElementById('post').addEventListener('submit', () => { restore(); });
        window.addEventListener('pagehide', () => { setEnabled(false); if (clickListener) clickListener.remove(); });
        return { attach, restore };
    };
}());
