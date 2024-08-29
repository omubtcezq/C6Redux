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


// HOPEFULLY TEMPORARY


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



// Function that allows setting up of subpage buttons.
// Variable subpages should be in the form:
// [{
//     button_id: str,
//     content_id: str,
//     content_html: str,
//     click_on_init: bool
// }, ... ]
function init_subpage_buttons(subpages){
    // Loop the subpages
    $.each(subpages, function(i, subpage){

        // Create click event handler on the button
        $('#'+subpage.button_id).click(function(){

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

            // If the content is empty, load it form the html (will only happen once)
            if ($('#'+subpage.content_id).children().length == 0){
                $('#'+subpage.content_id).load(subpage.content_html);
            }
        });

        // Click the subpage button that should be click on initialisation
        if (subpage.click_on_init){
            $('#'+subpage.button_id).click();
        }
    });
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

// Load once document is ready
$(document).ready(function() {

// Set up banner subpage buttons
subpages = [{
    button_id: "site-banner-screens-buttons",
    content_id: "site-content-screens",
    content_html: "screens.html",
    click_on_init: true
}, {
    button_id: "site-banner-stocks-buttons",
    content_id: "site-content-stocks",
    content_html: "stocks.html",
    click_on_init: false
}, {
    button_id: "site-banner-chemicals-buttons",
    content_id: "site-content-chemicals",
    content_html: "chemicals.html",
    click_on_init: false
}];
init_subpage_buttons(subpages);

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