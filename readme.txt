=== Calico Map Studio ===
Contributors: calicodesign
Requires at least: 6.2
Requires PHP: 7.4
Stable tag: 0.4.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Style real Google Maps features and reuse your maps in Elementor or with a shortcode.

== Description ==
Choose separate colors for land, water, parks, roads, highways, man-made land, label text and outlines, administrative labels, transit and your location pin. Start with Google default, Soft silver, Midnight, Warm neutral, Coastal or Ultra Light with Labels presets. Hide labels, points of interest, roads, administrative labels and transit independently.

Save multiple named maps. Select a published map in the Calico Styled Map Elementor widget, or use [calico_map id="123"]. Elementor is optional. The widget supports responsive map heights. Shortcodes accept an optional numeric height in pixels: [calico_map id="123" height="500"].

The live admin preview loads only when requested. Front-end maps load near the viewport. Compatible embedded Google Maps JSON can override the palette, with palette export for reuse.

== Installation ==
1. Upload calico-map-studio.zip in Plugins > Add New > Upload Plugin, then activate.
2. Open Map Studio > API Settings and enter your Google Maps JavaScript API browser key.
3. Enable the Maps JavaScript API and billing in Google Cloud. Restrict the key by website referrer and API. Include staging domains if used.
4. Create a map, enter coordinates, customize the palette, and load the preview.
5. Publish the map and insert its shortcode or the Calico Styled Map Elementor widget.

== Requirements and limits ==
Google Maps is an external service, with its own usage charges and terms. The browser API key is visible to visitors by design. Restrict it in Google Cloud. Maps send browser requests to Google when loaded; handle privacy notices and consent integration for your site.

This plugin renders its own roadmap maps. It cannot recolor existing iframe embeds or Elementor's built-in Google Maps widget. No map ID is used; Cloud styling JSON is a different format and cannot be pasted directly here. Satellite imagery and individual buildings cannot be edited. The buildings color targets Google's man-made landscape category, not individually selectable building objects. Map feature detail varies with location and zoom. Existing API loaders are reused; other plugins may impose their own Google configuration.

Coordinates are entered manually, so no Places or Geocoding API is required. The pin opens coordinates in Google Maps; it is not a verified Business Profile / Place ID lookup. No address autocomplete or multi-location marker clustering is included.

Only administrators can manage maps and the API key. Only published maps render publicly. Drafts are not exposed by shortcode. No settings are deleted on deactivation or uninstall. Disable the plugin to stop rendering its maps. Future stable updates are checked through the public CalicoDesignCo/calico-map-studio GitHub releases. Versions through 0.3.0 require one manual upload of this version to enable that update channel. WordPress automatic updates remain under administrator control.

== Frequently Asked Questions ==
= Why are my colors not changing? =
Use Clear code to return to the existing palette, or Edit code visually to convert pasted JSON into editable detailed rules. Imported code overrides palette and feature visibility controls. Save the map and clear page caches after changing a published map.

= Why is the map unavailable? =
Check the saved key, API activation, billing, referrer restrictions and browser console. The location pin opens Google Maps; no text link is displayed below the map.

= Can I import a Snazzy Maps style? =
Yes, if it uses the embedded Google Maps style-array format. Paste the array under Advanced. Use Google's supported feature names and stylers.

== Detailed feature editor ==
33 feature categories and 9 element selectors expose all embedded Google Maps feature / element targets shown in the Snazzy Maps editor. Add ordered rules for fill, outline, text, icons, and feature subcategories. Set visibility (on, simplified or off), color, hue, saturation, lightness, gamma, weight, and invert lightness. Move, duplicate, reset or remove rules. Blank values inherit the existing style; explicit zero and false values are retained.

Detailed rules apply after the quick palette and feature visibility controls. Later matching rules take precedence. Advanced JSON overrides all visual controls; clearing it restores them. Export includes the palette and detailed rules. Administrative styling applies to labels, not geographic borders. Individual feature / element combinations may have no effect depending on Google's map data.

== Guided feature picker ==
Load the admin preview, turn on Pick a map feature, and click the map. The click marks a location; you choose the feature category and element manually. Changing the target highlights matching features in magenta for three seconds. You can repeat or clear the highlight, then use Open styling controls to edit the last matching detailed rule or create a new one.

This is category selection, not automatic feature identification or editing an individual road. Highlights affect matching features across the preview. Some map feature / element pairs may not visibly respond. Highlight rules and the clicked-location marker are temporary: they are never saved, exported or displayed on the public map. Escape exits picker mode. Use Edit code visually to convert imported JSON before editing through the visual rules or guided picker.

== Universal style code ==
The visible Paste or share a map style panel accepts standard embedded Google Maps JSON style arrays from Snazzy Maps and other compatible editors. Paste code and choose Apply style code, or select Ultra Light with Labels from the preset list. Decimal line weights such as 0.2 and 1.2 are retained.

Copy current style code exports the active style as a reusable Google Maps array without location, API key or temporary highlights. A selected text area is provided if clipboard access is unavailable. Edit code visually converts pasted JSON into detailed rules and resets only the styling palette and feature visibility, keeping location, pin and interaction controls. Clear code restores the current visual settings. JavaScript declarations and Cloud styling objects are not supported.

Browse compatible styles: https://snazzymaps.com/explore
Bundled style: Ultra Light with Labels by Anonymous, https://snazzymaps.com/style/151/ultra-light-with-labels (CC0-1.0). See THIRD-PARTY-NOTICES.md.

== Changelog ==
= 0.4.1 =
Accepts quoted numeric style values such as "weight":"2.00", normalizes them to JSON numbers without changing their value, and identifies the exact rule, property and expected range when validation fails.

= 0.4.0 =
Added universal paste/apply/copy style code controls, conversion to visual rules, the original Ultra Light with Labels preset, a Snazzy Maps browse link and decimal line-weight support.

= 0.3.1 =
First public GitHub release. Adds native WordPress update checks for stable GitHub releases with a version-pinned installable ZIP. Preserves all existing maps and settings.

= 0.3.0 =
Added the admin guided feature picker, click-location marker, three-second magenta category highlight, and direct navigation to matching styling controls. Highlights restore on input changes, submit and picker exit. Existing map settings are preserved.

= 0.2.1 =
Removed the location / Google Maps text link below each map. Updated the unavailable-map message.
= 0.2.0 =
Added the full visual feature / element rule editor and all eight Google embedded style properties. Added typed, range-checked JSON validation and ordered rule management. Kept existing maps and palette settings compatible.

= 0.1.0 =
Initial local preview build with feature styling, reusable maps, presets, JSON, Elementor and shortcode support.
