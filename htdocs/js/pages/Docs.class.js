// Documentation Viewer Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Docs = class Docs extends Page {
	
	onInit() {
		// called once at page load
		var self = this;
	}
	
	onActivate(args) {
		// page activation
		if (!args) args = {};
		if (!args.sub) args.sub = 'index';
		this.args = args;
		
		app.setWindowTitle('Documentation');
		app.setHeaderTitle( '<i class="mdi mdi-file-document-multiple-outline">&nbsp;</i>xyOps Documentation' );
		app.showSidebar(true);
		
		// Calling page: Docs: {"sub":"hosting/key-rotation"}
		var [ doc, anchor ] = args.sub.split(/\//);
		args.doc = doc;
		args.anchor = anchor || '';
		
		this.scrollCache = {};
		
		this.div.html( '' );
		this.loading();
		
		app.api.get( 'app/get_doc', args, this.receive_doc.bind(this), this.fullPageError.bind(this) );
		
		return true;
	}
	
	receive_doc(resp) {
		// receive raw markdown from server, render it client-side
		var args = this.args;
		var title = resp.title;
		var html = '';
		
		// figure out what icon we should use
		var item = app.findSidebarItem(args.doc);
		var icon = item ? item.icon : 'file-document-outline';
		
		// header nav
		if (args.doc == 'index') {
			app.setWindowTitle('Documentation');
			app.setHeaderTitle( '<i class="mdi mdi-file-document-multiple-outline">&nbsp;</i>xyOps Documentation' );
			app.highlightTab( 'Docs' );
		}
		else {
			app.setWindowTitle( title );
			app.setHeaderNav([
				{ icon: 'file-document-multiple-outline', loc: '#Docs', title: 'Docs' },
				{ icon: icon, title: `<span class="link" onClick="window.scrollTo(0,0)">${title}</span>` }
			]);
			app.highlightTab( args.doc );
		}
		
		html += '<div class="box">';
		
		html += '<div class="box_title doc">';
			html += `<i class="mdi mdi-${icon}"></i>`;
			html += title;
			html += '<div class="box_title_widget" style="overflow:visible"><i class="mdi mdi-magnify" onClick="$(\'#fe_doc_search\').focus()">&nbsp;</i><input type="text" id="fe_doc_search" placeholder="Search docs..."/></div>';
			html += '<div class="clear"></div>';
			if (!['index'].includes(args.doc)) {
				html += '<div class="box_subtitle"><a href="#Docs">&laquo; Back to Document Index</a></div>';
			}
		html += '</div>';
		
		html += '<div class="box_content">';
		html += '<div class="markdown-body doc-body" style="margin-top:0px; margin-bottom:15px;">';
		
		html += resp.html;
		
		html += '<p class="article_fin"><i class="mdi mdi-console-line"></i></p>';
		
		html += '</div>'; // markdown-body
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		
		window.scrollTo(0, this.scrollCache[ args.doc + '/' + args.anchor ] || 0);
		
		this.expandInlineImages();
		this.highlightCodeBlocks();
		this.fixDocumentLinks();
		this.setupHeaderLinks();
		this.wrapTables();
		
		setTimeout( function() {
			$('#fe_doc_search').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					var query = $('#fe_doc_search').val().trim();
					if (query.match(/\S/)) Nav.go('Docs/search/' + encodeURIComponent( query ));
				}
			} );
		}, 1 );
	}
	
	gosub(sub) {
		// go to sub-anchor (article section link), MIGHT be different doc tho
		// GOT HERE, in gosub: hosting/key-rotation
		var args = this.args;
		var [ doc, anchor ] = sub.split(/\//);
		if (!doc) doc = 'index';
		if (!anchor) anchor = '';
		
		this.scrollCache[ args.doc + '/' + args.anchor ] = this.lastScrollY;
		
		if (doc != args.doc) {
			// switch doc
			args.doc = doc;
			args.anchor = anchor;
			this.div.html( '' );
			this.loading();
			
			app.api.get( 'app/get_doc', args, this.receive_doc.bind(this), this.fullPageError.bind(this) );
			return;
		}
		
		// scroll to anchor on current page
		if (anchor) {
			if (args.doc == 'search') {
				args.anchor = anchor;
				this.div.html( '' );
				this.loading();
				app.api.get( 'app/get_doc', args, this.receive_doc.bind(this), this.fullPageError.bind(this) );
				return;
			}
			
			var $elem = this.div.find('div.markdown-body').find('#' + anchor);
			if ($elem.length) {
				$elem[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
				args.anchor = anchor;
			}
		}
	}
	
	setupHeaderLinks(elem) {
		// add links to article section headers
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		var { doc, anchor } = this.args;
		var pre_scrolled = this.scrollCache[ doc + '/' + anchor ];
		
		elem.find('div.markdown-body').find('h1, h2, h3, h4, h5, h6').each( function() {
			var $this = $(this);
			var id = $this.text().trim().replace(/\W+/g, '-').toLowerCase();
			$this.attr('id', id);
			$this.addClass('heading').prepend( '<a href="#Docs/' + doc + '/' + id + '" class="anchor"><i class="mdi mdi-link-variant"></i></a>' );
			if (anchor && (id == anchor) && !pre_scrolled) this.scrollIntoView(true);
		});
	}
	
	fixDocumentLinks(elem) {
		// fix all local links to point back to #Docs
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		var doc = this.args.doc;
		
		elem.find('div.markdown-body').find('a[href]').each( function() {
			var $this = $(this);
			var href = $this.attr('href');
			if (href.match(/^(\w+)\.md$/)) {
				// link to doc
				$this.attr('href', href.replace(/^(\w+)\.md$/, '#Docs/$1'));
			}
			else if (href.match(/^(\w+)\.md\#(\S+)$/)) {
				// link to section in specific doc
				$this.attr('href', href.replace(/^(\w+)\.md\#(\S+)$/, '#Docs/$1/$2'));
			}
			else if (href.match(/^\#([\w\-]+)$/) && doc) {
				// link to section in current doc
				$this.attr('href', href.replace(/^\#(\S+)$/, '#Docs/' + doc + '/$1') );
			}
		} );
	}
	
	expandInlineImages(elem) {
		// expand all inline image URLs on page
		// this is for markdown docs
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		var anchor = ('' + location.hash).replace(/\#/, '');
		var heading = null;
		if (anchor.match(/\/([\w\-]+)$/)) {
			var sub_anchor = RegExp.$1;
			heading = sub_anchor ? $('#' + sub_anchor).get(0) : null;
		}
		
		elem.find('div.markdown-body p img').each( function() {
			var $this = $(this);
			if (!$this.hasClass('inline_image')) {
				$this.addClass('inline_image').on('mouseup', function() { window.open(this.src); } ); // .attr('title', "Open image in new window.")
				if ($this.attr('title')) {
					$this.after( '<div class="caption">' + $this.attr('title') + '</div>' );
					$this.attr('title', '');
				}
			}
			if (heading) $this.on('load', function() {
				setTimeout( function() { heading.scrollIntoView(true); }, 100 );
			});
		});
	}
	
	highlightCodeBlocks(elem) {
		// highlight code blocks inside markdown doc
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		elem.find('div.markdown-body pre code').each( function() {
			var $this = $(this);
			var text = this.innerText;
			$this.data('raw', text);
			if (text.match(/^\s*\{[\S\s]+\}\s*$/)) this.classList.add('language-json');
			if (this.classList.length) hljs.highlightElement(this);
			$this.after(`<div class="copy_icon" title="Copy to Clipboard" onClick="$P().copyCode(this)"><i class="mdi mdi-clipboard-text-outline"></i></div>`);
		});
	}
	
	copyCode(elem) {
		// copy code block to clipboard
		var $code = $(elem).closest('pre').find('> code');
		copyToClipboard( $code.data('raw') );
		app.showMessage('info', "Code snippet copied to clipboard.");
	}
	
	wrapTables(elem) {
		// wrap all tables with DIVs with special class, for overflow
		var self = this;
		if (!elem) elem = this.div;
		else if (typeof(elem) == 'string') elem = $(elem);
		
		elem.find('div.markdown-body table').each( function() {
			$(this).wrap('<div class="table"></div>');
		});
	}
	
	loading() {
		// show loading indicator
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
	}
	
	tick() {
		// HACK: using this to track window.scrollY
		// FUTURE: find a better way to do this
		this.lastScrollY = window.scrollY;
	}
	
	onKeyDown(event) {
		// capture keydown if not focused in text field
		if (event.code == 'Slash') {
			event.preventDefault();
			event.stopPropagation();
			$('#fe_doc_search').focus();
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		delete this.scrollCache;
		return true;
	}
	
};
