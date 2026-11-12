<?php
/**
 * Plugin Name: Calico Map Studio
 * Description: Style Google Maps roads, water, land, labels and more. Reuse maps with Elementor or a shortcode.
 * Version: 0.4.1
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Plugin URI: https://github.com/CalicoDesignCo/calico-map-studio
 * Update URI: https://github.com/CalicoDesignCo/calico-map-studio
 * Author: Calico Design
 * License: GPL-2.0-or-later
 * Text Domain: calico-map-studio
 */
if (!defined('ABSPATH')) { exit; }

final class Calico_Map_Studio {
    const VERSION = '0.4.1';
    const TYPE = 'calico_styled_map';
    const META = '_calico_map_config';

    public static function boot() {
        add_action('init', array(__CLASS__, 'register'));
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_init', array(__CLASS__, 'settings'));
        add_action('add_meta_boxes', array(__CLASS__, 'boxes'));
        add_action('save_post_' . self::TYPE, array(__CLASS__, 'save'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'admin_assets'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'assets'));
        add_shortcode('calico_map', array(__CLASS__, 'shortcode'));
        add_action('elementor/widgets/register', array(__CLASS__, 'widget'));
    }

    public static function register() {
        register_post_type(self::TYPE, array(
            'labels' => array('name' => 'Map Studio', 'singular_name' => 'Styled Map', 'add_new_item' => 'Create Styled Map', 'edit_item' => 'Edit Styled Map'),
            'public' => false, 'show_ui' => true, 'show_in_rest' => false,
            'menu_icon' => 'dashicons-location-alt', 'supports' => array('title'),
            'capabilities' => array_fill_keys(array('edit_post', 'read_post', 'delete_post', 'edit_posts', 'edit_others_posts', 'publish_posts', 'read_private_posts', 'delete_posts', 'delete_private_posts', 'delete_published_posts', 'delete_others_posts', 'edit_private_posts', 'edit_published_posts', 'create_posts'), 'manage_options'),
            'map_meta_cap' => false,
        ));
    }

    public static function colors() {
        return array('land' => 'Land', 'water' => 'Water', 'parks' => 'Parks', 'roads' => 'Roads', 'highways' => 'Highways', 'buildings' => 'Buildings / man-made land', 'labels' => 'Label text', 'label_stroke' => 'Label outline', 'boundaries' => 'Administrative label color', 'transit' => 'Transit', 'pin' => 'Location pin');
    }

    public static function toggles() {
        return array('hide_labels' => 'Hide all labels', 'hide_poi' => 'Hide points-of-interest labels / icons', 'hide_transit' => 'Hide transit', 'hide_roads' => 'Hide roads', 'hide_boundaries' => 'Hide administrative labels', 'show_pin' => 'Show location pin', 'zoom_control' => 'Zoom controls', 'fullscreen' => 'Fullscreen control', 'scrollwheel' => 'Allow scroll-wheel zoom');
    }

    public static function defaults() {
        return array_merge(array_fill_keys(array_keys(self::colors()), ''), array_fill_keys(array_keys(self::toggles()), false), array(
            'lat' => 41.8781, 'lng' => -87.6298, 'zoom' => 13, 'height' => 420,
            'location' => 'Our location', 'pin' => '#d85b3f', 'show_pin' => true, 'zoom_control' => true, 'fullscreen' => true, 'json' => '', 'rules' => '[]',
        ));
    }

    public static function number($value, $default, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? max($min, min($max, (float) $value)) : $default;
    }

    public static function sanitize($input, &$error = '') {
        $input = is_array($input) ? $input : array();
        $out = self::defaults();
        foreach (self::colors() as $key => $label) {
            $out[$key] = isset($input[$key]) && is_string($input[$key]) ? (sanitize_hex_color($input[$key]) ?: '') : '';
        }
        foreach (self::toggles() as $key => $label) { $out[$key] = isset($input[$key]) && in_array($input[$key], array('1', 1, true, 'on'), true); }
        $out['lat'] = self::number($input['lat'] ?? null, $out['lat'], -85, 85);
        $out['lng'] = self::number($input['lng'] ?? null, $out['lng'], -180, 180);
        $out['zoom'] = (int) self::number($input['zoom'] ?? null, 13, 1, 20);
        $out['height'] = (int) self::number($input['height'] ?? null, 420, 180, 1200);
        $out['location'] = isset($input['location']) && is_string($input['location']) ? sanitize_text_field($input['location']) : 'Our location';
        foreach (array('json', 'rules') as $field) {
            $raw = isset($input[$field]) && is_string($input[$field]) ? trim($input[$field]) : '';
            if ($raw !== '') {
                $field_error = '';
                $validated = self::validate_rules($raw, $field_error);
                if ($field_error) { $error = $field_error; }
                else { $out[$field] = wp_json_encode($validated); }
            }
        }
        return $out;
    }

