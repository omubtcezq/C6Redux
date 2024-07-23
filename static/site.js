(function() {
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
});

// Start by selecting screens button
$('#site-banner-screens-buttons').click();

// Load all button contents (only screens will be visible)
$('#site-content-screens').load('screens.html');
$('#site-content-stocks').load('stocks.html');
$('#site-content-chemicals').load('chemicals.html');


});
})();