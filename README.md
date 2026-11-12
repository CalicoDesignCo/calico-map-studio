# Calico Map Studio

Style the actual features of a Google Map from WordPress: roads, water, landscapes, parks, buildings, labels, icons and more. Display reusable maps with an Elementor widget or a shortcode.

[Download the latest plugin ZIP](https://github.com/CalicoDesignCo/calico-map-studio/releases/latest/download/calico-map-studio.zip) · [Release notes](https://github.com/CalicoDesignCo/calico-map-studio/releases)

## Features

- Five quick palette presets, individual feature colors, and the original Ultra Light with Labels style from Snazzy Maps.
- Detailed rules for 33 feature categories, 9 element targets and 8 styling properties.
- Separate fill, outline, text and icon targets; feature visibility, hue, saturation, lightness, gamma and weight.
- A guided preview picker: click a spot, choose its category, briefly highlight matching features, then open the matching rule.
- Multiple saved maps, a custom location pin, zoom/fullscreen controls and responsive Elementor heights.
- A visible paste/apply/copy code panel for standard Google Maps style arrays, including decimal line weights.
- Conversion from pasted code to editable visual rules without changing pin or map controls.
- Native WordPress updates from stable GitHub releases.

## Install

1. Download **calico-map-studio.zip** from the latest release. Use the attached plugin ZIP, rather than GitHub's automatic source-code archive.
2. In WordPress, open **Plugins → Add New → Upload Plugin**, select the ZIP and activate it.
3. Open **Map Studio → API Settings** and enter a Google Maps JavaScript API browser key. Enable that API and billing in Google Cloud, and restrict the key to your website domains and the Maps JavaScript API.
4. Create a map, enter coordinates, customize its appearance and publish it.
5. Select it in the **Calico Styled Map** Elementor widget, or use the shortcode shown in the map editor.

Example: `[calico_map id="123" height="500"]`.

Requires WordPress 6.2+ and PHP 7.4+. Elementor is optional. Google Maps is an external service with its own billing and terms. Its browser API key is visible by design; restrict it in Google Cloud.

## Guided feature picker

Load the admin preview, select **Pick a map feature**, then click a spot. Choose the feature category and element manually. A magenta highlight shows matching features for three seconds. **Open styling controls** selects the last exact matching rule or creates a new one. Press Escape to exit picker mode.

Google's click events do not automatically identify arbitrary road, water or label elements. Styling applies to a category across the map, not to one individual road. Temporary highlights and the clicked-location marker are never saved or exported. Pasted JSON overrides the visual controls. Choose **Edit code visually** to convert it into detailed rules and enable the picker.

## Paste or share style code

Browse [Snazzy Maps styles](https://snazzymaps.com/explore), open a style and copy its **JavaScript Style Array**. Paste that JSON into **Paste or share a map style → Google Maps style code**, then choose **Apply style code** and save the map.

**Copy current style code** exports the active style as a standard JSON array for another map or compatible website. It includes no API key, location or temporary highlights. If clipboard access is unavailable, the code is selected in a text area for manual copying. **Edit code visually** converts imported rules while preserving their order and decimal values. **Clear code** returns to the existing visual settings. Numeric settings copied as strings (for example, "weight":"2.00") are normalized to numbers. Invalid values report the rule number, property and expected range. Paste the JSON array only, without JavaScript variable declarations; Google Cloud style objects use a different format.

The bundled [Ultra Light with Labels](https://snazzymaps.com/style/151/ultra-light-with-labels) style is by Anonymous and is offered through Snazzy Maps under CC0. [Standalone style JSON](ultra-light-with-labels.json) · [Third-party notices](THIRD-PARTY-NOTICES.md).

## Updates

Version **0.3.1** is the first build with the GitHub updater. If you installed 0.3.0 or earlier, manually upload this release once. Later stable versions can appear through **Dashboard → Updates → Check again**. Automatic updates remain under the administrator's control. No GitHub token is bundled or required.

## Limits and troubleshooting

This plugin renders its own roadmap maps; it does not recolor existing Google Maps iframe embeds or Elementor's built-in map widget. It uses embedded styles without a Cloud map ID. Google Cloud styling JSON uses a different format. Feature availability and styling vary by zoom and location; administrative styles affect labels rather than geographic borders. Individual buildings cannot be selected.

Maps load near the viewport and make requests to Google. Integrate the service with your site's privacy notice and consent requirements. If a map fails to load, check the browser console, API activation, billing and HTTP-referrer restrictions. Clear page caches after changing a published map. Deactivation and uninstall retain saved maps and settings.

## Development and verification

Production code is at the repository root. The PowerShell build script packages only the plugin PHP, assets, includes, readme and license under one calico-map-studio folder.

Local verification uses disposable WordPress 6.8 / PHP 8.3, PHP/JavaScript checks, selector and updater tests, and a headless browser fixture with a mock Google API. Live Google tile appearance, mobile layout and real Elementor integration should be verified for each installation. The updater uses bounded HTTPS requests, caching and version-specific assets; invalid metadata does not interrupt map rendering.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
