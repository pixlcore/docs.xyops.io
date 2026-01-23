// PixlCore.com Web App
// Author: Joseph Huckaby
// Copyright (c) 2024 Joseph Huckaby

if (!window.app) throw new Error("App Framework is not present.");

app.extend({
	
	name: 'xyDocs',
	epoch: time_now(),
	default_prefs: {
		
	},
	debug_cats: {
		all: true,
		api: true,
		comm: true
	},
	colors: [],
	
	receiveConfig: function(config) {
		// receive config from server
		window.config = this.config = config;
		
		if (config.debug) {
			Debug.enable( this.debug_cats );
			Debug.trace('system', "xyDocs Client Starting Up");
		}
		
		// load prefs and populate for first time users
		this.initPrefs();
		
		// setup theme (light / dark)
		this.initTheme();
		
		// accessibility
		this.initAccessibility();
		this.updateAccessibility();
		
		// header
		this.updateHeaderInfo();
		
		// mouse events
		this.setupMouseEvents();
		
		Dialog.hideProgress();
		
		// hook up mobile sidebar pullover
		$('#d_sidebar_toggle').on('mouseup', function() { app.pullSidebar(); } );
		
		window.addEventListener( "scroll", this.onScroll.bind(this), false );
		window.addEventListener( "scroll", debounce(this.onScrollDelay.bind(this), 250), false );
		
		this.page_manager = new PageManager( config.Page );
		Nav.init();
		
		setInterval( function() { app.tick(); }, 1000 );
	},
	
	init: function() {
		// called by base.js
		setTimeout( function() { $('body').addClass('loaded'); }, 100 );
	},
	
	findSidebarGroup(slug) {
		// locate matching sidebar group from slug
		var groups = config.sections;
		
		for (var idx = 0, len = groups.length; idx < len; idx++) {
			var group = groups[idx];
			var items = group.chapters;
			
			for (var idy = 0, ley = items.length; idy < ley; idy++) {
				if (items[idy].id === slug) return group;
			}
		}
		
		return null;
	},
	
	findSidebarItem(id) {
		// locate matching sidebar item from id
		var groups = config.sections;
		
		for (var idx = 0, len = groups.length; idx < len; idx++) {
			var group = groups[idx];
			var items = group.chapters;
			
			for (var idy = 0, ley = items.length; idy < ley; idy++) {
				if (items[idy].id === id) return items[idy];
			}
		}
		
		return null;
	},
	
	updateHeaderInfo: function(bust) {
		// update top-right display
		var html = '';
		
		// html += '<div id="d_rss_btn" class="header_widget icon" onClick="app.copyRSSFeed()" title="Copy Blog RSS Link"><i class="mdi mdi-rss"></i></div>'; 
		html += '<div id="d_theme_ctrl" class="header_widget icon" onClick="app.openThemeSelector()" title="Select Theme"></div>';
		html += '<div id="d_color_ctrl" class="header_widget icon" onClick="app.openFilterControls()" title="Visual Preferences"><i class="mdi mdi-palette"></i></div>';
		html += '<div id="d_sidebar_ctrl" class="header_widget icon mobile_hide" onClick="app.toggleSidebar()" title="Toggle Sidebar"></div>';
		
		$('#d_header_user_container').html( html );
		this.initTheme();
		this.initSidebarTabs();
		this.initSidebarToggle();
	},
	
	initSidebarToggle: function() {
		// setup sidebar toggler
		this.setSidebarVisibility( !this.getPref('focus') );
	},
	
	setSidebarVisibility: function(enabled) {
		// view or hide sidebar
		var $body = $('body');
		
		if (enabled) {
			$body.removeClass('relative').addClass('sidebar');
			$('#d_sidebar_ctrl').html('<i class="mdi mdi-menu-open"></i>');
			this.setPref('focus', false);
		}
		else {
			$body.removeClass('sidebar').addClass('relative');
			$('#d_sidebar_ctrl').html('<i class="mdi mdi-menu-close"></i>');
			this.setPref('focus', true);
		}
	},
	
	toggleSidebar: function() {
		// toggle sidebar on/off
		var $body = $('body');
		
		if ($body.hasClass('sidebar')) {
			this.setSidebarVisibility(false);
		}
		else {
			this.setSidebarVisibility(true);
		}
	},
	
	initAccessibility() {
		// initialize accessibility subsystem
		var rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.sysReducedMotion = rmQuery.matches;
		
		rmQuery.addEventListener('change', function(event) {
			app.sysReducedMotion = event.matches;
			app.updateAccessibility();
		});
		
		// we need multiple queries for contrast
		var conHighQuery = window.matchMedia('(prefers-contrast: high)');
		var conLowQuery = window.matchMedia('(prefers-contrast: low)');
		this.sysContrast = (conHighQuery.matches ? 'high' : (conLowQuery.matches ? 'low' : 'normal'));
		
		var handleContrastChange = function() {
			app.sysContrast = (conHighQuery.matches ? 'high' : (conLowQuery.matches ? 'low' : 'normal'));
			app.updateAccessibility();
		};
		
		conHighQuery.addEventListener('change', handleContrastChange);
		conLowQuery.addEventListener('change', handleContrastChange);
		
		// init filters to defaults
		if (!this.getPref('filters')) {
			this.setPref('filters', { brightness: 100, contrast: 100, hue: 0, saturation: 100, sepia: 0, grayscale: 0, invert: 0 });
		}
	},
	
	updateAccessibility() {
		// update accessibility settings, after user login, user settings change or CSS event
		var $body = $('body');
		
		// motion setting
		if (this.reducedMotion()) $body.addClass('reduced'); else $body.removeClass('reduced');
		
		// contrast setting
		$body.removeClass(['highcon', 'lowcon']);
		var con = this.userContrast();
		if (con == 'high') $body.addClass('highcon');
		else if (con == 'low') $body.addClass('lowcon');
		
		// color accessibilty
		if (this.getPref('color_acc')) $body.addClass('coloracc'); else $body.removeClass('coloracc');
		
		// apply user filters
		this.applyUserFilters();
	},
	
	applyUserFilters() {
		// filters go
		var filters = this.getPref('filters');
		if (!filters) return; // sanity
		
		if ((filters.brightness != 100) || (filters.contrast != 100) || (filters.hue != 0) || (filters.saturation != 100) || (filters.sepia != 0) || (filters.grayscale != 0) || (filters.invert != 0)) {
			var filts = [];
			if (filters.brightness != 100) filts.push(`brightness(${filters.brightness}%)`);
			if (filters.contrast != 100) filts.push(`contrast(${filters.contrast}%)`);
			if (filters.hue != 0) filts.push(`hue-rotate(${filters.hue}deg)`);
			if (filters.saturation != 100) filts.push(`saturate(${filters.saturation}%)`);
			if (filters.sepia != 0) filts.push(`sepia(${filters.sepia}%)`);
			if (filters.grayscale != 0) filts.push(`grayscale(${filters.grayscale}%)`);
			if (filters.invert != 0) filts.push(`invert(${filters.invert}%)`);
			$('#filter_overlay').css('backdropFilter', filts.join(' ')).show();
		}
		else {
			$('#filter_overlay').css('backdropFilter', 'none').hide();
		}
	},
	
	reducedMotion() {
		// return true if user prefers reduced motion, false otherwise
		if (this.getPref('motion') == 'full') return false;
		else if (this.getPref('motion') == 'reduced') return true;
		else return this.sysReducedMotion;
	},
	
	userContrast() {
		// return user contrast preference
		if (this.getPref('contrast') == 'high') return 'high';
		else if (this.getPref('contrast') == 'normal') return 'normal';
		else if (this.getPref('contrast') == 'low') return 'low';
		else return this.sysContrast;
	},
	
	openFilterControls(elem) {
		// allow user to adjust colors
		var $elem = $(elem || '#d_color_ctrl');
		$elem.data('popover-z-index', 20001);
		$elem.data('popover-hide-overlay', true);
		
		var html = '';
		html += '<div class="sel_dialog_label">Visual Preferences</div>';
		html += '<div id="d_sel_dialog_scrollarea" class="sel_dialog_scrollarea" style="max-height:80vh;">';
		
		// brightness
		html += '<div class="info_label" style="margin-top:15px">Brightness</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_brightness" min="25" max="200" value="100" style="width:200px"></div>';
		
		// contrast
		html += '<div class="info_label">Contrast</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_contrast" min="25" max="200" value="100" style="width:200px"></div>';
		
		// hue
		html += '<div class="info_label">Hue</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_hue" min="-180" max="180" value="0" style="width:200px"></div>';
		
		// saturation
		html += '<div class="info_label">Saturation</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_saturation" min="0" max="200" value="100" style="width:200px"></div>';
		
		// sepia
		html += '<div class="info_label">Sepia</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_sepia" min="0" max="100" value="0" style="width:200px"></div>';
		
		// grayscale
		html += '<div class="info_label">Grayscale</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_grayscale" min="0" max="100" value="0" style="width:200px"></div>';
		
		// invert
		html += '<div class="info_label">Invert</div>';
		html += '<div class="info_value"><input type="range" id="fe_fctrl_invert" min="0" max="100" value="0" style="width:200px"></div>';
		
		// reset button
		html += '<div class="sel_dialog_button_container">';
			html += '<div class="button primary" id="btn_sel_dialog_reset">Reset</div>';
		html += '</div>';
		
		html += '</div>';
		Popover.attach( $elem, '<div style="padding:15px;">' + html + '</div>', true );
		
		// wire up controls
		var filters = this.getPref('filters');
		
		Object.keys(filters).forEach(key => {
			const el = document.getElementById('fe_fctrl_' + key);
			el.value = filters[key];
			
			el.addEventListener('input', () => {
				filters[key] = el.valueAsNumber;
				app.applyUserFilters();
			});
			el.addEventListener('change', () => {
				app.savePrefs();
			});
		});
		
		const resetBtn = document.getElementById('btn_sel_dialog_reset');
		resetBtn.addEventListener('click', () => {
			filters.brightness = 100;
			filters.contrast = 100;
			filters.hue = 0;
			filters.saturation = 100;
			filters.sepia = 0;
			filters.grayscale = 0;
			filters.invert = 0;
			
			app.applyUserFilters();
			app.savePrefs();
			
			Object.keys(filters).forEach(key => {
				document.getElementById('fe_fctrl_' + key).value = filters[key];
			});
		});
	},
	
	openThemeSelector: function() {
		// show light/dark/auto theme selector
		var self = this;
		var $elem = $('#d_theme_ctrl');
		var html = '';
		var themes = [
			{ id: 'light', title: 'Light', icon: 'weather-sunny' },
			{ id: 'dark', title: 'Dark', icon: 'weather-night' },
			{ id: 'auto', title: 'Auto', icon: 'circle-half-full' }
		];
		
		html += '<div class="sel_dialog_label">Select Theme</div>';
		html += '<div id="d_sel_dialog_scrollarea" class="sel_dialog_scrollarea">';
		for (var idy = 0, ley = themes.length; idy < ley; idy++) {
			var theme = themes[idy];
			var sel = (this.getPref('theme') == theme.id);
			html += '<div class="sel_dialog_item check ' + (sel ? 'selected' : '') + '" data-value="' + theme.id + '">';
			if (theme.icon) html += '<i class="mdi mdi-' + theme.icon + '">&nbsp;</i>';
			html += '<span>' + theme.title + '</span>';
			html += '<div class="sel_dialog_item_check"><i class="mdi mdi-check"></i></div>';
			html += '</div>';
		}
		html += '</div>';
		
		Popover.attach( $elem, '<div style="padding:15px;">' + html + '</div>', true );
		
		$('#d_sel_dialog_scrollarea > div.sel_dialog_item').on('mouseup', function() {
			// select item, close dialog and update theme
			var $item = $(this);
			var value = $item.data('value');
			
			Popover.detach();
			app.setTheme(value);
		});
	},
	
	onThemeChange: function(theme) {
		// update highlight.js css
		var $head = $('head');
		$head.find('link[hljs]').remove();
		
		switch (theme) {
			case 'light': $head.append('<link rel="stylesheet" href="/css/atom-one-light.css" hljs>'); break;
			case 'dark': $head.append('<link rel="stylesheet" href="/css/atom-one-dark.css" hljs>'); break;
		}
	},
	
	initSidebarTabs: function() {
		// setup dynamic tabs
		var html = '';
		var color_idx = 0;
		
		config.sections.forEach( function(group) {
			// id, title, icon, items
			html += '<div class="section_title expanded"><i class="ctrl mdi mdi-chevron-down"></i><i class="icon mdi mdi-' + group.icon + '">&nbsp;</i>' + group.title + '</div>';
			html += '<div class="section">';
			
			group.chapters.forEach( function(item) {
				if (typeof(item) == 'string') {
					var id = item;
					item = config.pages[item];
					item.id = id;
				}
				if (!item.title) item.title = item.id;
				if (!item.icon) item.icon = 'source-branch';
				if (!item.loc) item.loc = '#Docs/' + item.id;
				
				var classes = 'section_item';
				html += '<a href="' + item.loc + '" id="tab_' + item.id + '" class="' + classes + '"><i class="icon mdi mdi-' + item.icon + '">&nbsp;</i>' + item.title + '</a>';
				
				color_idx++;
				if (color_idx >= app.colors.length) color_idx = 0;
			} ); // foreach item
			
			html += '</div>';
		} ); // foreach group
		
		$('#d_dynamic_sidebar').html( html );
		
		// calling this again as we've dynamically constructed the sidebar
		setTimeout( function() { app.page_manager.initSidebar(); }, 1 );
	},
	
	getDateOptions(opts = {}) {
		// get combined date/time options with user locale settings
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var [lang, reg] = ropts.locale.split(/\-/);
		if (!reg) reg = lang.toUpperCase();
		
		if (!opts.locale) opts.locale = lang + '-' + reg;
		if (!opts.timeZone) opts.timeZone = ropts.timeZone;
		if (!opts.numberingSystem) opts.numberingSystem = ropts.numberingSystem;
		
		if (opts.locale === false) delete opts.locale;
		if (opts.timeZone === false) delete opts.timeZone;
		if (opts.numberingSystem === false) delete opts.numberingSystem;
		if (opts.hourCycle === false) delete opts.hourCycle;
		
		return opts;
	},
	
	formatDate(epoch, opts) {
		// format date and/or time according to user locale settings
		opts = this.getDateOptions(opts);
		return (new Date( epoch * 1000 )).toLocaleString( opts.locale, opts );
	},
	
	getNiceDateText(epoch) {
		// format date according to user's prefs, plain text
		return this.formatDate(epoch, { 
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	},
	
	getNiceMonthText(epoch) {
		// format date according to user's prefs, plain text
		return this.formatDate(epoch, { 
			year: 'numeric',
			month: 'long'
		});
	},
	
	tick: function() {
		// called every second
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.tick) page.tick();
		}
	},
	
	onScroll: function() {
		// called immediately while scrolling
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onScroll) page.onScroll();
		}
	},
	
	onScrollDelay: function() {
		// called every so often while scrolling
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onScrollDelay) page.onScrollDelay();
			if (page && page.updateBoxButtonFloaterState) page.updateBoxButtonFloaterState();
		}
	},
	
	onKeyDown: function(event) {
		// capture keydown if not focused in text field
		// if (event.key === "Escape") app.openFilterControls();
	},
	
	setupMouseEvents() {
		// capture mouse events and route to custom object, if applicable
		$(window).on('mousemove', function(event) {
			if (app.mouseHandler) app.mouseHandler.mouseMove(event);
		});
		$(window).on('mouseup', function(event) {
			if (app.mouseHandler) {
				app.mouseHandler.mouseUp(event);
				delete app.mouseHandler;
			}
		});
	}
	
}); // app
