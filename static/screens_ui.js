(function() {
    $.getJSON('http://13.236.58.27:8000/api/screens', function(data) {
        screen_table = $('#screen_table');
        frequentblock_table = $('#frequentblock_table');
        $.each(data, function(i,d){
            s = d["screen"]
            fb = d["frequentblock"]
            screen_table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text(s.name)).
                    append($('<td>').text(s.username)).
                    append($('<td>').text(s.format_rows)).
                    append($('<td>').text(s.format_cols)).
                    append($('<td>').text(s.format_subs)).
                    append($('<td>').text(s.comments)));
            if (fb != null) {
                screen_table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text(fb.reservoir_volume)).
                    append($('<td>').text(fb.solution_volume)));
            } else {
                screen_table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text("")).
                    append($('<td>').text("")));
            }
        });
    });
})();