    public static function schema() {
        static $schema;
        if (!$schema) { $schema = json_decode(file_get_contents(__DIR__ . '/assets/style-schema.json'), true); }
        return $schema;
    }

    public static function presets() {
        static $presets;
        if (!$presets) { $presets = json_decode(file_get_contents(__DIR__ . '/assets/style-presets.json'), true); }
        return $presets;
    }

    public static function validate_rules($raw, &$error) {
        $schema = self::schema();
        $decoded = json_decode($raw, true);
        if (strlen($raw) > 60000 || substr($raw, 0, 1) !== '[' || !is_array($decoded) || count($decoded) > 200) {
            $error = 'Use an embedded Google Maps style array, up to 200 rules and 60 KB.'; return array();
        }
        foreach ($decoded as $rule_index => $rule) {
            if (!is_array($rule) || empty($rule['stylers']) || !is_array($rule['stylers']) ||
                !is_string($rule['featureType'] ?? 'all') || !isset($schema['features'][$rule['featureType'] ?? 'all']) ||
                !is_string($rule['elementType'] ?? 'all') || !isset($schema['elements'][$rule['elementType'] ?? 'all']) ||
                array_diff(array_keys($rule), array('featureType', 'elementType', 'stylers'))) {
                $error = 'Each rule needs a supported feature, element and nonempty stylers array.'; return array();
            }
            foreach ($rule['stylers'] as $styler_index => $styler) {
                if (!is_array($styler) || count($styler) !== 1) { $error = 'Each styler must contain one property.'; return array(); }
                $name = key($styler); $value = current($styler);
                $spec = $schema['stylers'][$name] ?? null;
                if ($spec && $spec['type'] === 'number' && is_string($value) && preg_match('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iD', trim($value))) { $value = (float) trim($value); }
                $valid = false;
                if ($spec) {
                    if ($spec['type'] === 'color') { $valid = is_string($value) && preg_match('/^#[a-fA-F0-9]{6}$/', $value); }
                    elseif ($name === 'invert_lightness') { $valid = is_bool($value); }
                    elseif ($spec['type'] === 'select') { $valid = is_string($value) && isset($spec['options'][$value]); }
                    else { $valid = (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $spec['min'] && (!isset($spec['max']) || $value <= $spec['max']); }
                }
                if (!$valid) {
                    $label = 'Rule ' . ($rule_index + 1) . ', ' . substr((string) $name, 0, 60) . ': ';
                    if (!$spec) { $error = $label . 'unsupported style property.'; }
                    else {
                        $hint = $spec['type'] === 'number' ? ('use a number ' . (isset($spec['max']) ? 'from ' . $spec['min'] . ' to ' . $spec['max'] : 'at least ' . $spec['min'])) : ($spec['type'] === 'color' ? 'use a six-digit hex color such as #123456' : ($name === 'invert_lightness' ? 'use true or false without quotes' : 'use on, off or simplified'));
                        $error = $label . substr(wp_json_encode(current($styler)), 0, 80) . ' is invalid; ' . $hint . '.';
                    }
                    return array();
                }
                $decoded[$rule_index]['stylers'][$styler_index][$name] = $value;
            }
        }
        return $decoded;
    }

    public static function config($id) {
        $stored = get_post_meta($id, self::META, true);
        return self::sanitize(array_merge(self::defaults(), is_array($stored) ? $stored : array()));
    }

    public static function key() { return (string) get_option('calico_map_api_key', ''); }

    public static function menu() {
        add_submenu_page('edit.php?post_type=' . self::TYPE, 'Map Studio Settings', 'API Settings', 'manage_options', 'calico-map-settings', array(__CLASS__, 'settings_page'));
    }

    public static function settings() {
        register_setting('calico_map_settings', 'calico_map_api_key', array('type' => 'string', 'sanitize_callback' => array(__CLASS__, 'sanitize_key'), 'default' => '', 'show_in_rest' => false));
    }

    public static function sanitize_key($value) { return is_string($value) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $value) : ''; }

