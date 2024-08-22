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

$('#add-stock-button').click(create_stock);

function display_stocks(stock_list){
    // If no stocks to show, display this
    if (stock_list.length == 0){
        $('#stock-table > tbody').append(
            $('<tr>').append(
                $('<td>').attr('colspan',12).text('No stocks found')
            )
        )
    // Otherwise add each stock row to table
    } else {
        $.each(stock_list, function(i,s){
            $('#stock-table > tbody').append(create_stock_row(s));
        });
    }
}

function create_stock_row(s){
    // Create row
    stock_row = $('<tr>');
    // Add all stock components to row
    stock_row.attr('id','stock-'+s.id).
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
                edit_stock(s);
            })
        ).
        append(
            $('<button>').attr('id', 'delete-stock-button'+s.id).
            attr('class', 'stacked-button delete-button').
            text('Delete').
            click(function () {
                delete_stock(s.id);
            })
        )
    );
    return stock_row;
}

function create_stock_contents_row(s, save_action, cancel_action){
    // If no initialisation stock, create empty dummy
    if (!s){
        s = {
            "id": "add",
            "available": 1,
            "name": null,
            "creator": null,
            "factor": {
                "chemical": {
                    "id": null,
                    "name": null
                },
                "concentration": null,
                "unit": null,
                "ph": null
            },
            "polar": 0,
            "viscosity": null,
            "volatility": null,
            "density": null,
            "comments": null
        }
    }
    // Create body for editable stock table
    let stock_contents_body = $('<tbody>');
    // Available flag
    stock_contents_body.append(
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
    // Stock creator input
    append(
        $('<tr>').append(
            $('<td>').append(
                $('<label>').attr('for', 'stock-creator'+s.id).
                text('Creator')
            )
        ).
        append(
            $('<td>').append(
                $('<input>').attr('id', 'stock-creator'+s.id).
                attr('class', 'input-wide').
                attr('name', 'stock-creator'+s.id).
                val(s.creator)
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
                $('<select>').attr('id', 'stock-unit'+s.id).
                attr('class', 'input-units').
                attr('name', 'stock-unit'+s.id).
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
    );

    // The stock contents row
    contents_row = $('<tr>').
    attr('id', 'stock-contents-'+s.id).
    attr('class', 'viewed-row-highlight').
    append(
        $('<td>').attr('colspan', '12')
        .append(
            $('<div>').attr('id', 'stock-contents-div').
            append('<br/>').
            // Save and cancel buttons
            append(
                $('<div>').attr('id', 'stock-contents-button-div').
                append(
                    $('<button>').attr('id', 'stock-save-button'+s.id).
                    attr('class', 'stacked-button').
                    text('Save').
                    click(function () {
                        save_action(s.id);
                    })
                ).
                append(
                    $('<button>').attr('id', 'stock-cancel-button'+s.id).
                    attr('class', 'stacked-button delete-button').
                    text('Cancel').
                    click(function () {
                        cancel_action(s.id);
                    })
                )
            ).
            append('<br/>').
            append(
                // Add the body created above
                $('<table>').attr('class', 'input-table').
                append(stock_contents_body)
            ).
            append('<br/>')
        )
    );

    // Return new contents row
    return contents_row;
}

function edit_stock(s){
    // Get stock row
    stock_row = $('#stock-'+s.id);

    // Create row in original table below stock row and add editable contents table there
    stock_row.after(create_stock_contents_row(s, save_edited_stock, cancel_edited_stock));

    // Highlight row and disable edit button
    stock_row.addClass('viewed-row-highlight');
    $('#edit-stock-button'+s.id).attr('disabled', 'disabled');
    $('#delete-stock-button'+s.id).attr('disabled', 'disabled');
}

function create_stock(){
    stocks_table_body = $('#stock-table > tbody');
    stocks_table_body.prepend(create_stock_contents_row(null, save_new_stock, cancel_new_stock));
    $('#add-stock-button').attr('disabled', 'disabled');
}

function save_new_stock(id){
    // Stock contents row
    stock_contents_row = $('#stock-contents-'+id);
    // Read new stock
    new_stock = {
        "available": $('#stock-available'+id).prop('checked') ? 1 : 0,
        "name": $('#stock-name'+id).val() ? $('#stock-name'+id).val() : null,
        "creator": $('#stock-creator'+id).val() ? $('#stock-creator'+id).val() : null,
        "factor": {
            "chemical_id": $('#stock-chemical-id'+id).attr('autocomplete-id'),
            "concentration": $('#stock-conc'+id).val() ? $('#stock-conc'+id).val() : null,
            "unit": $('#stock-unit'+id).val(),
            "ph": $('#stock-ph'+id).val() ? $('#stock-ph'+id).val() : null,
        },
        "polar": $('#stock-polar'+id).prop('checked') ? 1 : 0,
        "viscosity": $('#stock-visc'+id).val() ? $('#stock-visc'+id).val() : null,
        "volatility": $('#stock-vola'+id).val() ? $('#stock-vola'+id).val() : null,
        "density": $('#stock-dens'+id).val() ? $('#stock-dens'+id).val() : null,
        "comments": $('#stock-comments'+id).val() ? $('#stock-comments'+id).val() : null,
        "hazards": []
    }
    // Sanity checks
    if (new_stock.name == null){
        alert_user('Must specify a stock name!');
    } else if (new_stock.creator == null) {
        alert_user('Must specify a stock creator!');
    } else if (new_stock.factor.chemical_id == '' || new_stock.factor.concentration == null) {
        alert_user('Must specify chemical and concentration!');
    } else {
        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'POST',
                url: API_URL+'/stocks/create', 
                data: JSON.stringify(new_stock), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success replace editing contents with new stock row
                success: function(returned_stock) {
                    stock_contents_row.removeClass('viewed-row-highlight');
                    stock_contents_row.replaceWith(create_stock_row(returned_stock));
                    $('#add-stock-button').removeAttr('disabled');
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        authorise_action(null, to_authorise);
    }
}

function cancel_new_stock(id){
    // Stock contents row
    stock_contents_row = $('#stock-contents-'+id);
    // Remove editing contents
    stock_contents_row.remove();
    // Reenable add button
    $('#add-stock-button').removeAttr('disabled');
}

// Callback for saving edited stock
function save_edited_stock(id){
    // Get unedited stock row
    stock_row = $('#stock-'+id);
    // Read edited stock
    updated_stock = {
        "id": id,
        "available": $('#stock-available'+id).prop('checked') ? 1 : 0,
        "name": $('#stock-name'+id).val() ? $('#stock-name'+id).val() : null,
        "creator": $('#stock-creator'+id).val() ? $('#stock-creator'+id).val() : null,
        "factor": {
            "chemical_id": $('#stock-chemical-id'+id).attr('autocomplete-id'),
            "concentration": $('#stock-conc'+id).val() ? $('#stock-conc'+id).val() : null,
            "unit": $('#stock-unit'+id).val(),
            "ph": $('#stock-ph'+id).val() ? $('#stock-ph'+id).val() : null,
        },
        "polar": $('#stock-polar'+id).prop('checked') ? 1 : 0,
        "viscosity": $('#stock-visc'+id).val() ? $('#stock-visc'+id).val() : null,
        "volatility": $('#stock-vola'+id).val() ? $('#stock-vola'+id).val() : null,
        "density": $('#stock-dens'+id).val() ? $('#stock-dens'+id).val() : null,
        "comments": $('#stock-comments'+id).val() ? $('#stock-comments'+id).val() : null,
        "hazards": []
    }
    // Sanity checks
    if (updated_stock.name == null){
        alert_user('Must specify a stock name!');
    } else if (updated_stock.creator == null) {
        alert_user('Must specify a stock creator!');
    } else if (updated_stock.factor.chemical_id == '' || updated_stock.factor.concentration == null) {
        alert_user('Must specify chemical and concentration!');
    } else {
        // Authorise and make api call
        to_authorise = function(auth_token){
            $.ajax({
                type: 'PUT',
                url: API_URL+'/stocks/update', 
                data: JSON.stringify(updated_stock), 
                headers: {"Authorization": "Bearer " + auth_token},
                // On success remove editing contents and update original row
                success: function(returned_stock) {
                    stock_row.next().remove();
                    stock_row.removeClass('viewed-row-highlight');
                    $('#edit-stock-button'+id).removeAttr('disabled');
                    $('#delete-stock-button'+id).removeAttr('disabled');
                    stock_row.replaceWith(create_stock_row(returned_stock));
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        authorise_action(null, to_authorise);
    }
}

// Callback for cancelling the editting of stock
function cancel_edited_stock(id){
    // Get unedited stock row
    stock_row = $('#stock-'+id);
    // Remove editing contents and highlights
    stock_row.next().remove();
    stock_row.removeClass('viewed-row-highlight');
    // Reenable edit button
    $('#edit-stock-button'+id).removeAttr('disabled');
    $('#delete-stock-button'+id).removeAttr('disabled');
}

function delete_stock(id){
    stock_row = $('#stock-'+id);
    // Confirm, authorise and make api call
    confirm_action("This will delete the selected stock from the database!", function (){
        to_authorise = function(auth_token){
            $.ajax({
                type: 'DELETE',
                url: API_URL+'/stocks/delete?stock_id='+id,
                headers: {"Authorization": "Bearer " + auth_token},
                // On success remove stock
                success: function() {
                    stock_row.remove();
                },
                // On authentication error, request login
                error: function(xhr, status, error){
                    if (xhr.status == 401) {
                        msg = 'Please log in again';
                        authorise_action(msg, to_authorise);
                    }
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
        authorise_action(null, to_authorise);
    });
}

// TABULATOR

function formatter_buttons(cell, formatterParams, onRendered){
    if (cell.getRow().isSelected()){
        div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
            $('<tr>').append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'save-button table-cell-button').
                    text('Save')
                )
            ).append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'cancel-button table-cell-button').
                    text('Cancel')
                )
        )))
    } else if (cell.getTable().getSelectedRows().length == 0) {
        div = $('<table>').attr('class', 'button-table').append($('<tbody>').append(
            $('<tr>').append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'edit-button table-cell-button').
                    text('Edit')
                )
            ).append(
                $('<td>').append(
                    $('<button>').
                    attr('class', 'delete-button table-cell-button').
                    text('Delete')
                )
        )))
    } else {
        div = $('<div>');
    }
    return div.prop('outerHTML');
}

function cellclick_action(e, cell){
    target = $(e.target);
    if (target.hasClass('edit-button')) {
        row_edit(cell.getRow());
    } else if (target.hasClass('delete-button')){
        row_delete(cell.getRow());
    } else if (target.hasClass('save-button')){
        row_save(cell.getRow());
    } else if (target.hasClass('cancel-button')){
        row_cancel(cell.getRow());
    }
}

function row_edit(row){
    table = row.getTable();
    table.deselectRow();
    row.select();

    all_rows = table.getRows();
    $.each(all_rows, function(i, r){r.reformat()});

    cells = row.getCells();
    $.each(cells, function(i, c){c.setValue(c.getValue());});

}

function row_delete(row){

}

function row_save(row){

}

function row_cancel(row){
    table.deselectRow();
    cells = row.getCells();
    $.each(cells, function(i, c){c.restoreOldValue();});

    all_rows = table.getRows();
    $.each(all_rows, function(i, r){r.reformat()});
}


var table = new Tabulator("#stock-tabulator", {
    ajaxURL:API_URL+"/stocks/all",
    height: "100%",
    layout: "fitColumns",
    //persistence: true,
    rowHeight: 48,
    selectableRows: false,
    index: "id",
    columns: [
        {title: "Available", 
         field: "available", 
         hozAlign: "center", 
         vertAlign: "middle",
         widthGrow: 1,
         editor: "tickCross", 
         editable: is_selected,
         formatter: "tickCross", 
         headerFilter:"tickCross", 
         headerFilterEmptyCheck: function(value){return !value;}},
        {title: "Name", 
         field: "name", 
         vertAlign: "middle",
         widthGrow: 5,
         editor: "input",
         editable: is_selected,
         headerFilter: "input"},
        {title: "Chemical", 
         field: "factor.chemical.name", 
         vertAlign: "middle",
         widthGrow: 4,
         headerFilter: "input"},
        {title: "Concentration", 
         field: "factor.concentration", 
         hozAlign: "right", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "number"},
        {title: "Unit", 
         field: "factor.unit", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "input"},
        {title: "pH", 
         field: "factor.ph", 
         hozAlign: "right", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "number"},
        {title: "Polar", 
         field: "polar", 
         hozAlign: "center", 
         vertAlign: "middle",
         widthGrow: 1,
         formatter: "tickCross",
         headerFilter:"tickCross", 
         headerFilterEmptyCheck: function(value){return !value;}},
        {title: "Viscosity", 
         field: "viscosity", 
         hozAlign: "right", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "number"},
        {title: "Volatility", 
         field: "volatility", 
         hozAlign: "right", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "number"},
        {title: "Density", 
         field: "density", 
         hozAlign: "right", 
         vertAlign: "middle",
         widthGrow: 1,
         headerFilter: "number"},
        {title: "Creator", 
         field: "creator", 
         vertAlign: "middle",
         widthGrow: 2,
         visible: true, 
         headerFilter: "input"},
        {title: "Hazards", 
         field: "hazards", 
         vertAlign: "middle",
         widthGrow: 2,
         visible: true},
        {title: "Comments", 
         field: "comments", 
         vertAlign: "middle",
         widthGrow: 4,
         headerFilter: "input"},
        {title: "", field: "actions", width: 170, formatter: formatter_buttons, cellClick: cellclick_action, headerSort: false, hozAlign: "center", vertAlign: "middle", resizable: false, frozen: true}
    ],
    initialSort: [
        {column: "available", dir: "desc"}
    ]
});


function cellclick_edit(e, cell){
    row = cell.getRow();
    table = cell.getTable();
    selected_rows = table.getSelectedRows();
    if (selected_rows.length > 0) {
        $.each(selected_rows, function(index, value){
            value.deselect();
            value.reformat();
        });
    }

    // Fix below
    row.select();
    row.reformat();
    cells = row.getCells();

    for (i = 0; i < cells.length; i++) {
        cells[i].setValue(cells[i].getValue());
    }

    table.hideColumn("edit_button");
    table.hideColumn("delete_button");
    table.showColumn("save_button");
    table.showColumn("cancel_button");
}

function cellclick_cancel(e, cell){
    if (!cell.getRow().isSelected()){
        return
    }
    row = cell.getRow();
    table = cell.getTable();
    cells = row.getCells();

    for (i = 0; i < cells.length; i++) {
        cells[i].restoreOldValue();
    }
    stop_editing(cell);
}

function cellclick_save(e, cell){
    if (!cell.getRow().isSelected()){
        return
    }
    stop_editing(cell);
}

function cellclick_delete(e, cell){
    if (!cell.getRow().isSelected()){
        return
    }
    //Can use prompt to make them connfirm the name
    if(window.confirm("Delete the user "+cell.getData().FirstName+" "+ cell.getData().LastName+"?"))
    {
        stop_editing(cell);
        cell.getRow().delete();
    }
}

function stop_editing(cell){
  row = cell.getRow()
  table = cell.getTable()
  table.deselectRow()
  table.showColumn("edit_button");
  table.showColumn("delete_button");

  table.hideColumn("save_button");
  table.hideColumn("cancel_button");
  row.reformat()
}

function is_selected(cell){
  return cell.getRow().isSelected()
}

function cellclick_selected_tick(e, cell){
  if (cell.getRow().isSelected()){
    cell.setValue(!cell.getValue())
  }
}

// var UsersTable = new Tabulator("#UsersTable",{
//   index:"ID",
//   ajaxURL:"/api/getUsersData",
//   layout:"fitDataFill",
//   layoutColumnsOnNewData:true,
//   paginationSize:10,
//   pagination:"local",
//   selectable:false,
//   initialSort:[
//     {column:"FirstName", dir:"asc"},
//     {column:"LastName", dir:"asc"},
//     {column:"Active", dir:"desc"}
//   ],
//   columns:[
//     {title:"Active", field:"Active", formatter:"tickCross", mutator: mutator_Active, cellClick:cellClick_FlipIfSelected, align:"center", resizable:false},
//     {title:"ID", field:"ID"},
//     {title:"Last", field:"LastName", editable:isRowSelected, editor:"input", resizable:false},
//     {title:"First", field:"FirstName", editable:isRowSelected, editor:"input", resizable:false},
//     {title:"Email", field:"Email", editable:isRowSelected, editor:"input", resizable:false},
//     {title:"Phone Number", field:"PhoneNumber", editable:isRowSelected, editor:"input", resizable:false},
//     {title:"Created", field:"CreatedAt", editable:isRowSelected, formatter:"datetime", resizable:false},
//     {title:"Updated", field:"UpdatedAt", editable:isRowSelected, formatter:"datetime", resizable:false},
//     {field:"EditButton",formatter:formatter_EditButton,cellClick:cellClick_EditButton, headerSort:false, align:"center", resizable:false},
//     {field:"CancelButton", formatter:formatter_CancelButton,cellClick:cellClick_CancelButton, headerSort:false, align:"center", resizable:false,visible:false},
//     {field:"SaveButton",formatter:formatter_SaveButton,cellClick:cellClick_SaveButton, headerSort:false, align:"center", resizable:false,visible:false},
//     {field:"DeleteButton",formatter:formatter_DeleteButton,cellClick:cellClick_DeleteButton, headerSort:false, align:"center", resizable:false,visible:false},
//   ]
// })


});
})();