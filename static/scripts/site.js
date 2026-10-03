// Global js namespace for site functions
var site_functions = (function() {

// UI version number
var UI_VERSION = "v0.3.4";

// Debug flag for API URL
var DEBUG = false;

// API connection parameters
if (DEBUG){
    var API_ADDRESS = 'localhost';
    var API_PORT = '8000';
    var API_URL = 'http://'+API_ADDRESS+':'+API_PORT+'/api';
} else {
    var API_ADDRESS = 'www.c6redux.au';
    var API_PORT = '443';
    var API_URL = 'https://'+API_ADDRESS+':'+API_PORT+'/api';
}

function load_comments_page() {
    $('#site-body > div').not('#site-content-comments').hide();
    $('#site-content-comments').show();
    $('#comments-page-status').text('');
    $('#comments-sign-in-prompt, #comments-form, #admin-comments-section').hide();
    $('#admin-comments-list').empty();

    const token = window.sessionStorage.getItem('auth_token');
    if (!token) {
        $('#comments-sign-in-prompt').show();
        return;
    }
    $.ajax({
        type: 'GET',
        url: site_functions.API_URL + '/auth/me',
        headers: {Authorization: 'Bearer ' + token},
        success: function(user) {
            CURRENT_AUTH_USER = user;
            $('#comments-form').show();
            if (user.admin) {
                $('#admin-comments-section').show();
                $.ajax({
                    type: 'GET',
                    url: site_functions.API_URL + '/comments/',
                    headers: {Authorization: 'Bearer ' + token},
                    success: function(comments) {
                        comments.forEach(function(comment) {
                            const row = $('<tr>');
                            $('<td>').text(comment.username).appendTo(row);
                            $('<td>').text(comment.comment).appendTo(row);
                            $('<td>').text(new Date(comment.created_at).toLocaleString()).appendTo(row);
                            $('#admin-comments-list').append(row);
                        });
                        if (comments.length === 0) {
                            $('#admin-comments-list').append(
                                $('<tr>').append($('<td>').attr('colspan', 3).text('No comments yet.'))
                            );
                        }
                    },
                    error: function() {
                        $('#comments-page-status').text('Unable to load submitted comments.');
                    }
                });
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.sessionStorage.removeItem('auth_token');
                $('#site-login-button').text('Log in');
                $('#comments-sign-in-prompt').show();
            } else {
                $('#comments-page-status').text('Unable to verify sign-in status.');
            }
        }
    });
}

// Content request used to click through tabs when passing message through site
let CONTENT_REQUEST = null;

// Website structure is known so that passed message can follow shortest path
let CONTENT_TREE = {
    root: {
        screens: {
            screen_explorer: {},
            screen_maker: {},
            selected_wells: {}
        },
        stocks: {},
        chemicals: {
            chemical_list: {},
            phcurves: {}
        },
        recipes: {}
    }
}

// Selected conditions are a global site phenomenon (mostly since recipes and screens both use it)
let SELECTED_WELLS = [];
let CURRENT_AUTH_USER = null;

// ========================================================================== //
// Publicly accessible functions go here (note script needs to be loaded for them to be available)
// ========================================================================== //

var public_functions = {};

// Connection parameters
public_functions.API_URL = API_URL;

// All units
public_functions.ALL_UNITS = [
    'M',
    'v/v',
    'w/v',
    'mM',
    'mg/ml'
];

// Difference in pH considered the same
public_functions.PH_MIN_DIFF = 1.2;

// Message passing between dynamically loaded pages
public_functions.CONTENT_PROVIDERS = {};

// Functions for managing selected screen wells (titled: selected conditions)
public_functions.get_selected_wells = function(){
    return SELECTED_WELLS;
}
public_functions.add_selected_well = function(well){
    SELECTED_WELLS.push(well);
    window.dispatchEvent(new CustomEvent("SelectedWellChange"));
    return;
}
public_functions.remove_selected_well = function(well){
    let TEMP_SELECTED_WELLS = []
    for (i in SELECTED_WELLS){
        if (SELECTED_WELLS[i].well.id != well.well.id){
            TEMP_SELECTED_WELLS.push(SELECTED_WELLS[i]);
        }
        else if (well.select_button_dom_element !== undefined) {
            // For wells which are being removed change their selection status on the screen explorer page
            well.select_button_dom_element.removeClass('delete-button');
            well.select_button_dom_element.text('Select');
            well.select_button_dom_element.addClass('select-button');
        }
    }
    SELECTED_WELLS = TEMP_SELECTED_WELLS

    window.dispatchEvent(new CustomEvent("SelectedWellChange"));
    return;
}
public_functions.remove_selected_well_by_screen = function(well){
    let TEMP_SELECTED_WELLS = [];
    for (i in SELECTED_WELLS){
        if (SELECTED_WELLS[i].screen_name != well.screen_name){
            // Keep track of wells which arent being removed
            TEMP_SELECTED_WELLS.push(SELECTED_WELLS[i]);
        }
        else if (well.select_button_dom_element !== undefined) {
            // For wells which are being removed change their selection status on the screen explorer page
            well.select_button_dom_element.removeClass('delete-button');
            well.select_button_dom_element.text('Select');
            well.select_button_dom_element.addClass('select-button');
        }
    }
    SELECTED_WELLS = TEMP_SELECTED_WELLS;

    window.dispatchEvent(new CustomEvent("SelectedWellChange"));
    return;
}
// TODO make work with the "SelectedWellChange" event
public_functions.clear_selected_wells = function() {
    SELECTED_WELLS = [];
    return;
}

// Function that allows setting up of subpage buttons. Handles message propagation for already loaded pages
public_functions.init_subpage_buttons = function(parent_content_name, subpages){
    // Add subpages for message passing structure
    let path = find_path_to_provider(parent_content_name);
    let content_tree_parent = path[path.length - 1];

    // Loop the subpages
    $.each(subpages, function(i, subpage){

        // Store buttons for message passing requests
        content_tree_parent[subpage.content_name].button = $('#'+subpage.button_id);

        // Create click event handler on the button
        $('#'+subpage.button_id).click(function(){
            $('#site-content-comments').hide();

            // Disabled button and enable content
            $('#'+subpage.content_id).css("display", "block");
            $('#'+subpage.button_id).attr('disabled','disabled');

            // Loop other subpages, disable content and and enable buttons
            $.each(subpages, function(j, other_subpage){
                if (i != j){
                    $('#'+other_subpage.content_id).css("display", "none");
                    $('#'+other_subpage.button_id).removeAttr('disabled');
                }
            });

            // If the content is empty, load it from the html (will only happen once)
            if ($('#'+subpage.content_id).children().length == 0){
                // TODO Ideally propage message as below after load - but callback fired before document.ready in subscripts
                $('#'+subpage.content_id).load(subpage.content_html);
            // Otherwise content already loaded, check and propagate any message passing request
            } else {
                if (CONTENT_REQUEST){
                    public_functions.request_content(CONTENT_REQUEST.provider, CONTENT_REQUEST.method, CONTENT_REQUEST.params);
                }
            }
        });

        // Click the subpage button that should be clicked on initialisation if not propagating message passing request
        if (!CONTENT_REQUEST && subpage.click_on_init){
            $('#'+subpage.button_id).click();
        }
    });
}

// Authentication
public_functions.authorise_action = function(msg, action_needing_token){
    // No token or a message, require user to login
    if (!window.sessionStorage.getItem('auth_token') || msg){
        // Remove old token if present and display message is present
        window.sessionStorage.removeItem('auth_token');
        if (msg) {
            $('#login-error-message').text(msg);
        }
        // Display login dialog
        $("#login-popup").css("display", "block");
        $('#site-popup-container').show();
        // Make submit action perform callback with token after sucessful login
        $('#login-submit-button').off("click");
        $('#login-submit-button').click(function() {
            $.ajax({
                type: 'POST',
                url: site_functions.API_URL+'/auth/token', 
                data: $('#login-form').serialize(), 
                success: function(token) {
                    // Save token, perform action and hide login
                    window.sessionStorage.setItem('auth_token', token.access_token);
                    $('#site-login-button').text('Log out');
                    action_needing_token(window.sessionStorage.getItem('auth_token'));
                    $('#login-cancel-button').click();
                },
                error: function(xhr, status, error) {
                    // Display error
                    $('#login-error-message').text("Error: " + error);
                }
            });
        });
    // Token present and no message, perform action with existing token
    } else {
        action_needing_token(window.sessionStorage.getItem('auth_token'));
    }
}

// Confirmation popup
public_functions.confirm_action = function(msg, action){
    // Display message
    $('#confirmation-message').text(msg);
    $("#confirmation-popup").css("display", "block");
    $('#site-popup-container').show();
    // Make accept perform callback action before calcelling the dialog
    $('#confirmation-accept-button').off("click");
    $('#confirmation-accept-button').click(function() {
        action();
        $('#confirmation-cancel-button').click();
    });
}

// Alert popup
public_functions.alert_user = function(msg){
    // Display message
    $('#information-message').text(msg);
    $("#information-popup").css("display", "block");
    $('#site-popup-container').show();
}

// Pass parameters to provider if loaded, otherwise save request and click through
public_functions.request_content = function(provider, method, params){
    // First call, create content request and begin walking down path of buttons
    if (!CONTENT_REQUEST){
        let path = find_path_to_provider(provider).slice(2);
        CONTENT_REQUEST = {path: path.slice(1), provider: provider, method: method, params: params};
        path[0].button.click();
    // No more buttons
    } else if (CONTENT_REQUEST.path.length == 0){
        // Reset request
        CONTENT_REQUEST = null;
        // If at final page and method exists, perform it
        if (site_functions.CONTENT_PROVIDERS[provider] && site_functions.CONTENT_PROVIDERS[provider][method]){
            site_functions.CONTENT_PROVIDERS[provider][method](params);
        // If at final page and there is no method, request was simply to change tab, do nothing
        } else if (site_functions.CONTENT_PROVIDERS[provider] && method === null){
            return;
        // Otherwise there is an error
        } else {
            site_functions.alert_user("Error performing action. Try doing it manually.");
        }
    // Normal operation continues down path of buttons
    } else {
        let button = CONTENT_REQUEST.path[0].button;
        CONTENT_REQUEST.path = CONTENT_REQUEST.path.slice(1);
        button.click();
    }
}

// Propagate message passing request if there is one, useful on initial load for dynamic pages that aren't clicked
public_functions.propagate_message_passing = function(){
    if (CONTENT_REQUEST){
        public_functions.request_content(CONTENT_REQUEST.provider, CONTENT_REQUEST.method, CONTENT_REQUEST.params);
    }
}

// ========================================================================== //
// Private functions
// ========================================================================== //

// Wrapper for getting click path when request content across site
function find_path_to_provider(provider){
    let path = [];
    return find_path_to_provider_rec(path, CONTENT_TREE, provider);
}

// Recurse into site structure to get click path
function find_path_to_provider_rec(path, parent, provider){
    // Found provider
    if (parent[provider]){
        return path.concat([parent, parent[provider]]);
    // Otherwise search
    } else {
        // Search each child until one finds path
        for (i in parent){
            // Ignore added button property
            if (i == 'button'){
                continue;
            }
            // Return if found path
            let p = find_path_to_provider_rec(path.concat([parent]), parent[i], provider);
            if (p){
                return p;
            }
        }
        // Nulls when path not found
        return null;
    }
}

// ========================================================================== //
// Actions to perform once document is ready (e.g. event handlers)
// ========================================================================== //

$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    content_name: "screens",
    button_id: "site-banner-screens-buttons",
    content_id: "site-content-screens",
    content_html: "screens.html",
    click_on_init: true
}, {
    content_name: "stocks",
    button_id: "site-banner-stocks-buttons",
    content_id: "site-content-stocks",
    content_html: "stocks.html",
    click_on_init: false
}, {
    content_name: "chemicals",
    button_id: "site-banner-chemicals-buttons",
    content_id: "site-content-chemicals",
    content_html: "chemicals.html",
    click_on_init: false
}, {
    content_name: "recipes",
    button_id: "site-banner-recipes-button",
    content_id: "site-content-recipes",
    content_html: "recipes.html",
    click_on_init: false
}];
public_functions.init_subpage_buttons("root", subpages);

