// Global js

// Connection parameters
const API_ADDRESS = 'www.c6redux.au';
const API_PORT = '443';
let API_URL = 'https://'+API_ADDRESS+':'+API_PORT+'/api';
// const API_ADDRESS = 'localhost';
// const API_PORT = '8000';
// let API_URL = 'http://'+API_ADDRESS+':'+API_PORT+'/api';

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

// Get authentication token
function get_auth_token(msg){
    // If no token or a message needs to be displayed, popup login dialog
    if (!window.sessionStorage.getItem('auth_token') || msg){
        window.sessionStorage.removeItem('auth_token');
        if (msg) {
            $('#login-error-message').text(msg);
        }
        $("#login-popup").css("display", "block");
    }
    return window.sessionStorage.getItem('auth_token');
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

// Login form should authenticate on submission
$("#login-form").submit(function(e) {
    // Don't do default form submission
    e.preventDefault();
    // Submit authentication for token
    let form = $(this);
    $.ajax({
        type: 'POST',
        url: API_URL+'/auth/token', 
        data: form.serialize(), 
        success: function(token) {
            // Save token and hide login
            window.sessionStorage.setItem('auth_token', token.access_token);
            $('#login-error-message').text('');
            $("#login-popup").css("display", "none");
        },
        error: function(xhr, status, error) {
            // Display error
            $('#login-error-message').text("Error: " + error);
        }
    });
});

$('#login-cancel-button').click(function(){
    // Hide login
    $('#login-error-message').text('');
    $("#login-popup").css("display", "none");
});

});
})();