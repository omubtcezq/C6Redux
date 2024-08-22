// Global js

// Connection parameters
// const API_ADDRESS = 'www.c6redux.au';
// const API_PORT = '443';
// let API_URL = 'https://'+API_ADDRESS+':'+API_PORT+'/api';
const API_ADDRESS = 'localhost';
const API_PORT = '8000';
let API_URL = 'http://'+API_ADDRESS+':'+API_PORT+'/api';

// All units
const ALL_UNITS = [
    'M',
    'v/v',
    'w/v',
    'mM',
    'mg/ml'
]

// Cached screen names lists
let SCREEN_NAMES = null;
// Search over screen names
function search_screen_names(term, screen_names){
    let out = [];
    // String match screens names only
    $.each(screen_names, function(i, s){
        if (s.name.toLowerCase().includes(term.toLowerCase())){
            out.push({
                'value': s.name,
                'label': s.name,
                'id': s.id
            });
        }
    });
    return out;
}

// Cached chemical names list
let CHEMICAL_NAMES = null;
// Search over chemical name
function search_chemical_names(term, chemical_names){
    let out = [];
    // String match chemicals and aliases
    $.each(chemical_names, function(i, c){
        if (c.name.toLowerCase().includes(term.toLowerCase())){
            out.push({
                'value': c.name,
                'label': c.name,
                'id': c.id
            });
        } else {
            for (i in c.aliases){
                if (c.aliases[i].name.toLowerCase().includes(term.toLowerCase())){
                    out.push({
                        'value': c.name,
                        'label': c.name + " (alias: " + c.aliases[i].name + ")",
                        'id': c.id
                    });
                    break;
                }
            }
        }
    });
    return out;
}

// Authentication
function authorise_action(msg, action_needing_token){
    // No token or a message, require user to login
    if (!window.sessionStorage.getItem('auth_token') || msg){
        // Remove old token if present and display message is present
        window.sessionStorage.removeItem('auth_token');
        if (msg) {
            $('#login-error-message').text(msg);
        }
        // Display login dialog
        $("#login-popup").css("display", "block");
        // Make submit action perform callback with token after sucessful login
        $('#login-submit-button').off("click");
        $('#login-submit-button').click(function() {
            $.ajax({
                type: 'POST',
                url: API_URL+'/auth/token', 
                data: $('#login-form').serialize(), 
                success: function(token) {
                    // Save token, perform action and hide login
                    window.sessionStorage.setItem('auth_token', token.access_token);
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
function confirm_action(msg, action){
    // Display message
    $('#confirmation-message').text(msg);
    $("#confirmation-popup").css("display", "block");
    // Make accept perform callback action before calcelling the dialog
    $('#confirmation-accept-button').off("click");
    $('#confirmation-accept-button').click(function() {
        action();
        $('#confirmation-cancel-button').click();
    });
}

// Alert popup
function alert_user(msg){
    // Display message
    $('#information-message').text(msg);
    $("#information-popup").css("display", "block");
}

// Local js for site functions
(function() {
// Flag to only load tabs on first click and then save
let screens_loaded = false;
let stocks_loaded = false;
let chemicals_loaded = false;

// Load once document is ready
$(document).ready(function() {

// Set the actions of the buttons at the top site banner
$('#site-banner-screens-buttons').click(function(){
    // Show screens contents, hide rest
    $('#site-content-screens').css("display", "block");
    $('#site-content-stocks').css("display", "none");
    $('#site-content-chemicals').css("display", "none");
    
    // Disable screens button, enable rest
    $('#site-banner-screens-buttons').attr('disabled','disabled');
    $('#site-banner-stocks-buttons').removeAttr('disabled');
    $('#site-banner-chemicals-buttons').removeAttr('disabled');

    // Load screens on first tab change
    if (!screens_loaded){
        $('#site-content-screens').load('screens.html');
        screens_loaded = true;
    }
});

$('#site-banner-stocks-buttons').click(function(){
    // Show stocks contents, hide rest
    $('#site-content-screens').css("display", "none");
    $('#site-content-stocks').css("display", "block");
    $('#site-content-chemicals').css("display", "none");

    // Disable stocks button, enable rest
    $('#site-banner-screens-buttons').removeAttr('disabled');
    $('#site-banner-stocks-buttons').attr('disabled','disabled');
    $('#site-banner-chemicals-buttons').removeAttr('disabled');

    // Load stocks on first tab change
    if (!stocks_loaded){
        $('#site-content-stocks').load('stocks.html');
        stocks_loaded = true;
    }
});

$('#site-banner-chemicals-buttons').click(function(){
    // Show chemicals contents, hide rest
    $('#site-content-screens').css("display", "none");
    $('#site-content-stocks').css("display", "none");
    $('#site-content-chemicals').css("display", "block");

    // Disable chemicals button, enable rest
    $('#site-banner-screens-buttons').removeAttr('disabled');
    $('#site-banner-stocks-buttons').removeAttr('disabled');
    $('#site-banner-chemicals-buttons').attr('disabled','disabled');

    // Load chemicals on first tab change
    if (!chemicals_loaded){
        $('#site-content-chemicals').load('chemicals.html');
        chemicals_loaded = true;
    }
});

// Start by selecting screens tab
$('#site-banner-screens-buttons').click();

// Remove login submission default action
$("#login-form").submit(function(e) {
    e.preventDefault();
});

// Login dialog cancel
$('#login-cancel-button').click(function(){
    // Hide login
    $("#login-popup").css("display", "none");
    // Remove message
    $('#login-error-message').text('');
});

// Confirmation dialog cancel
$('#confirmation-cancel-button').click(function(){
    // Remove accept action
    $('#confirmation-accept-button').off("click");
    // Hide confirmation dialog
    $("#confirmation-popup").css("display", "none");
    // Remove message
    $('#confirmation-message').text('');
});

// Information dialog okay
$('#information-okay-button').click(function(){
    // Hide dialog
    $("#information-popup").css("display", "none");
    // Remove message
    $('#information-message').text('');
});

});
})();