$('#site-login-button').click(function() {
    if (window.sessionStorage.getItem('auth_token')) {
        window.sessionStorage.removeItem('auth_token');
        CURRENT_AUTH_USER = null;
        $('#site-login-button').text('Log in');
        if ($('#site-content-comments').is(':visible')) {
            load_comments_page();
        }
        return;
    }
    public_functions.authorise_action(null, function() {
        if ($('#site-content-comments').is(':visible')) {
            load_comments_page();
        }
    });
});

$('#site-comments-button').click(load_comments_page);
$('#comments-sign-in-button').click(function() {
    $('#site-login-button').click();
});

$('#comments-form').submit(function(event) {
    event.preventDefault();
    const comment = $('#comments-input').val().trim();
    if (!comment) {
        $('#comments-page-status').text('Enter a comment before submitting.');
        return;
    }
    const token = window.sessionStorage.getItem('auth_token');
    if (!token) {
        $('#site-login-button').click();
        return;
    }
    $('#comments-submit-button').prop('disabled', true);
    $.ajax({
        type: 'POST',
        url: API_URL + '/comments/',
        contentType: 'application/json',
        headers: {Authorization: 'Bearer ' + token},
        data: JSON.stringify({comment: comment}),
        success: function() {
            $('#comments-input').val('');
            $('#comments-page-status').text('Your comment has been submitted.');
            if (CURRENT_AUTH_USER && CURRENT_AUTH_USER.admin) {
                load_comments_page();
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.sessionStorage.removeItem('auth_token');
                $('#site-login-button').text('Log in');
                $('#comments-sign-in-prompt').show();
                $('#comments-form').hide();
                $('#comments-page-status').text('Your sign-in expired. Please sign in again to comment.');
            } else {
                $('#comments-page-status').text('Unable to submit the comment. Please try again.');
            }
        },
        complete: function() {
            $('#comments-submit-button').prop('disabled', false);
        }
    });
});

