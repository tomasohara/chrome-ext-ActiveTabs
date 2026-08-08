// Form support for Active-Tabs chrome extension
//
// note:
// - The display now uses a full page, so popup[.js] is a misnomer.
// - UPDATE 04 July 2026: Reworked change comments
// - Change facilitated by Antigravity AI Assistant using model Gemini 3.1 Pro
// - Fixed TypeError in focusTab by parsing IDs as integers.
// - Removed jQuery resize modal positioning logic to rely on modern CSS.
// - Change via Gemini to sort the tabs, use full window, are position modal.
// - ESLint lint-clean pass (var->const/let, ===, declared leaked vars) via Claude Opus 4.8 (July 2026)
// - Robustness pass via Claude Sonnet 5 (July 2026): guarded mute/pin (m/p) against
//   an empty highlighted selection, escaped tab titles/urls before building HTML,
//   handled lastError on tabs/windows update|remove calls to stop "Uncaught (in
//   promise) Error: No tab with id: ..." from stale ids, and synced the row's
//   _muted/_pinned class + data attrs live so the mute/pin indicators update
//   immediately instead of only after the next redraw.
// - Trace-level logging pass via Claude Code / Claude Opus 5 (July 2026): logging
//   now goes through assets/debug.js (see its header for the level scheme and for
//   changing the level at runtime). This re-enables the previously commented-out
//   traces at levels that keep them out of the default console view, and fixes
//   the focusTab trace, which stringified jQuery's .data *method* rather than the
//   tab/window ids it was meant to report.
//
//

// JSHint options:
/* jshint esversion: 6, browser: true, devel: true */

// JSLint options:
/*jslint browser, devel, node, trace, beta, bitwise, convert, eval, fart, for, getset, indent2, nomen, single, subscript, long, this, unordered, variable, white */
// Note: workaround for jslint
// OLD: /*global chrome, console*/
// 'console' dropped: all output now goes through debug.trace (assets/debug.js),
// which owns the console calls, so declaring it here just draws a no-unused-vars
// warning.
/*global chrome, debug*/

// OLD:
// var windowId = null;
// var tabObj = null;

function updateTab(id, property, value) {
    let search = $('.highlight').attr('data-search');
    value = !value;
    // BAD: chrome.tabs.update(id, {...}) with no callback returns a Promise
    //      (MV3); with nothing chaining .catch() on it, a stale id (the
    //      highlighted tab was closed elsewhere since the list was rendered)
    //      surfaced as "Uncaught (in promise) Error: No tab with id: ...".
    //      Pass a callback instead so a missing tab just logs via lastError,
    //      matching the pattern in focusTab()/close_type().
    debug.trace(debug.DETAILED, `updateTab: id=${id} ${property}=${value}`);
    chrome.tabs.update(id, {[property]: value}, function() {
        if (chrome.runtime.lastError) {
            // OLD: console.warn("updateTab: tabs.update failed: " + chrome.runtime.lastError.message);
            debug.trace(debug.WARNING, "updateTab: tabs.update failed: " + chrome.runtime.lastError.message);
        }
    });
    $('.highlight').data(property, value);
    // BAD: only the jQuery data cache above was updated, so the row's
    //      '_muted'/'_pinned' class and data-<property> attribute stayed
    //      stale until the next drawTabs() redraw -- meaning the mute/pin
    //      icons (CSS rules keyed off those classes) didn't update until the
    //      popup was reopened. Keep the DOM in sync immediately instead.
    $('.highlight').toggleClass('_' + property, value);
    $('.highlight').attr('data-' + property, value);

    if(value)
    {
        search += ' _'+ property;
    }
    else
    {
        const myregexp = new RegExp(' _'+ property, "ig");
        search = search.replace(myregexp, '');
    }
    // OLD: search = $('.highlight').attr('data-search', search);
    $('.highlight').attr('data-search', search);
    $('.search').trigger('keyup');
}

// Tab titles/URLs come from arbitrary web pages, not from us. Escaping them
// before they're concatenated into the HTML string below prevents a stray
// '"' or '<' in a page title from breaking out of an attribute/tag and
// corrupting the rendered row (drawTabs built the markup via raw string
// concatenation, so nothing else was escaping this).
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function(ch) {
        return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch];
    });
}

