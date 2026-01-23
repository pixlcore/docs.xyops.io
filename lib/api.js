// xyDocs API Layer
// Copyright (c) 2026 Joseph Huckaby

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");
const marked = require('marked');

const config = require('../config.json');

// setup marked
marked.use({ renderer: {
	
	link(href, title, text) {
		const titleAttr = title ? ` title="${title}"` : '';
		if (href.match(/^\w+\:\/\//)) return `<a href="${href}" target="_blank"${titleAttr}>${text}<i style="padding-left:3px" class="mdi mdi-open-in-new"></i></a>`;
		else return `<a href="${href}" ${titleAttr}>${text}</a>`;
	},
	
	checkbox(checked) {
		const icon = checked ? 'mdi-checkbox-marked-outline' : 'mdi-checkbox-blank-outline';
		return `<i class="mdi ${icon}" aria-hidden="true"></i>`;
	},
	
	blockquote: function(html) {
		html = html.trim().replace(/^<p>([\s\S]+)<\/p>$/, '$1');
		
		if (html.match(/^\[\!(\w+)\]\s*/)) {
			var type = RegExp.$1.toLowerCase();
			var title = Tools.ucfirst(type);
			var icons = { note: 'information-outline', tip: 'lightbulb-on-outline', important: 'alert-decagram', warning: 'alert-circle', caution: 'fire-alert' };
			var icon = icons[type];
			
			html = html.replace(/^\[\!(\w+)\]\s*/, '');
			return `<div class="blocknote ${type}"><div class="bn_title"><i class="mdi mdi-${icon}">&nbsp;</i>${title}</div><div class="bn_content">${html}</div></div>`;
		}
		else return `<blockquote>${html}</blockquote>`;
	}
	
} }); // marked.use

module.exports = {
	
	startup: function(callback) {
		callback();
	},
	
	handler: function(args, callback) {
		// handler for doc requests
		var uri = args.request.url.replace(/\?.*$/, '');
		
		if (uri.match(/\/api\/app\/(\w+)/)) {
			var func = 'api_' + RegExp.$1;
			if (!this[func]) return callback( "404 Not Found", {}, "Nope." );
			this[func](args, callback);
		}
		else {
			callback( "404 Not Found", {}, "Nope." );
		}
	},
	
	send_json_ttl_response(json, callback) {
		// send cacheable json response
		var payload = JSON.stringify(json);
		callback( "200 OK", { 'Content-Type': "application/json", 'Cache-Control': "public, max-age=3600" }, payload );
	},
	
	api_run(args, callback) {
		// bootstrap
		var payload = 'app.receiveConfig(' + JSON.stringify(config) + ');' + "\n";
		callback( "200 OK", { 'Content-Type': "text/javascript", 'Cache-Control': "public, max-age=3600" }, payload );
	},
	
	api_get_doc(args, callback) {
		// fetch raw markdown for doc
		var self = this;
		var params = args.query;
		
		if (!this.requireParams(params, {
			doc: /^\w+$/
		}, callback)) return;
		
		if (params.doc == 'search') {
			return this.api_search_docs(args, callback);
		}
		
		var file = Path.join( Path.dirname(__dirname), `docs`, `${params.doc}.md` );
		fs.readFile( file, 'utf8', function(err, text) {
			if (err) return callback({ code: 1, description: '' + err });
			
			// grab title from first level-1 header
			var re_first_header = /^\#\s+([^\n]+)\n/;
			text.match(re_first_header);
			var title = RegExp.$1 || 'No Title';
			text = text.replace(re_first_header, '').trim();
			
			// table of contents
			var toc = self.getTableOfContents(params, text);
			if (toc) text = `## Table of Contents\n\n` + toc + `\n` + text;
			
			var html = marked.parse(text, config.marked);
			
			self.send_json_ttl_response({ code: 0, title, html }, callback);
		} );
	},
	
	getTableOfContents(params, text) {
		// scan doc for headings
		if (['index', 'support'].includes(params.doc)) return '';
		var chapters = [];
		var min_indent = 99;
		var in_code_block = false;
		
		text.split(/\n/).forEach( function(line) {
			if (line.match(/^\`\`\`/)) in_code_block = !in_code_block;
			
			if (!in_code_block && line.match(/^(\#+)\s+(.+)$/)) {
				var hashes = RegExp.$1;
				var title = RegExp.$2;
				var id = title.trim().replace(/\W+/g, '-').toLowerCase();
				var indent = hashes.length;
				if (indent < min_indent) min_indent = indent;
				chapters.push({ id, title, indent });
			}
		} );
		
		if (chapters.length < 4) return '';
		
		var toc = '';
		chapters.forEach( function(item) {
			var tabs = '';
			var indent = item.indent - min_indent;
			if (indent) tabs = ("\t").repeat(indent);
			toc += `${tabs}- [${item.title}](#${item.id})\n`;
		} );
		
		return toc;
	},
	
	api_search_docs(args, callback) {
		// perform brute-force substring search across docs
		var self = this;
		var params = args.query;
		
		if (!this.requireParams(params, {
			anchor: /.+/
		}, callback)) return;
		
		if (!params.limit) params.limit = 100;
		
		try { params.anchor = decodeURIComponent(params.anchor); }
		catch (err) { return callback({ code: 1, description: "Invalid search query." }); }
		
		params.anchor = params.anchor.toString().replace(/<[^>]*>/g, '');
		if (!params.anchor.match(/\S/)) {
			return callback({ code: 1, description: "Invalid search query." });
		}
		
		var lower_query = params.anchor.toLowerCase();
		var matches = [];
		
		Tools.glob( Path.join( Path.dirname(__dirname), 'docs', '*.md'), function(err, files) {
			if (err) return callback({ code: 1, description: '' + err });
			
			async.eachSeries( files,
				function(file, callback) {
					// process file
					var doc_id = Path.basename(file).replace(/\.\w+$/, '');
					
					fs.readFile( file, 'utf8', function(err, text) {
						if (err) return callback(err);
						
						// grab title from first level-1 header
						if (!text.match(/^\#\s+([^\n]+)/)) return callback();
						var title = RegExp.$1;
						var in_code_block = false;
						var last_title = '';
						var last_anchor = '';
						var lines = text.trim().split(/\n/);
						lines.shift(); // exclude title from search results
						
						lines.forEach( function(line) { 
							if (line.match(/^\`\`\`/)) in_code_block = !in_code_block;
							
							var in_heading = false;
							if (!in_code_block && line.match(/^(\#+)\s+(.+)$/)) {
								last_title = RegExp.$2;
								last_anchor = last_title.trim().replace(/\W+/g, '-').toLowerCase();
								in_heading = true;
							}
							
							var idx = line.toLowerCase().indexOf(lower_query);
							if (idx > -1) {
								var href = '#Docs/' + doc_id;
								if (last_anchor) href += '/' + last_anchor;
								matches.push({ 
									doc: doc_id, 
									title, line, idx, 
									code: in_code_block, 
									section: last_title, 
									anchor: last_anchor,
									heading: in_heading,
									href
								});
							}
						} );
						
						if (matches.length >= params.limit) callback("STOP");
						else callback();
					} ); // fs.readFile
				},
				function(err) {
					// format results as markdown
					var more = (err === 'STOP') ? '+' : '';
					var text = '';
					text += `# Search Results\n\n`;
					
					if (!matches.length) {
						text += `No results found for &ldquo;${params.anchor}&rdquo;.  Please try a different search query.`;
						return self.send_json_ttl_response({ code: 0, text }, callback);
					}
					
					text += `## ${Tools.commify(matches.length)}${more} ${Tools.pluralize('result', matches.length)} for &ldquo;${params.anchor}&rdquo;:\n`;
					
					var last_href = '';
					
					matches.forEach( function(match) {
						if (match.href != last_href) {
							last_href = match.href;
							text += `\n- **[${match.title}](#Docs/${match.doc})**`;
							if (match.anchor) text += ` → **[${match.section}](${match.href})**`;
							text += "\n";
						}
						
						// if search matched a heading, do not include a preview
						if (match.heading) return;
						
						// cleanup and sanitization
						match.line = match.line.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
						if (match.code) match.line = '<code>' + match.line.replace(/\`/g, '') + '</code>';
						
						var preview = match.line.replace(/^\s*(\-|\d+\.|\#+)\s+/, '').trim();
						text += `\t- ${preview}\n`;
					} );
					
					if (more) {
						text += `\n*(Additional matches were chopped.)*`;
					}
					
					var html = marked.parse(text, config.marked);
					self.send_json_ttl_response({ code: 0, html, title: "Search Results" }, callback);
				}
			); // eachSeries
		} ); // glob
	},
	
	requireParams(params, rules, callback) {
		// validate params against set of regexp rules
		assert( arguments.length == 3, "Wrong number of arguments to requireParams" );
		
		for (var key in rules) {
			var rule = rules[key];
			if (typeof(params[key]) == 'undefined') {
				return this.doError('api', "Missing parameter: " + key, callback);
			}
			if (rule === 'array') {
				if (!Tools.isaArray(params[key])) {
					return this.doError('api', "Parameter is not an array: " + key, callback);
				}
			}
			else if (typeof(rule) == 'string') {
				if (typeof(params[key]) != rule) {
					return this.doError('api', "Parameter is not type " + rule + ": " + key, callback);
				}
			}
			else if (!(''+params[key]).match(rule)) {
				return this.doError('api', "Malformed parameter: " + key, callback);
			}
		}
		
		return true;
	},
	
	shutdown: function(callback) {
		callback();
	}
	
};
