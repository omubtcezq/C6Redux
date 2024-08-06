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
                $('<td>').attr('colspan',12).text('No stocks found')
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
                            // Turn row into editable stock
                            edit_stock(s, $(this).parent().parent());
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

function edit_stock(s, stock_row){
    // Create body for editable stock table
    let edit_stock_contents = $('<tbody>');
    // Available flag
    edit_stock_contents.append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-available'+s.id).
                text('Available')
            )
        ).append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-available'+s.id).
                attr('class', 'input-wide').
                attr('type', 'checkbox').
                attr('name', 'stock-available'+s.id).
                prop('checked', s.available ? true : false)
            )
        )
    ).
    // Stock name input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-name'+s.id).
                text('Name')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-name'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-name'+s.id).
                val(s.name)
            )
        )
    ).
    // Chemical drop down
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-chemical-id'+s.id).
                text('Chemical')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-chemical-id'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-chemical-id'+s.id).
                attr('placeholder', 'Search chemicals').
                attr('autocomplete-id', String(s.factor.chemical.id)).
                autocomplete({
                    source: function (request, response){
                        if (CHEMICAL_NAMES == null){
                            $.getJSON(API_URL+'/chemicals/names', function(chemical_names){
                                CHEMICAL_NAMES = chemical_names;
                                response(search_chemical_names(request.term, CHEMICAL_NAMES));
                            })
                        } else {
                            response(search_chemical_names(request.term, CHEMICAL_NAMES));
                        }
                    },
                    select: function(event, ui) {
                        let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                        let concentration_input = $(this).closest('.input-table').find('.input-conc');
                        let id = ui.item.id;
                        if (id){
                            $.getJSON(API_URL+'/chemicals/chemical?chemical_id='+id, function(chemical){
                                for (i in ALL_UNITS){
                                    if (ALL_UNITS[i] == chemical.unit){
                                        unit_dropdown.val(ALL_UNITS[i]);
                                        unit_dropdown.change();
                                        concentration_input.val(null);
                                        concentration_input.change();
                                    }
                                }
                            })
                        }
                    },
                    change: function(event,ui){
                        let unit_dropdown = $(this).closest('.input-table').find('.input-units');
                        let concentration_input = $(this).closest('.input-table').find('.input-conc');
                        if (ui.item){
                            $(this).val(ui.item.value);
                            $(this).attr('autocomplete-id', String(ui.item.id));
                        } else {
                            $(this).val('');
                            $(this).attr('autocomplete-id', '');
                            unit_dropdown.val(ALL_UNITS[0]);
                            unit_dropdown.change();
                            concentration_input.val(null);
                            concentration_input.change();
                        }
                    },
                    minLength: 1
                }).val(s.factor.chemical.name)
            )
        )
    ).
    // Concentration and unit input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-conc'+s.id).
                text('Concentration')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-conc'+s.id).
                attr('class', 'input-conc').
                attr('name', 'stock-conc'+s.id).
                attr('type', 'number').
                attr('min', '0').
                attr('placeholder', 'Range: [0, inf)').
                change(function(){
                    if ($(this).val() < 0){
                        $(this).val('');
                    }
                }).
                val(s.factor.concentration)
            ).
            append(
                $('<select>').attr('id', 'stock-units'+s.id).
                attr('class', 'input-units').
                attr('name', 'stock-units'+s.id).
                append(
                    ALL_UNITS.map(function(u){
                        let o = $('<option>').attr('value', u).
                                text(u);
                        return o;
                    })
                ).
                val(s.factor.unit)
            )
        )
        
    ).
    // pH input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-ph'+s.id).
                text('pH')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-ph'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-ph'+s.id).
                attr('type', 'number').
                attr('min', '0').
                attr('max', '0').
                attr('placeholder', 'Range: [0, 14]').
                change(function(){
                    if ($(this).val() < 0 || $(this).val() > 14){
                        $(this).val('');
                    }
                }).
                val(s.factor.ph)
            )
        )
    ).
    // Polarity checkbox
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-polar'+s.id).
                text('Polar')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-polar'+s.id).
                attr('class', 'input-wide').
                attr('type', 'checkbox').
                attr('name', 'stock-polar'+s.id).
                prop('checked', s.polar ? true : false)
            )
        )
    ).
    // Viscosity input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-visc'+s.id).
                text('Viscosity')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-visc'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-visc'+s.id).
                attr('type', 'number').
                attr('min', '0').
                attr('placeholder', 'Range: [0, inf)').
                change(function(){
                    if ($(this).val() < 0){
                        $(this).val('');
                    }
                }).val(s.viscosity)
            )
        )
    ).
    // Volatility input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-vola'+s.id).
                text('Volatility')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-vola'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-vola'+s.id).
                attr('type', 'number').
                attr('min', '0').
                attr('placeholder', 'Range: [0, inf)').
                change(function(){
                    if ($(this).val() < 0){
                        $(this).val('');
                    }
                }).val(s.volatility)
            )
        )
    ).
    // Density input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-dens'+s.id).
                text('Density')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-dens'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-dens'+s.id).
                attr('type', 'number').
                attr('min', '0').
                attr('placeholder', 'Range: [0, inf)').
                change(function(){
                    if ($(this).val() < 0){
                        $(this).val('');
                    }
                }).val(s.density)
            )
        )
    ).
    // Comments input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-comments'+s.id).
                text('Comments')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-comments'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-comments'+s.id).
                val(s.comments)
            )
        )
    )

    // Create row in original table below stock row and add editable contents table there
    stock_row.after(
        $('<tr>').
        attr('id', 'edit-stock-'+s.id).
        attr('class', 'viewed-row-highlight').
        append(
            $('<td>').attr('colspan', '12')
            .append(
                $('<div>').attr('id', 'stock-edit-div').
                append('<br/>').
                // Save and cancel buttons
                append(
                    $('<div>').attr('id', 'stock-edit-button-div').
                    append(
                        $('<button>').attr('id', 'edit-stock-button'+s.id).
                        attr('class', 'stacked-button').
                        text('Save').
                        click(function () {
                            // 
                        })
                    ).
                    append(
                        $('<button>').attr('id', 'cancel-edit-stock-button'+s.id).
                        attr('class', 'stacked-button delete-button').
                        text('Cancel').
                        click(function () {
                            // 
                            stock_row.next().remove();
                            stock_row.removeClass('viewed-row-highlight');
                            $('#edit-stock-button'+s.id).removeAttr('disabled');
                        })
                    )
                ).
                append('<br/>').
                // Stock edit table
                append(
                    // Add the body created above
                    $('<table>').attr('class', 'input-table').
                    append(edit_stock_contents)
                ).
                append('<br/>')
            )
        )
    );

    // Highlight and disable edit button
    stock_row.addClass('viewed-row-highlight');
    $('#edit-stock-button'+s.id).attr('disabled', 'disabled');
}


});
})();