function drawTabs() {
    $('#content').html('');
    chrome.windows.getAll({populate:true},function(windows){
        const windowsArray = [];
        windows.forEach(function(window){
            const winData = {id: window.id, incognito: window.incognito, tabs: []};
            window.tabs.forEach(function(tab){
                winData.tabs.push({
                    id: tab.id,
                    title: tab.title,
                    url: tab.url,
                    icon: tab.favIconUrl,
                    audio: tab.audible,
                    muted: tab.mutedInfo.muted,
                    pinned: tab.pinned,
                    highlighted: tab.highlighted,
                    incognito: tab.incognito
                });
            });
            windowsArray.push(winData);
        });

        // Sort windows: multiple tabs first, then by number of tabs descending
        windowsArray.sort(function(a, b) {
            if (a.tabs.length > 1 && b.tabs.length <= 1) {
                return -1;
            }
            if (a.tabs.length <= 1 && b.tabs.length > 1) {
                return 1;
            }
            return b.tabs.length - a.tabs.length;
        });

        let html = '';
        windowsArray.forEach(function(winData) {
            const windowId = winData.id;
            const incog = (winData.incognito ? ' incognito' : '');
            html += '<div class="window'+ incog +'" data-window-id="' + windowId +'">';
            html += '<div class="toggle"><img src="assets/trash.png" class="close_window" data-tab-count="'+ winData.tabs.length +'" data-window-id="' + windowId +'" alt="" /><span class="count">'+ winData.tabs.length +'</span> tabs</div><ul>';
            winData.tabs.forEach(function(tab) {
                let modifiers = '';
                modifiers += (tab.audio) ? ' _audio' : '';
                modifiers += (tab.muted) ? ' _muted' : '';
                modifiers += (tab.pinned) ? ' _pinned' : '';
                modifiers += (tab.highlighted) ? ' _highlighted' : '';
                modifiers += (tab.incognito) ? ' _incognito' : '';
                // BAD: 'background-image:url('+ tab.icon +')' emitted url(undefined)
                //      when a tab had no favIconUrl, so the browser requested a file
                //      named "undefined" and logged net::ERR_FILE_NOT_FOUND. Only set
                //      the background-image when there is an actual icon URL.
                const iconStyle = tab.icon ? ' style="background-image:url('+ tab.icon +');"' : '';
                const safeTitle = escapeHtml(tab.title);
                const safeUrl = escapeHtml(tab.url);
                html += '<li class="tab'+ modifiers +'" data-window-id="'+ windowId +'" data-tab-id="'+ tab.id +'" data-muted="'+ tab.muted +'" data-pinned="'+ tab.pinned +'" data-search="'+ safeTitle.toLowerCase() +' '+ safeUrl.toLowerCase() + modifiers +'">'
                    + '<span class="icon"><span'+ iconStyle +'></span></span>'
                    + '<span class="title">'+ safeTitle +'</span>'
                    + '<span class="url">'+ safeUrl +'</span>'
                    + '<img src="assets/close.png" class="close_tab" data-tab-id="'+ tab.id +'" data-tab-name="'+ safeTitle +'" alt="" />'
                    + '</li>';
            });
            html += '</ul></div>';
        });

        // OLD: // DEBUG: console.debug(`html: \n${html}\n`);
        // Re-enabled at VERBOSE: once per popup open, and the (large) markup dump
        // is built lazily, so it costs nothing until the level is raised.
        debug.trace(debug.VERBOSE, () => `html: \n${html}\n`);
        debug.trace(debug.DETAILED, `drawTabs: ${windowsArray.length} windows, ${windowsArray.reduce((n, w) => n + w.tabs.length, 0)} tabs`);
        $('#content').html(html);
    });
}
drawTabs();

