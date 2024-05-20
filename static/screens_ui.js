(function() {
// Connection parameters
API_IP = '13.236.58.27'
API_PORT = '8000'
API_URL = 'http://'+API_IP+':'+API_PORT+'/api'

// Load rest once document is ready
$(document).ready(function() {

$('#all_screens').click(function(){
    $.getJSON(API_URL+'/screens', function(data) {
        screen_table = $('#screen_table');
        $.each(data, function(i,s){
            screen_table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text(s.name)).
                    append($('<td>').text(s.creator)).
                    append($('<td>').text(s.creation_date)).
                    append($('<td>').text(s.format_name)).
                    append($('<td>').text(s.format_rows)).
                    append($('<td>').text(s.format_cols)).
                    append($('<td>').text(s.comments)));
        });
    });
})

$('#query_screens').click(function(){
    $('#query_container').css("visibility", "visible");
})




// Close document ready and namespace functions
});
})();