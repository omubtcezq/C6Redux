// Global parameters

// Connection
//const API_IP = '13.236.58.27';
const API_IP = 'localhost';
const API_PORT = '8000';
let API_URL = 'http://'+API_IP+':'+API_PORT+'/api';

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

});
})();