function close_type(obj) {
    if(obj.type === 'tab') {
        chrome.tabs.get(obj.id, function callback() {
            if (chrome.runtime.lastError) {
                // OLD: //console.log(chrome.runtime.lastError.message);
                // OLD: console.log("lastError:" + chrome.runtime.lastError.message);
                debug.trace(debug.WARNING, "close_type: tabs.get lastError: " + chrome.runtime.lastError.message);
            } else {
                // Same "no callback -> implicit Promise -> unhandled rejection"
                // risk as updateTab(): the tab can still close in the gap
                // between this get() check and remove(), so pass a callback.
                chrome.tabs.remove(obj.id, function() {
                    if (chrome.runtime.lastError) {
                        // OLD: console.warn("close_type: tabs.remove failed: " + chrome.runtime.lastError.message);
                        debug.trace(debug.WARNING, "close_type: tabs.remove failed: " + chrome.runtime.lastError.message);
                    }
                });
            }
        });
    } else if (obj.type === 'window') {
        chrome.windows.get(obj.id, function callback() {
            if (chrome.runtime.lastError) {
                // OLD: //console.log(chrome.runtime.lastError.message);
                // OLD: console.log("lastError:" + chrome.runtime.lastError.message);
                debug.trace(debug.WARNING, "close_type: windows.get lastError: " + chrome.runtime.lastError.message);
            } else {
                chrome.windows.remove(obj.id, function() {
                    if (chrome.runtime.lastError) {
                        // OLD: console.warn("close_type: windows.remove failed: " + chrome.runtime.lastError.message);
                        debug.trace(debug.WARNING, "close_type: windows.remove failed: " + chrome.runtime.lastError.message);
                    }
                });
            }
        });
    }
}

function getTabs() { return $('li.tab:visible'); }

function highlightTab(next) {
    // OLD: tabs / index / next_tab were assigned without declaration (leaked globals).
    const tabs = getTabs();
    let index = tabs.index($('.highlight'));

    let next_tab = index + next;
    if (next_tab < 0 || next_tab === tabs.length)
    {
        index = (index === -1) ? 0 : (next_tab === tabs.length) ? -1 : index;
    }
    $('.search').blur();
    $('.tab').removeClass('highlight');
    next_tab = index + next;

    $($('li.tab:visible').removeClass('highlight').get(next_tab)).addClass('highlight');

    if ($('.highlight').length)
        $('html, body').animate({ scrollTop: ($('.highlight').offset().top - 57) }, 0);
}

function focusTab(el) {
    // BAD: 'el && el.data' was always truthy for a jQuery object -- '.data' is the
    //      jQuery method, which exists even on an empty selection. An empty set
    //      (e.g. Enter with no highlighted tab) then fell through to
    //      tabs.update(NaN, ...) and threw a "No matching signature" TypeError.
    //      Require a non-empty selection instead.
    if (el && el.length) {
        // BAD: console.debug("focusTab: el.data=" + el.data);
        //      '.data' is jQuery's accessor *method*, so this concatenated the
        //      function's source text instead of the row's data -- the ids the
        //      trace was meant to report never appeared. Read them instead.
        debug.trace(debug.DETAILED, () => `focusTab: tab-id=${el.data('tab-id')} window-id=${el.data('window-id')}`);
        // Guarantee we pass a strict integer to the Chrome API, preventing a signature mismatch TypeError.
        // note: 'selected' is deprecated in favor of 'active'
        const tabId = parseInt(el.data('tab-id'), 10);
        // BAD: chrome.tabs.update(el.data('tab-id'), {selected: true});
        // Skip the call when the id is missing/invalid (NaN) rather than throwing.
        if (Number.isInteger(tabId)) {
            // The tab list can go stale (e.g. closed elsewhere) between render and
            // click; check lastError the same way close_type() does so a missing
            // tab just logs instead of leaving an "Unchecked runtime.lastError".
            chrome.tabs.update(tabId, {active: true}, function() {
                if (chrome.runtime.lastError) {
                    // OLD: console.warn("focusTab: tabs.update failed: " + chrome.runtime.lastError.message);
                    debug.trace(debug.WARNING, "focusTab: tabs.update failed: " + chrome.runtime.lastError.message);
                }
            });
        }
        // OLD: chrome.windows.update(el.data('window-id'), {focused: true});
        try {
            // Guarantee we pass a strict integer for the windowId to avoid throwing a type mismatch exception.
            // BAD: chrome.windows.update(el.data('window-id'), {focused: true});
            const windowId = parseInt(el.data('window-id'), 10);
            if (Number.isInteger(windowId)) {
                chrome.windows.update(windowId, {focused: true}, function() {
                    if (chrome.runtime.lastError) {
                        // OLD: console.warn("focusTab: windows.update failed: " + chrome.runtime.lastError.message);
                        debug.trace(debug.WARNING, "focusTab: windows.update failed: " + chrome.runtime.lastError.message);
                    } else if (debug.getLevel() >= debug.VERBOSE) {
                        // A successful call only means Chrome accepted the request;
                        // the window manager can still decline to raise the window,
                        // and that denial sets no lastError. Re-reading `focused`
                        // shortly after distinguishes "Chrome refused" from "the WM
                        // ignored it". Gated on the level since it costs an extra
                        // API round-trip per click.
                        setTimeout(function() {
                            chrome.windows.get(windowId, function(win) {
                                if (chrome.runtime.lastError) {
                                    debug.trace(debug.VERBOSE, "focusTab: windows.get probe failed: " + chrome.runtime.lastError.message);
                                } else {
                                    debug.trace(debug.VERBOSE, `focusTab: post-check window ${windowId} focused=${win && win.focused}`);
                                }
                            });
                        }, 250);
                    }
                });
            }
        }
        catch (exc) {
            // OLD: console.warn("Exception in focusTab: " + exc);
            debug.trace(debug.ERROR, "Exception in focusTab: " + exc);
            // BAD: console.warn("el.data: " + JSON.stringify(el.data));
            //      Same '.data'-is-a-method confusion as above; JSON.stringify of
            //      a function yields undefined, so this line reported nothing.
            debug.trace(debug.VERBOSE, () => "focusTab row data: " + JSON.stringify(el.data()));
        }
    }
}