    public static function settings_page() {
        if (!current_user_can('manage_options')) { return; }
        ?>
        <div class="wrap"><h1>Map Studio — API Settings</h1>
        <p>Enable the Google Maps JavaScript API and billing in your Google Cloud project. Restrict this browser key to your website domains (HTTP referrers) and to the Maps JavaScript API.</p>
        <p>The key is sent to visitors’ browsers to display maps. A map ID is not needed for this plugin’s embedded styles.</p>
        <form method="post" action="options.php"><?php settings_fields('calico_map_settings'); ?>
        <table class="form-table"><tr><th><label for="calico-map-key">Browser API key</label></th><td><input class="regular-text" id="calico-map-key" name="calico_map_api_key" value="<?php echo esc_attr(self::key()); ?>" autocomplete="off" spellcheck="false"></td></tr></table>
        <?php submit_button(); ?></form>
        <p><a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">Google setup instructions</a></p>
        <p>Maps connect to Google when displayed. Include this service in your site’s privacy notice and consent setup as appropriate. Existing iframe maps are not modified.</p></div>
        <?php
    }

    public static function assets() {
        wp_register_style('calico-map-studio', plugins_url('assets/maps.css', __FILE__), array(), self::VERSION);
        if (!wp_script_is('calico-map-studio', 'registered')) {
            wp_register_script('calico-map-studio', plugins_url('assets/maps.js', __FILE__), array(), self::VERSION, true);
            wp_localize_script('calico-map-studio', 'CalicoMapSchema', self::schema());
        }
    }

