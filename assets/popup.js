// JSHint options:
/* jshint esversion: 6 */

// JSLint options:
/*jslint browser, devel, white, for, long, unordered, single */

//
// Note: workaround for jslint
/*global chrome, $*/

var windowId = null;
var tabObj = null;

function updateTab(id, property, value) {
    var search = $('.highlight').attr('data-search');
    value = !value;
    chrome.tabs.update(id, {[property]: value});
    $('.highlight').data(property, value);

    if(value)
    {
        search += ' _'+ property;
    }
    else
    {
        var myregexp = new RegExp(' _'+ property, "ig");
        search = search.replace(myregexp, '');
    }
    search = $('.highlight').attr('data-search', search);
    $('.search').trigger('keyup');
}

function drawTabs() {
    $('#content').html('');
    chrome.windows.getAll({populate:true},function(windows){
        var windowsArray = [];
        windows.forEach(function(window){
            var winData = {id: window.id, incognito: window.incognito, tabs: []};
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

        var html = '';
        windowsArray.forEach(function(winData) {
            var windowId = winData.id;
            var incog = (winData.incognito ? ' incognito' : '');
            html += '<div class="window'+ incog +'" data-window-id="' + windowId +'">';
            html += '<div class="toggle"><img src="assets/trash.png" class="close_window" data-tab-count="'+ winData.tabs.length +'" data-window-id="' + windowId +'" alt="" /><span class="count">'+ winData.tabs.length +'</span> tabs</div><ul>';
            winData.tabs.forEach(function(tab) {
                var modifiers = '';
                modifiers += (tab.audio) ? ' _audio' : '';
                modifiers += (tab.muted) ? ' _muted' : '';
                modifiers += (tab.pinned) ? ' _pinned' : '';
                modifiers += (tab.highlighted) ? ' _highlighted' : '';
                modifiers += (tab.incognito) ? ' _incognito' : '';
                html += '<li class="tab'+ modifiers +'" data-window-id="'+ windowId +'" data-tab-id="'+ tab.id +'" data-muted="'+ tab.muted +'" data-pinned="'+ tab.pinned +'" data-search="'+ tab.title.toLowerCase() +' '+ tab.url.toLowerCase() + modifiers +'">'
                    + '<span class="icon"><span style="background-image:url('+ tab.icon +');"></span></span>'
                    + '<span class="title">'+ tab.title +'</span>'
                    + '<span class="url">'+ tab.url +'</span>'
                    + '<img src="assets/close.png" class="close_tab" data-tab-id="'+ tab.id +'" data-tab-name="'+ tab.title +'" alt="" />'
                    + '</li>';
            });
            html += '</ul></div>';
        });

        console.debug(`html: \n${html}\n`);
        $('#content').html(html);
    });
}
drawTabs();

function close_type(obj) {
    if(obj.type == 'tab') {
        chrome.tabs.get(obj.id, function callback() {
            if (chrome.runtime.lastError) {
                //console.log(chrome.runtime.lastError.message);
            } else {
                chrome.tabs.remove(obj.id);
            }
        });
    } else if (obj.type == 'window') {
        chrome.windows.get(obj.id, function callback() {
            if (chrome.runtime.lastError) {
                //console.log(chrome.runtime.lastError.message);
            } else {
                chrome.windows.remove(obj.id);
            }
        });
    }
}

function getTabs() { return $('li.tab:visible'); }

function highlightTab(next) {
    tabs = getTabs();
    index = tabs.index($('.highlight'));

    next_tab = index + next;
    if (next_tab < 0 || next_tab == tabs.length)
    {
        index = (index == -1) ? 0 : (next_tab == tabs.length) ? -1 : index;
    }
    $('.search').blur();
    $('.tab').removeClass('highlight');
    next_tab = index + next;

    $($('li.tab:visible').removeClass('highlight').get(next_tab)).addClass('highlight');

    if ($('.highlight').length)
        $('html, body').animate({ scrollTop: ($('.highlight').offset().top - 57) }, 0);
}

function focusTab(el) {
    if (el && el.data) {
        chrome.tabs.update(el.data('tab-id'), {selected: true});
        // OLD: chrome.windows.update(el.data('window-id'), {focused: true});
        try {
            chrome.windows.update(el.data('window-id'), {focused: true});
        }
        catch (exc) {
            console.warn("Exception in focusTab: " + exc);
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
        var val = $(this).val().toLowerCase();
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
    //console.log(e.keyCode);
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
        case 77: if($('.search:not(:focus)').length){ el=$('.highlight'); updateTab(el.data('tab-id'), 'muted', el.data('muted')); } break; //m - mute toggle tab
        case 80: if($('.search:not(:focus)').length){ el=$('.highlight'); updateTab(el.data('tab-id'), 'pinned', el.data('pinned')); } break; //p - pin toggle tab

        case 88: $('.js-modal-close, .modal-overlay').click(); break; //x - cancel
        case 191:
            e.preventDefault();
            if ($('#help:visible').length)
            { $('.js-modal-close, .modal-overlay').click(); }
            else
            {
                var appendthis =  ('<div class="modal-overlay modal-help js-modal-close"></div>');

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

    var appendthis =  ('<div class="modal-overlay js-modal-close"></div>');

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
        var data = $(this).data();
        close_type(data);
        if (data.type =='tab'){
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

        $(window).resize();
    });

    $(window).resize(function() {
        $('.modal-box').css({
            top: ($(window).height() - $('.modal-box').outerHeight()) / 2,
            left: ($(window).width() - $('.modal-box').outerWidth()) / 2
        });
    });
});