$('body').on('click', '.toggle', function(e){
    if (e.target.className !== 'close_window')
        $(this).next().toggle();
});

$('body').on('click', '.tab', function(e){
    if (!$(e.target).hasClass('close_tab'))
    {
        focusTab($(this));
    }
});

$('body').on('click', '.help_tab', function(e){
    $('.help_tab').removeClass('active');
    $('.help_tabs').css('display', 'none');
    $(this).addClass('active');
    $('#help_tab_'+ $(this).data('tab')).css('display', 'initial');
});

$('.expand').on('click', function(){ $('.window ul').show(); });
$('.collapse').on('click', function(){ $('.window ul').hide(); });

$('.search').on('keyup', function(){
    if($(this).val() !== '') {
        $('#content').addClass('filtered');
        const val = $(this).val().toLowerCase();
        $(':not(li.tab[data-search*="'+ val +'"])').addClass('hide');
        $('.tab[data-search*="'+ val +'"]').removeClass('hide');
    } else {
        $('#content').removeClass('filtered');
        $('.tab').removeClass('hide');
    }
}).on('focus', function(){
    $('.tab').removeClass('highlight');
});

$('body').on('keydown', function(e){
    // Highlighted-tab element, set by the mute/pin cases below (was a leaked global).
    let el;
    // OLD: //console.log(e.keyCode);
    // OLD: // DEBUG: console.log("keyCode:" + e.keyCode);
    // Re-enabled at QUITE_DETAILED: fires on every keystroke (including each
    // character typed into the search box), so it must stay well above the
    // default level -- as plain console.log it flooded the default view.
    debug.trace(debug.QUITE_DETAILED, "keyCode:" + e.keyCode);
    $('#help .js-modal-close, .modal-overlay').click();
    if($.inArray(e.keyCode, [13, 38, 40, 67, 77, 80, 83, 88, 191]) !== -1) {
        switch(e.keyCode) {
        case 13:
            if ($('.js-modal-confirm:visible').length)
            {
                $('.js-modal-confirm').click();
            } else {
                focusTab($('.tab.highlight'));
            }
            break; //enter
        case 38: highlightTab(-1); break; //arrow up
        case 40: highlightTab(1); break; //arrow down
        case 83: if($('.search:not(:focus)').length){e.preventDefault();$('.tab').removeClass('highlight');} $('.search').focus(); break; //s - jump to search

        case 67: if($('.search:not(:focus)').length){ $('.tab.highlight .close_tab').click(); } break; //c - close tab
        // BAD: calling updateTab() unconditionally on an empty '.highlight' selection
        //      passed id=undefined through to chrome.tabs.update(), which silently
        //      acted on the current tab (the extension's own page) instead of doing
        //      nothing -- the same missing-guard bug fixed in focusTab(), just
        //      failing silently instead of throwing. Require a non-empty selection.
        case 77: if($('.search:not(:focus)').length){ el=$('.highlight'); if (el.length) { updateTab(el.data('tab-id'), 'muted', el.data('muted')); } } break; //m - mute toggle tab
        case 80: if($('.search:not(:focus)').length){ el=$('.highlight'); if (el.length) { updateTab(el.data('tab-id'), 'pinned', el.data('pinned')); } } break; //p - pin toggle tab

        case 88: $('.js-modal-close, .modal-overlay').click(); break; //x - cancel
        case 191:
            e.preventDefault();
            if ($('#help:visible').length)
            { $('.js-modal-close, .modal-overlay').click(); }
            else
            {
                const appendthis =  ('<div class="modal-overlay modal-help js-modal-close"></div>');

                $('body').append(appendthis);
                $('body').addClass('modal help-modal');
                $('.modal-overlay').fadeTo(500, 0.7);
                $('#help').fadeIn($(this).data());
            }
            break; //? - help
        }
    }
});

