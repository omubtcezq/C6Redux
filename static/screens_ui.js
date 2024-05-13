(function() {
    API_IP = '13.236.58.27'
    API_PORT = '8000'
    API_URL = 'http://'+API_IP+':'+API_PORT+'/api'

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
            if (s.frequentblock != null) {
                $('#'+i).
                    append($('<td>').text(s.frequentblock.reservoir_volume)).
                    append($('<td>').text(s.frequentblock.solution_volume));
            } else {
                $('#'+i).
                    append($('<td>').text("")).
                    append($('<td>').text(""));
            }
        });
    });
})();