if (window.sessionStorage.getItem('auth_token')) {
    $('#site-login-button').text('Log out');
}

// Write UI and API version numbers beside title
$('#ui-version').text("ui-"+UI_VERSION);
$.ajax({
    url: API_URL+'/api_version',
    success: function(version_str){
        $('#api-version').text('api-'+version_str);
    },
    error: function(error){
        public_functions.alert_user("Error connecting to API. Site functions may not work.");
    },
});

// Remove login submission default action
$("#login-form").submit(function(e) {
    e.preventDefault();
});

// Login dialog cancel
$('#login-cancel-button').click(function(){
    // Hide login
    $('#site-popup-container').hide();
    $("#login-popup").css("display", "none");
    // Remove message
    $('#login-error-message').text('');
});

// Confirmation dialog cancel
$('#confirmation-cancel-button').click(function(){
    // Remove accept action
    $('#confirmation-accept-button').off("click");
    // Hide confirmation dialog
    $('#site-popup-container').hide();
    $("#confirmation-popup").css("display", "none");
    // Remove message
    $('#confirmation-message').text('');
});

// Recipe CSV format dialog cancel
$('#recipe-format-cancel-button').click(function(){
    $('#site-popup-container').hide();
    $('#recipe-format-popup').css('display', 'none');
});

// Information dialog okay
$('#information-okay-button').click(function(){
    // Hide dialog
    $('#site-popup-container').hide();
    $("#information-popup").css("display", "none");
    // Remove message
    $('#information-message').text('');
});

// About us popup open
$('#site-about-us-button').click(function(){
    $("#about-us-popup").css("display", "block");
    $('#site-popup-container').show();
});

// About us dialog close
$('#about-us-close-button').click(function(){
    // Hide dialog
    $('#site-popup-container').hide();
    $("#about-us-popup").css("display", "none");
});

});

// Return public functions object for globally avilable functions
return public_functions;
})();