$('body').on('click', '#help_tab_keywords th', function(){
    $('.search').val($(this).text()).trigger('keyup');
    $('.js-modal-close, .modal-overlay').click();
});

/*********************** MODAL */
$(function(){
    $('.search').focus();

    const appendthis =  ('<div class="modal-overlay js-modal-close"></div>');

    $('body').on('click', '.close_tab', function(e){
        $('body').append(appendthis);
        $('body').addClass('modal');
        $('.modal-overlay').fadeTo(500, 0.7);
        $('#name').text($(this).data('tab-name'));
        $('#type').text('Tab');
        $('.js-modal-confirm').data({type:'tab', id:$(this).data('tab-id')});
        $('#confirm').fadeIn($(this).data());
    });

    $('body').on('click', '.close_window', function(e){
        $('body').append(appendthis);
        $('body').addClass('modal');
        $('.modal-overlay').fadeTo(500, 0.7);
        $('#name').text('Window with '+ $(this).data('tab-count') +' tabs open.');
        $('#type').text('Window');
        $('.js-modal-confirm').data({type:'window', id:$(this).data('window-id')});
        $('#confirm').fadeIn($(this).data());
    });


    $('.js-modal-close, .modal-overlay').click(function() {
        $('.modal-box, .modal-overlay').fadeOut(500, function() {
            $('.modal-overlay').remove();
            $('body').removeClass('modal help-modal');
        });
    });

    $('.js-modal-confirm').click(function() {
        const data = $(this).data();
        close_type(data);
        if (data.type ==='tab'){
            $('.tab[data-tab-id="'+ data.id +'"]').parent().prev().find('.count').text(
                parseInt($('.tab[data-tab-id="'+ data.id +'"]').parent().prev().find('.count').text()) - 1
            );

            $('.tab[data-tab-id="'+ data.id +'"]').remove();
        } else {
            $('.window[data-window-id="'+ data.id +'"]').remove();
        }

        $('.modal-box, .modal-overlay').fadeOut(500, function() {
            $('.modal-overlay').remove();
        });

        // Rely completely on CSS for dynamic viewport centering rather than manual calculation.
        // OLD: $(window).resize();
    });

    // Remove JS-based centering; CSS transforms in .modal-box now robustly handle responsive positioning.
    // OLD: $(window).resize(function() {
    // OLD:     $('.modal-box').css({
    // OLD:         top: ($(window).height() - $('.modal-box').outerHeight()) / 2,
    // OLD:         left: ($(window).width() - $('.modal-box').outerWidth()) / 2
    // OLD:     });
    // OLD: });
});