    public static function admin_assets($hook) {
        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== self::TYPE || !in_array($hook, array('post.php', 'post-new.php'), true)) { return; }
        self::assets();
        wp_enqueue_style('calico-map-studio');
        wp_enqueue_script('calico-map-studio');
        wp_enqueue_script('calico-map-picker', plugins_url('assets/admin-picker.js', __FILE__), array('calico-map-studio'), self::VERSION, true);
        wp_enqueue_script('calico-map-admin', plugins_url('assets/admin.js', __FILE__), array('calico-map-studio', 'calico-map-picker'), self::VERSION, true);
        wp_localize_script('calico-map-admin', 'CalicoMapStylePresets', self::presets());
    }

    public static function boxes() {
        add_meta_box('calico-map-editor', 'Design your map', array(__CLASS__, 'editor'), self::TYPE, 'normal', 'high');
    }

    public static function field($key, $label, $config, $type = 'text', $extra = '') {
        echo '<label class="cms-field" for="cms-' . esc_attr($key) . '"><span>' . esc_html($label) . '</span><input id="cms-' . esc_attr($key) . '" data-cms-field="' . esc_attr($key) . '" name="cms[' . esc_attr($key) . ']" type="' . esc_attr($type) . '" value="' . esc_attr($config[$key]) . '" ' . $extra . '></label>';
    }

    public static function editor($post) {
        $c = self::config($post->ID);
        wp_nonce_field('calico_map_save', 'calico_map_nonce');
        if (get_post_meta($post->ID, '_calico_map_json_error', true)) { echo '<div class="notice notice-error inline"><p>' . esc_html(get_post_meta($post->ID, '_calico_map_json_error', true)) . ' The previously saved detailed rules and JSON were retained.</p></div>'; }
        ?>
        <div class="cms-editor" data-api-key="<?php echo esc_attr(self::key()); ?>">
        <p class="cms-intro">Color the actual map features. Save once and reuse this map across your site.</p>
        <div class="cms-layout"><div class="cms-controls">
        <h3>Location</h3><div class="cms-grid">
        <?php
        self::field('location', 'Location / pin label', $c);
        self::field('lat', 'Latitude', $c, 'number', 'min="-85" max="85" step="any"');
        self::field('lng', 'Longitude', $c, 'number', 'min="-180" max="180" step="any"');
        self::field('zoom', 'Zoom', $c, 'number', 'min="1" max="20" step="1"');
        self::field('height', 'Default height (px)', $c, 'number', 'min="180" max="1200" step="1"');
        ?></div><p class="description">In Google Maps, right-click a location to copy its coordinates. Paste latitude and longitude separately here.</p>
        <section class="cms-style-code" id="cms-style-code" aria-labelledby="cms-code-title"><h3 id="cms-code-title">Paste or share a map style</h3>
        <p>Paste a Google Maps JSON style array from Snazzy Maps or another compatible editor. Code overrides the palette and detailed rules. It does not change your location pin or map controls.</p>
        <p><a class="button" href="https://snazzymaps.com/explore" target="_blank" rel="noopener noreferrer">Browse styles on Snazzy Maps ↗</a> <span class="description">Open a style and copy its JavaScript Style Array. Paste only the JSON array, without JavaScript variable declarations.</span></p>
        <label for="cms-json"><strong>Google Maps style code (JSON)</strong></label><textarea id="cms-json" data-cms-field="json" name="cms[json]" rows="8" spellcheck="false" placeholder='[{"featureType":"water","stylers":[{"color":"#e9e9e9"}]}]'><?php echo esc_textarea($c['json']); ?></textarea>
        <p class="cms-code-actions"><button class="button button-primary" type="button" id="cms-code-apply">Apply style code</button> <button class="button" type="button" id="cms-export">Copy current style code</button> <button class="button" type="button" id="cms-code-visual">Edit code visually</button> <button class="button" type="button" id="cms-code-clear">Clear code</button></p>
        <p class="description">Copy exports a standard style array for reuse on another map or compatible website. Edit code visually replaces the quick palette and detailed rules with the pasted style, enabling the guided picker.</p>
        <label id="cms-code-output-wrap" for="cms-code-output" hidden><strong>Current style code to share</strong><textarea id="cms-code-output" rows="6" readonly spellcheck="false"></textarea></label>
        <p id="cms-code-status" role="status" aria-live="polite"></p></section>
        <h3>Color palette &amp; presets</h3><p><label for="cms-preset">Start with a preset </label><select id="cms-preset"><option value="">Choose…</option><option value="standard">Google default</option><option value="silver">Soft silver</option><option value="night">Midnight</option><option value="warm">Warm neutral</option><option value="coastal">Coastal</option><option value="ultra_light_labels">Ultra Light with Labels (Snazzy Maps)</option></select> <button type="button" class="button" id="cms-apply-preset">Apply preset</button></p>
        <p class="description">Ultra Light with Labels is by Anonymous, via <a href="https://snazzymaps.com/style/151/ultra-light-with-labels" target="_blank" rel="noopener noreferrer">Snazzy Maps</a> (CC0).</p>
        <p class="description">Leave a color empty to keep Google’s default. Presets replace colors; visibility controls are kept.</p>
        <div class="cms-grid cms-palette"><?php foreach (self::colors() as $key => $label) { ?>
        <label class="cms-field" for="cms-<?php echo esc_attr($key); ?>"><span><?php echo esc_html($label); ?></span><span class="cms-color-pair"><input aria-label="<?php echo esc_attr($label . ' picker'); ?>" type="color" data-cms-picker="<?php echo esc_attr($key); ?>" value="<?php echo esc_attr($c[$key] ?: '#ffffff'); ?>"><input id="cms-<?php echo esc_attr($key); ?>" data-cms-field="<?php echo esc_attr($key); ?>" name="cms[<?php echo esc_attr($key); ?>]" value="<?php echo esc_attr($c[$key]); ?>" placeholder="Default" pattern="#[a-fA-F0-9]{6}" maxlength="7" spellcheck="false"></span></label>
        <?php } ?></div>
        <h3>Visibility &amp; interaction</h3><div class="cms-checks"><?php foreach (self::toggles() as $key => $label) { ?>
        <label><input type="checkbox" data-cms-field="<?php echo esc_attr($key); ?>" name="cms[<?php echo esc_attr($key); ?>]" value="1" <?php checked($c[$key]); ?>> <?php echo esc_html($label); ?></label>
        <?php } ?></div>
        <section class="cms-rule-section"><h3>Detailed feature rules</h3>
        <p>Target a feature and an element, then choose its styling. Rules apply after the quick palette, from top to bottom; later matching rules take precedence. Blank properties inherit the existing style.</p>
        <p class="description">Some feature / element combinations have no visible effect. Administrative styling controls labels, not geographic borders. Weight accepts nonnegative decimal pixel values. Hue and brightness adjustments depend on Google’s base style.</p>
        <input type="hidden" id="cms-rules" data-cms-field="rules" name="cms[rules]" value="<?php echo esc_attr($c['rules']); ?>">
        <div id="cms-rule-list"></div><p><button type="button" class="button" id="cms-add-rule">Add feature rule</button></p>
        <p id="cms-rules-note" role="status"></p></section>
        </div><div class="cms-preview-panel"><h3>Live preview</h3>
        <p><button class="button button-primary" type="button" id="cms-preview-load">Load Google Maps preview</button></p>
        <p class="description">Loads Google Maps using your saved API key. Palette changes update the loaded preview immediately.</p>
        <div class="cms-preview cms-canvas" id="cms-preview" role="region" aria-label="Styled map preview"><p>Preview will appear here.</p></div><p id="cms-status" role="status" aria-live="polite"></p>
        <section id="cms-guided-picker" class="cms-guided-picker" aria-labelledby="cms-picker-title">
        <h3 id="cms-picker-title">Guided feature picker</h3>
        <p><button type="button" class="button" id="cms-picker-toggle" aria-pressed="false" aria-expanded="false" aria-controls="cms-picker-controls" disabled>Pick a map feature</button></p>
        <p class="description">Load the preview to enable picking. Click a spot, then choose what you want to edit. Google does not identify the feature automatically.</p>
        <div id="cms-picker-controls" hidden>
        <p id="cms-picker-point">Click the preview, or choose a feature and element below.</p>
        <div class="cms-grid"><label class="cms-field" for="cms-picker-feature"><span>Feature</span><select id="cms-picker-feature"></select></label><label class="cms-field" for="cms-picker-element"><span>Element</span><select id="cms-picker-element"></select></label></div>
        <p class="cms-picker-actions"><button type="button" class="button" id="cms-picker-highlight" disabled>Highlight for 3 seconds</button> <button type="button" class="button" id="cms-picker-clear" disabled>Clear highlight</button> <button type="button" class="button button-primary" id="cms-picker-edit" disabled>Open styling controls</button></p>
        <p class="description">Magenta highlights the selected category across the map. It is temporary and is never saved or exported. Some elements may not visibly respond. Press Escape to leave picker mode.</p>
        <p id="cms-picker-status" role="status" aria-live="polite"></p></div></section>
        <div class="cms-usage"><h3>Use this map</h3><code>[calico_map id="<?php echo (int) $post->ID; ?>"]</code><p>Publish the map, then select it in Elementor’s <strong>Calico Styled Map</strong> widget or paste this shortcode into a Shortcode block.</p><p>Optional shortcode height: <code>height="500"</code>.</p></div>
        </div></div></div>
        <?php
    }

    public static function save($id) {
        if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || wp_is_post_revision($id) || !current_user_can('manage_options') || !current_user_can('edit_post', $id) || !isset($_POST['calico_map_nonce']) || !is_string($_POST['calico_map_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['calico_map_nonce'])), 'calico_map_save')) { return; }
        if (!isset($_POST['cms']) || !is_array($_POST['cms'])) { return; }
        $error = '';
        $config = self::sanitize(wp_unslash($_POST['cms']), $error);
        if ($error) {
            $old = self::config($id);
            $config['json'] = $old['json'];
            $config['rules'] = $old['rules'];
            update_post_meta($id, '_calico_map_json_error', $error);
        } else { delete_post_meta($id, '_calico_map_json_error'); }
        update_post_meta($id, self::META, $config);
    }

    public static function shortcode($atts) {
        $atts = shortcode_atts(array('id' => 0, 'height' => 0), $atts, 'calico_map');
        $id = absint($atts['id']);
        if (get_post_type($id) !== self::TYPE || get_post_status($id) !== 'publish') { return current_user_can('manage_options') ? '<p class="cms-message">Select a published Map Studio map.</p>' : ''; }
        $c = self::config($id);
        if (!empty($atts['height'])) { $c['height'] = (int) self::number($atts['height'], $c['height'], 180, 1200); }
        self::assets();
        wp_enqueue_style('calico-map-studio');
        wp_enqueue_script('calico-map-studio');
        $payload = wp_json_encode(array('config' => $c, 'apiKey' => self::key()));
        return '<div class="cms-map" data-cms-map="' . esc_attr($payload) . '"><div class="cms-canvas" style="height:' . (int) $c['height'] . 'px" role="region" aria-label="' . esc_attr($c['location'] ?: 'Location map') . '"><p class="cms-loading" role="status">Loading map…</p></div></div>';
    }

    public static function widget($manager) {
        require_once __DIR__ . '/includes/elementor-widget.php';
        $manager->register(new Calico_Map_Studio_Widget());
    }
}
require_once __DIR__ . '/includes/class-map-updater.php';
Calico_Map_Studio_Updater::register(__FILE__);
Calico_Map_Studio::boot();
