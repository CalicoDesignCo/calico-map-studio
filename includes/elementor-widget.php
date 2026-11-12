<?php
if (!defined('ABSPATH')) { exit; }

class Calico_Map_Studio_Widget extends \Elementor\Widget_Base {
    public function get_name() { return 'calico-styled-map'; }
    public function get_title() { return 'Calico Styled Map'; }
    public function get_icon() { return 'eicon-google-maps'; }
    public function get_categories() { return array('general'); }
    public function get_keywords() { return array('google', 'map', 'location', 'style', 'calico'); }
    public function get_script_depends() { return array('calico-map-studio'); }
    public function get_style_depends() { return array('calico-map-studio'); }
    protected function register_controls() {
        $options = array('' => 'Select a published map');
        $maps = get_posts(array('post_type' => Calico_Map_Studio::TYPE, 'post_status' => 'publish', 'posts_per_page' => -1, 'orderby' => 'title', 'order' => 'ASC'));
        foreach ($maps as $map) { $options[$map->ID] = $map->post_title ?: 'Map #' . $map->ID; }
        $this->start_controls_section('map', array('label' => 'Styled Map'));
        $this->add_control('map_id', array('label' => 'Map', 'type' => \Elementor\Controls_Manager::SELECT, 'options' => $options, 'default' => ''));
        $this->add_control('help', array('type' => \Elementor\Controls_Manager::RAW_HTML, 'raw' => 'Create and style reusable maps under WordPress → Map Studio. Publish your map, then reopen this editor to refresh the list.'));
        $this->add_responsive_control('map_height', array('label' => 'Height', 'type' => \Elementor\Controls_Manager::SLIDER, 'size_units' => array('px'), 'range' => array('px' => array('min' => 180, 'max' => 1200)), 'selectors' => array('{{WRAPPER}} .cms-canvas' => 'height: {{SIZE}}{{UNIT}} !important;')));
        $this->end_controls_section();
    }
    protected function render() {
        $settings = $this->get_settings_for_display();
        echo Calico_Map_Studio::shortcode(array('id' => absint($settings['map_id'] ?? 0))); // Escaped by the shortcode renderer.
    }
}
