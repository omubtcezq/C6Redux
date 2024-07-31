(function() {
// Load once document is ready
$(document).ready(function() {

$('#all-stocks').click(function(){
    stock_table_body = $('#stock-table > tbody');
    stock_table_body.empty();
    $.getJSON(API_URL+'/stocks/all', function(data) {
        display_stocks(data);
    });
});

function display_stocks(stock_list){
    if (stock_list.length == 0){
        $('#stock-table > tbody').append(
            $('<tr>').append(
                $('<td>').attr('colspan',11).text('No stocks found')
            )
        )
    } else {
        $.each(stock_list, function(i,s){
            // Add all stock components to row
            $('#stock-table > tbody').append(
                $('<tr>').attr('id','stock-'+s.id).
                append($('<td>').text(s.available)).
                append($('<td>').text(s.name)).
                append($('<td>').text(s.factor.chemical.name)).
                append($('<td>').text(s.factor.concentration)).
                append($('<td>').text(s.factor.unit)).
                append($('<td>').text(s.factor.ph)).
                append($('<td>').text(s.polar)).
                append($('<td>').text(s.viscosity)).
                append($('<td>').text(s.volatility)).
                append($('<td>').text(s.density)).
                append($('<td>').text(s.comments)).
                // Include buttons to edit or remove stock
                append(
                    $('<td>').attr('class', 'button-cell').
                    append(
                        $('<button>').attr('id', 'edit-stock-button'+s.id).
                        attr('class', 'stacked-button').
                        text('Edit').
                        click(function () {
                            // Turn row into editable stock given id and row
                            
                        })
                    ).
                    append(
                        $('<button>').attr('id', 'delete-stock-button'+s.id).
                        attr('class', 'stacked-button delete-button').
                        text('Delete').
                        click(function () {
                            // Delete stock in row (with confirmation) given id and row
                        })
                    )
                )
            );
        });
    }
}


});
})();