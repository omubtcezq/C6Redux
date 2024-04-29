(function() {
    $.getJSON('http://13.236.58.27:8000/api/screens', function(data) {
        table = $('#screen_table');
        $.each(data, function(i,s){
            table.
                append($('<tr>').attr('id',i).
                    append($('<td>').text(s.name)).
                    append($('<td>').text(s.username)).
                    append($('<td>').text(s.format_rows)).
                    append($('<td>').text(s.format_cols)).
                    append($('<td>').text(s.format_subs)).
                    append($('<td>').text(s.comments)));
        });
    });
})();